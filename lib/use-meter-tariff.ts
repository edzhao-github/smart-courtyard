'use client';
import { useEffect, useState } from 'react';
import type { Plan } from './plan';
let tariffQueue: Promise<void> = Promise.resolve();

export function useMeterTariff(plan: Plan, ready: boolean) {
  const room = plan.elements.find((space) => space.name.trim() === '研发办公室');
  const price = room?.electricityRate;
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!ready || price === undefined) return;
    let active = true;
    // Keep requests ordered across rapid edits. Server mutations are also serialized.
    const sync = () => {
      tariffQueue = tariffQueue.then(async () => {
      try {
        if (!active) return;
        // An older open tab must not overwrite a newer drawing tariff.
        const stored: Plan = JSON.parse(localStorage.getItem('courtyard-plan-v1') || 'null');
        const current = stored?.elements.find((space) => space.name.trim() === '研发办公室');
        if (!current || current.electricityRate !== price) return;
        const response = await fetch('/api/meter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: '研发办公室', pricePerKwh: price }) });
        if (!response.ok) throw Error('sync');
        if (active) { setMessage(''); window.dispatchEvent(new Event('courtyard-meter-tariff')); }
      } catch { if (active) setMessage('图纸已保存，但电表计费电价尚未同步；请保持本机服务运行，稍后自动重试。'); }
      });
      return tariffQueue;
    };
    void sync();
    const timer = setInterval(() => { void sync(); }, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [ready, price]);
  return message;
}
