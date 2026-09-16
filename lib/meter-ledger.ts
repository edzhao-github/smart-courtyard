import { blankBill, type Operations } from './operations';
import { calculateMeterCharge, type Tariff } from './meter-billing';
export type MeterSnapshot = { address: string; warning?: string; readings: {at: string; kwh: number}[];
  billing: { startKwh: number; amount: number | null; tariffs: Tariff[]; warning?: string } | null };
export function syncMeterLedger(ops: Operations, spaceId: string, meter: MeterSnapshot, month: string): Operations {
  const latest = meter.readings[meter.readings.length - 1];
  if (!latest || !meter.billing || meter.warning || meter.billing.warning || meter.billing.amount === null || latest.at.slice(0,7) !== month) return ops;
  const saved = ops.bills.find((b) => b.spaceId === spaceId && b.month === month);
  const others = ops.bills.filter((b) => b !== saved);
  if (others.some((b) => b.spaceId === spaceId && !b.powerMeter && ((b.powerDue ?? 0) > 0 || (b.powerUsage ?? 0) > 0))) return ops;
  const sameMeter = others.filter((b) => b.powerMeter?.address === meter.address);
  if (saved?.powerMeter && sameMeter.some((b) => b.powerMeter!.startKwh >= saved.powerMeter!.endKwh)) return ops;
  const start = saved?.powerMeter?.startKwh ?? Math.max(meter.billing.startKwh, ...sameMeter.map((b) => b.powerMeter!.endKwh));
  if (latest.kwh < start || (saved?.powerMeter && latest.at < saved.powerMeter.readingAt)) return ops;
  const startCharge = calculateMeterCharge(start, meter.billing.tariffs);
  if (startCharge === null) return ops;
  const due = Math.round((meter.billing.amount - startCharge) * 100) / 100;
  if (due < (saved?.powerPaid ?? 0)) return ops;
  const bill = { ...(saved || blankBill(spaceId, month)), powerDue: due, powerPaid: saved?.powerPaid ?? 0,
    powerUsage: Math.round((latest.kwh - start) * 1000) / 1000,
    powerMeter: { address: meter.address, startKwh: start, endKwh: latest.kwh, readingAt: latest.at } };
  if (saved && JSON.stringify(bill) === JSON.stringify(saved)) return ops;
  return { ...ops, bills: [...others, bill] };
}
