import type { Plan, Space } from './plan';
export const PLAN_KEY = 'courtyard-plan-v1';
export const OPS_KEY = 'courtyard-operations-v1';
export const financialFields = [
  'rentDue',
  'rentPaid',
  'waterUsage',
  'waterDue',
  'waterPaid',
  'powerUsage',
  'powerDue',
  'powerPaid',
] as const;
export type FinancialField = (typeof financialFields)[number];
export type Bill = {
  spaceId: string;
  month: string;
  dueDate: string;
  notes: string;
  updatedAt: string;
} & Record<FinancialField, number | null>;
export type ParkingDay = {
  date: string;
  income: number;
  vehicles: number | null;
  notes: string;
  updatedAt: string;
};
export type Pipe = {
  id: string;
  name: string;
  kind: 'water' | 'power';
  points: { x: number; y: number }[];
  notes: string;
};
export type TenderQuote = {
  id: string;
  contractor: string;
  amount: number;
  durationDays: number;
  startDate: string;
  notes: string;
  status: '待评审' | '已中标' | '未中标';
};
export type RepairTender = {
  id: string;
  title: string;
  spaceId: string;
  description: string;
  requirements: string;
  deadline: string;
  desiredStartDate: string;
  status: '征集中' | '评审中' | '已定标' | '已结束';
  images: { name: string; dataUrl: string }[];
  quotes: TenderQuote[];
  createdAt: string;
  updatedAt: string;
};
export type Operations = {
  schemaVersion: 1;
  bills: Bill[];
  parking: ParkingDay[];
  pipes: Pipe[];
  tenders: RepairTender[];
};
export const emptyOperations: Operations = {
  schemaVersion: 1,
  bills: [],
  parking: [],
  pipes: [],
  tenders: [],
};
export function dateLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function blankBill(spaceId: string, month: string): Bill {
  return {
    spaceId,
    month,
    dueDate: '',
    notes: '',
    updatedAt: '',
    ...Object.fromEntries(financialFields.map((k) => [k, null])),
  } as Bill;
}
export function isRentable(s: Space) {
  return ['room', 'greenhouse', 'outdoor'].includes(s.kind);
}
export function sumKnown(values: (number | null | undefined)[]): number | null {
  const known = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  return known.length
    ? Math.round(known.reduce((n, v) => n + v, 0) * 100) / 100
    : null;
}
export function balance(b: Bill): number | null {
  return sumKnown(
    (['rent', 'water', 'power'] as const).map((k) =>
      b[`${k}Due`] === null || b[`${k}Paid`] === null
        ? null
        : Math.max(0, Math.round((b[`${k}Due`]! - b[`${k}Paid`]!) * 100) / 100),
    ),
  );
}
export function monthly(ops: Operations, plan: Plan, month: string) {
  const ids = new Set(plan.elements.map((e) => e.id));
  const bills = ops.bills.filter(
    (b) => b.month === month && ids.has(b.spaceId),
  );
  return {
    bills,
    ...Object.fromEntries(
      financialFields.map((k) => [k, sumKnown(bills.map((b) => b[k]))]),
    ),
    balance: sumKnown(bills.map(balance)),
  } as { bills: Bill[]; balance: number | null } & Record<
    FinancialField,
    number | null
  >;
}
export function validateOperations(input: unknown): Operations {
  const source = input as Operations;
  const o = source && !Array.isArray(source.tenders)
    ? { ...source, tenders: [] }
    : source;
  if (
    !o ||
    o.schemaVersion !== 1 ||
    !Array.isArray(o.bills) ||
    !Array.isArray(o.parking) ||
    !Array.isArray(o.pipes) ||
    !Array.isArray(o.tenders) ||
    o.bills.length > 100000 ||
    o.parking.length > 20000 ||
    o.pipes.length > 5000 ||
    o.tenders.length > 5000
  )
    throw Error('运营台账格式无效');
  const text = (v: unknown, n = 5000) => typeof v === 'string' && v.length <= n;
  const num = (v: unknown) =>
    v === null ||
    (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12);
  const date = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const seen = new Set();
  for (const b of o.bills) {
    if (
      !b ||
      !text(b.spaceId, 200) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) ||
      !text(b.notes) ||
      !text(b.updatedAt, 100) ||
      !(b.dueDate === '' || date(b.dueDate)) ||
      financialFields.some((k) => !num(b[k]))
    )
      throw Error('账单包含无效日期或金额');
    const key = `${b.spaceId}:${b.month}`;
    if (seen.has(key)) throw Error('同一区域同月存在重复账单');
    seen.add(key);
    for (const k of ['rent', 'water', 'power'] as const) {
      if (
        b[`${k}Paid`] !== null &&
        (b[`${k}Due`] === null || b[`${k}Paid`]! > b[`${k}Due`]!)
      )
        throw Error('实收金额需填写应收金额，且不能超过应收；预收款请另记');
    }
  }
  seen.clear();
  for (const p of o.parking) {
    if (
      !p ||
      !date(p.date) ||
      p.income === null ||
      !num(p.income) ||
      !num(p.vehicles) ||
      (p.vehicles !== null && !Number.isInteger(p.vehicles)) ||
      !text(p.notes) ||
      !text(p.updatedAt, 100) ||
      seen.has(p.date)
    )
      throw Error('停车日报无效或日期重复');
    seen.add(p.date);
  }
  seen.clear();
  for (const p of o.pipes) {
    if (
      !p ||
      !text(p.id, 200) ||
      seen.has(p.id) ||
      !text(p.name, 120) ||
      !text(p.notes) ||
      !['water', 'power'].includes(p.kind) ||
      !Array.isArray(p.points) ||
      p.points.length < 2 ||
      p.points.length > 2000 ||
      p.points.some(
        (pt) =>
          !pt ||
          !Number.isFinite(pt.x) ||
          !Number.isFinite(pt.y) ||
          Math.abs(pt.x) > 1e6 ||
          Math.abs(pt.y) > 1e6,
      )
    )
      throw Error('管线数据无效');
    seen.add(p.id);
  }
  seen.clear();
  for (const tender of o.tenders) {
    if (
      !tender ||
      !text(tender.id, 200) ||
      seen.has(tender.id) ||
      !text(tender.title, 200) ||
      !tender.title.trim() ||
      !text(tender.spaceId, 200) ||
      !text(tender.description) ||
      !text(tender.requirements) ||
      !(tender.deadline === '' || date(tender.deadline)) ||
      !(tender.desiredStartDate === '' || date(tender.desiredStartDate)) ||
      !['征集中', '评审中', '已定标', '已结束'].includes(tender.status) ||
      !Array.isArray(tender.images) ||
      tender.images.length > 6 ||
      tender.images.some(
        (image) =>
          !image ||
          !text(image.name, 200) ||
          typeof image.dataUrl !== 'string' ||
          image.dataUrl.length > 1500000 ||
          !/^data:image\/(jpeg|png|webp);base64,/.test(image.dataUrl),
      ) ||
      !Array.isArray(tender.quotes) ||
      tender.quotes.length > 100 ||
      !text(tender.createdAt, 100) ||
      !text(tender.updatedAt, 100)
    )
      throw Error('修缮招标数据无效');
    seen.add(tender.id);
    const quoteIds = new Set<string>();
    for (const quote of tender.quotes) {
      if (
        !quote ||
        !text(quote.id, 200) ||
        quoteIds.has(quote.id) ||
        !text(quote.contractor, 200) ||
        !quote.contractor.trim() ||
        !num(quote.amount) ||
        !num(quote.durationDays) ||
        !Number.isInteger(quote.durationDays) ||
        quote.durationDays < 1 ||
        !(quote.startDate === '' || date(quote.startDate)) ||
        !text(quote.notes) ||
        !['待评审', '已中标', '未中标'].includes(quote.status)
      )
        throw Error('承包商报价数据无效');
      quoteIds.add(quote.id);
    }
  }
  return structuredClone(o);
}
export const businessColors: Record<string, string> = {
  宠物: '#aa7deb',
  运动: '#388ad5',
  餐饮: '#ed9960',
  办公室: '#6284ba',
  仓库: '#99a4b2',
  汽车: '#41aca2',
  花店: '#88b96b',
};
export const statusColors: Record<string, string> = {
  已出租: '#37b69b',
  空置: '#e3ae55',
  自用: '#6c9cce',
  维修中: '#d67383',
  待规划: '#99a6b7',
};
export type MapView =
  | 'business'
  | 'status'
  | 'rent'
  | 'water'
  | 'power'
  | 'utilities';
export function mapMetric(
  s: Space,
  b: Bill | undefined,
  view: MapView,
): number | null {
  return view === 'rent' && isRentable(s)
    ? s.rent
    : view === 'water'
      ? (b?.waterDue ?? null)
      : view === 'power'
        ? (b?.powerDue ?? null)
        : null;
}
export function heat(
  value: number | null,
  max: number,
  kind: 'water' | 'power' | 'rent',
) {
  if (value === null) return '#dce3ea';
  const t = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return kind === 'water'
    ? `hsl(203 70% ${91 - t * 53}%)`
    : kind === 'power'
      ? `hsl(32 85% ${91 - t * 48}%)`
      : `hsl(163 49% ${90 - t * 55}%)`;
}
