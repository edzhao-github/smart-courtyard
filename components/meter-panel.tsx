'use client';
import { useEffect, useState, useRef } from 'react';
import type { Bill } from '@/lib/operations';
import type { MeterSnapshot } from '@/lib/meter-ledger';
import { Zap, RefreshCw } from 'lucide-react';
type Reading = { at: string; kwh: number };
type Meter = { roomName: string; address: string; readings: Reading[]; checkedAt?: string; warning: string; billing: { startKwh: number; pricePerKwh: number; tariffs: { startKwh: number; pricePerKwh: number; effectiveReadingAt?: string }[]; usageKwh: number | null; amount: number | null; warning: string } | null };
export function MeterPanel({ roomName, bills, onReading }: { roomName: string; bills: Bill[]; onReading: (meter: MeterSnapshot) => void }) {
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const [data, setData] = useState<Meter | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh(signal?: AbortSignal) {
    setBusy(true);
    try {
      const response = await fetch('/api/meter', { signal });
      const next = await response.json() as Meter & { error?: string };
      if (!response.ok) throw Error(next.error || '读取失败');
      setData(next); setError(''); onReadingRef.current(next);
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (roomName.trim() !== '研发办公室') return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => { void refresh(controller.signal); }, 5 * 60_000);
    const changed = () => { void refresh(controller.signal); };
    window.addEventListener('courtyard-meter-tariff', changed);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('courtyard-meter-tariff', changed); };
  }, [roomName]);
  if (roomName.trim() !== '研发办公室') return null;
  const readings = data?.readings || [], latest = readings[readings.length - 1];
  const meterBills = bills.filter((bill) => bill.powerMeter?.address === data?.address);
  const paid = Math.round(meterBills.reduce((sum, bill) => sum + (bill.powerPaid || 0), 0) * 100) / 100;
  const uncertain = bills.some((bill) => !bill.powerMeter && ((bill.powerPaid ?? 0) > 0 || (bill.powerDue ?? 0) > 0));
  const pending = !uncertain && data?.billing?.amount != null ? Math.max(0, Math.round((data.billing.amount - paid) * 100) / 100) : null;
  const stale = latest && Date.now() - Date.parse(latest.at.replace(' ', 'T') + '+08:00') > 24 * 3600_000;
  return <section className="meter-panel">
    <div className="meter-heading"><h4><Zap size={17} />电表读数</h4><button disabled={busy} onClick={() => void refresh()} aria-label="刷新电表读数"><RefreshCw size={15} />{busy ? '读取中' : '刷新'}</button></div>
    {error && <p role="alert">{error}</p>}
    <div className="meter-summary-grid">
      <div><span>累计用电</span><strong>{latest ? latest.kwh.toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '—'}<small> 度</small></strong></div>
      <div><span>电费待收</span><strong>{pending === null ? '—' : `¥${pending.toFixed(2)}`}</strong></div>
    </div>
    <p className="meter-sync-time">抄表 {latest?.at || '等待数据'}</p>
    {error && <p role="alert">本次读取失败，显示上次记录。</p>}
    {stale && <p className="meter-warning">超过 24 小时未更新</p>}
    <details className="meter-expanded"><summary>计费明细与抄表记录</summary>
    {data?.billing && <div className="meter-billing">
      <h4>用电与收款</h4>
      <dl>
        <div><dt>本期起始读数</dt><dd>{data.billing.startKwh} 度</dd></div>
        <div><dt>当前电价</dt><dd>{data.billing.pricePerKwh} 元/度</dd></div>
        <div><dt>本期用电量</dt><dd>{data.billing.usageKwh === null ? '待核对' : `${data.billing.usageKwh} 度`}</dd></div>
        <div className="meter-billing-total"><dt>累计电费</dt><dd>{data.billing.amount === null ? '待核对' : `¥${data.billing.amount.toFixed(2)}`}</dd></div>
        <div><dt>累计已收</dt><dd>{uncertain ? '待核对历史账单' : `¥${paid.toFixed(2)}`}</dd></div>
        <div className="meter-billing-total"><dt>还需收款</dt><dd>{pending === null ? '待核对' : `¥${pending.toFixed(2)}`}</dd></div>
      </dl>
      {data.billing.warning && <p className="meter-warning">{data.billing.warning}</p>}
      {data.billing.tariffs.length > 1 && <details><summary>分段电价记录</summary>{data.billing.tariffs.map((rate, index) => <p key={index}>{rate.startKwh} 度起：{rate.pricePerKwh} 元/度{rate.effectiveReadingAt ? `（抄表 ${rate.effectiveReadingAt}）` : '（初始电价）'}</p>)}</details>}
      <p>新读数自动更新当期电费，已收金额保留；待收为累计电费减去已记录收款。</p>
      {meterBills.some((bill) => bill.powerReceipts?.length) && <details><summary>电费收款记录</summary>{meterBills.flatMap((bill) => (bill.powerReceipts || []).map((receipt, index) => <p key={`${bill.month}-${index}`}>{receipt.kind === 'opening' ? '原已收金额' : receipt.amount < 0 ? '收款更正' : '收到电费'}：¥{receipt.amount.toFixed(2)} · {receipt.at ? new Date(receipt.at).toLocaleString('zh-CN') : bill.month}</p>))}</details>}
    </div>}
    <p>抄表时间：{latest?.at || '等待平台数据'}（北京时间）</p>
    {stale && <p className="meter-warning">读数超过 24 小时未更新，请检查平台抄表和设备通信。</p>}
    {data?.warning && <p className="meter-warning">{data.warning}</p>}
    <small>表号 {data?.address || '260804553217'} · 倍率已计入</small>
    <details><summary>已保存读数（{readings.length} 条）</summary>
      <div className="meter-history">{readings.slice(-20).reverse().map((entry, index) => {
        const previous = readings[readings.length - index - 2];
        return <div key={entry.at}><time>{entry.at}</time><b>{entry.kwh} 度</b><span>{!previous ? '首次记录' : entry.kwh < previous.kwh ? '读数下降，待核对' : `较上次 +${Number((entry.kwh - previous.kwh).toFixed(3))} 度`}</span></div>;
      })}</div>
    </details>
    <p className="meter-help">打开此房间时每 5 分钟查询一次；只有平台抄表时间更新才新增记录。历史不足时不推算整日、整月用量。</p>
    </details>
  </section>;
}
