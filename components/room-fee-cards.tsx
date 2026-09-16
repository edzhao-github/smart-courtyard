'use client';
import { Building2, Droplets, Zap, ShieldCheck, ArrowUpRight } from 'lucide-react';
import type { Bill } from '@/lib/operations';
type Fee = 'rent' | 'water' | 'power' | 'property';
const fees = [{ key: 'rent', name: '房租', icon: Building2 }, { key: 'water', name: '水费', icon: Droplets }, { key: 'power', name: '电费', icon: Zap }, { key: 'property', name: '物业费', icon: ShieldCheck }] as const;
const money = (n: number | null | undefined) => n == null ? '—' : `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const monthIndex = (m: string) => { const [year, month] = m.split('-').map(Number); return year * 12 + month - 1; };
export function RoomFeeCards({ bills, month, onOpen }: { bills: Bill[]; month: string; onOpen: (fee: Fee, month: string, history?: boolean) => void }) {
  const current = bills.find((bill) => bill.month === month);
  return <section className="room-fees">
    <div className="room-fees-heading"><h4>收费项目</h4><span>{month}</span></div>
    <div className="room-fees-grid">{fees.map(({ key, name, icon: Icon }) => {
      const annual = key === 'rent' ? bills.find((bill) => bill.rentMonths === 12 && (bill.rentDue ?? 0) > 0
        && monthIndex(bill.rentStartMonth || bill.month) <= monthIndex(month)
        && monthIndex(bill.rentStartMonth || bill.month) + 12 > monthIndex(month)) : undefined;
      const bill = annual || current;
      const due = bill?.[`${key}Due`], paid = bill?.[`${key}Paid`];
      const remaining = due != null && paid != null ? Math.max(0, Math.round((due-paid)*100)/100) : null;
      const status = due == null ? '待录入' : paid == null ? '待确认收款' : remaining === 0 ? '已收清' : '待收款';
      const tone = due == null || paid == null ? 'empty' : remaining === 0 ? 'paid' : 'due';
      const detail = key === 'rent' ? annual ? `年付 · ${bill!.rentStartMonth || bill!.month} 起 12 个月` : '月付房租'
        : key === 'property' ? '按账单金额收取'
        : key === 'power' && bill?.powerMeter ? `电表计量 · ${bill.powerUsage ?? '—'} 度`
        : `${key === 'water' ? '用水' : '用电'} ${bill?.[`${key}Usage`] ?? '—'} ${key === 'water' ? 'm³' : '度'}`;
      return <article className={`room-fee-card fee-${key}`} key={key}>
        <header><h5><Icon size={17} />{name}</h5><span className={`fee-status ${tone}`}>{status}</span></header>
        <p className="fee-period">{detail}</p>
        <div className="fee-main"><span>{remaining == null ? '本期应收' : '还需收款'}</span><strong>{money(remaining ?? due)}</strong></div>
        <div className="fee-amounts"><span>应收 <b>{money(due)}</b></span><span>已收 <b>{money(paid)}</b></span></div>
        <footer><button type="button" onClick={() => onOpen(key, bill?.month || month)}>{due == null ? '录入费用' : remaining === 0 ? '查看账单' : '记收款'}<ArrowUpRight size={14} /></button><button type="button" onClick={() => onOpen(key, bill?.month || month, true)}>历史</button></footer>
      </article>;
    })}</div>
  </section>;
}
