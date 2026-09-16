'use client';
import { useEffect, useState } from 'react';
import type { Bill } from '@/lib/operations';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
const money = (value: number | null | undefined) => value == null ? '未记录' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const add = (values: (number | null)[]) => values.every((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + (value || 0), 0);
export function BillHistory({ bills, roomName, onOpen, initialCategory = 'all' }: { initialCategory?: string; bills: Bill[]; roomName: string; onOpen: (month: string) => void }) {
  const [view, setView] = useState('bills');
  const [category, setCategory] = useState(initialCategory);
  const [limit, setLimit] = useState(12);
  const [readings, setReadings] = useState<{at: string; kwh: number}[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sorted = [...bills].sort((a, b) => b.month.localeCompare(a.month));
  useEffect(() => {
    if (view !== 'readings' || roomName.trim() !== '研发办公室') return;
    const controller = new AbortController(); setLoading(true); setError('');
    void fetch('/api/meter', {signal: controller.signal}).then(async (response) => {
      if (!response.ok) throw Error('暂时无法读取电表历史，请重新打开此页重试。');
      const data = await response.json() as {readings: {at: string; kwh: number}[]; warning?: string};
      setReadings(data.readings); setError(data.warning || '');
    }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [view, roomName]);
  const fees = (bill: Bill, suffix: 'Due' | 'Paid') => category === 'all'
    ? add([bill[`rent${suffix}`], bill[`water${suffix}`], bill[`power${suffix}`], bill[`property${suffix}`]]) : bill[`${category}${suffix}` as 'rentDue'];
  const relevant = sorted.filter((bill) => category === 'all' || fees(bill, 'Due') !== null || fees(bill, 'Paid') !== null);
  const receipts = sorted.flatMap((bill) => bill.powerReceipts?.length ? bill.powerReceipts.map((receipt) => ({...receipt, month: bill.month}))
    : (bill.powerPaid ?? 0) > 0 ? [{amount: bill.powerPaid!, at: '', kind: 'opening' as const, month: bill.month}] : [])
    .sort((a,b) => (b.at || b.month).localeCompare(a.at || a.month));
  return <section className="bill-history">
    <Tabs value={view} onValueChange={(value) => {setView(String(value)); setLimit(12);}}>
      <TabsList aria-label="历史记录类型"><TabsTrigger value="bills">往期账单</TabsTrigger><TabsTrigger value="payments">电费收款</TabsTrigger><TabsTrigger value="readings">抄表记录</TabsTrigger></TabsList>
    </Tabs>
    {view === 'bills' && <>
      <div className="history-toolbar"><label>费用筛选 <select value={category} onChange={(e) => {setCategory(e.target.value); setLimit(12);}}><option value="all">全部费用</option><option value="rent">租金</option><option value="water">水费</option><option value="power">电费</option><option value="property">物业费</option></select></label><span>{relevant.length} 期记录</span></div>
      <div className="history-table"><table><thead><tr><th>账期</th><th>该收</th><th>已收</th><th>记录</th></tr></thead><tbody>{relevant.slice(0,limit).map((bill) => <tr key={bill.month}>
        <td><b>{bill.month}</b>{bill.rentMonths === 12 && <small>年付租金 · {bill.rentStartMonth || bill.month} 起 12 个月</small>}</td>
        <td>{money(fees(bill,'Due'))}</td><td>{money(fees(bill,'Paid'))}</td><td><button type="button" onClick={() => onOpen(bill.month)}>查看账单</button></td>
      </tr>)}</tbody></table></div>
      {!relevant.length && <p className="history-empty">还没有这类账单。保存后的账单会按月份显示在这里。</p>}
      {relevant.length > limit && <button type="button" onClick={() => setLimit(limit+12)}>加载更早账单</button>}
      <p className="history-note">展示已保存账单，包含当前账期。年付租金记在收款账期，不拆成十二张账单。</p>
    </>}
    {view === 'payments' && <>
      <p className="history-note">电费每次保存收款变动都会留痕。旧账单只有累计金额时，显示“原已收金额”；租金、水费请查看往期账单。</p>
      {receipts.slice(0,limit).map((receipt,index) => <article className="history-record" key={index}><div><b>{receipt.kind === 'opening' ? '原已收金额' : receipt.amount < 0 ? '收款更正' : '收到电费'}</b><small>{receipt.at ? new Date(receipt.at).toLocaleString('zh-CN') : '未记录具体收款时间'} · {receipt.month} 账单</small></div><strong>{money(receipt.amount)}</strong></article>)}
      {!receipts.length && <p className="history-empty">还没有已保存的电费收款记录。</p>}
      {receipts.length > limit && <button type="button" onClick={() => setLimit(limit+12)}>加载更早收款</button>}
    </>}
    {view === 'readings' && <>
      <p className="history-note">{roomName.trim() === '研发办公室' ? '以下为本机接入后保存的真实读数；相邻增量不是完整日用电量。' : '这个区域尚未接入电表。'}</p>
      {loading && <p role="status">正在读取…</p>}{error && <p role="alert">{error}</p>}
      {roomName.trim() === '研发办公室' && <>{readings.slice().reverse().slice(0,limit).map((reading,index) => {
        const previous = readings[readings.length-index-2];
        return <article className="history-record" key={reading.at}><div><b>{reading.at}</b><small>北京时间 · {previous ? reading.kwh < previous.kwh ? '读数下降，待核对' : `较上次增加 ${Number((reading.kwh-previous.kwh).toFixed(3))} 度` : '首次保存读数'}</small></div><strong>{reading.kwh} 度</strong></article>;
      })}{!loading && !readings.length && !error && <p className="history-empty">还没有保存的读数。</p>}{readings.length > limit && <button type="button" onClick={() => setLimit(limit+12)}>加载更早读数</button>}</>}
    </>}
  </section>;
}
