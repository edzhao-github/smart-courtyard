'use client';
import { useMeterTariff } from '@/lib/use-meter-tariff';
import { migrateOfficeTariff } from '@/lib/plan-migrations';
import { useState, useEffect, useRef } from 'react';
import {
  Map,
  ArrowUpRight,
  Download,
  Upload,
  Plus,
  Minus,
  Move,
  Maximize2,
  Minimize2,
  Droplets,
  Zap,
  Car,
  Building2,
  Wallet,
  ChevronRight,
  X,
  Save,
  Route,
  Undo2,
  Trash2,
  BriefcaseBusiness,
  Image as ImageIcon,
  Trophy,
  Clock3,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { blank, validatePlan, names, type Plan, type Space } from '@/lib/plan';
import { layoutLabel } from '@/lib/label-layout';
import {
  PLAN_KEY,
  OPS_KEY,
  emptyOperations,
  blankBill,
  dateLocal,
  financialFields,
  validateOperations,
  monthly,
  balance,
  isRentable,
  sumKnown,
  businessColors,
  statusColors,
  mapMetric,
  heat,
  type Bill,
  type Operations,
  type FinancialField,
  type MapView,
  type RepairTender,
  type TenderQuote,
} from '@/lib/operations';
import './dashboard.css';
import { RoomFeeCards } from '@/components/room-fee-cards';
import { BillHistory } from '@/components/bill-history';
import { syncMeterLedger, type MeterSnapshot } from '@/lib/meter-ledger';
import { calculateMeterCharge, type Tariff } from '@/lib/meter-billing';
import { MeterPanel } from '@/components/meter-panel';
const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '未录入'
    : `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const number = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const viewNames: Record<MapView, string> = {
  business: '业态分布',
  status: '出租状态',
  rent: '月租金',
  water: '月水费',
  power: '月电费',
  utilities: '水电管线',
};
const sections: Record<string, { title: string; description: string }> = {
  overview: { title: '园区总览', description: '查看空间分布、收款进度与待处理事项。' },
  ledger: { title: '区域台账', description: '按区域管理每月租金、水电用量与收款记录。' },
  pipes: { title: '水电管线', description: '查看园区管线路线与配套设施。' },
  tenders: { title: '修缮招标', description: '管理修缮需求，比较报价并跟进中标结果。' },
};
const blankTender = (): RepairTender => ({
  id: '', title: '', spaceId: '', description: '', requirements: '',
  deadline: '', desiredStartDate: '', status: '征集中', images: [], quotes: [],
  createdAt: '', updatedAt: '',
});
const blankQuote = (): TenderQuote => ({
  id: '', contractor: '', amount: 0, durationDays: 1, startDate: '',
  notes: '', status: '待评审',
});
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue>{options.find(([key]) => key === value)?.[1] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, t]) => (
          <SelectItem key={v} value={v}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Dashboard() {
  const [plan, setPlan] = useState<Plan>(blank),
    [ops, setOps] = useState<Operations>(emptyOperations),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(''),
    [view, setView] = useState<MapView>('business'),
    [month, setMonth] = useState(dateLocal().slice(0, 7)),
    [day, setDay] = useState(dateLocal()),
    [selected, setSelected] = useState(''),
    [query, setQuery] = useState(''),
    [areaListOpen, setAreaListOpen] = useState(true),
    [areaFilter, setAreaFilter] = useState('all'),
    [business, setBusiness] = useState('all'),
    [status, setStatus] = useState('all'),
    [notice, setNotice] = useState(''),
    [large, setLarge] = useState(false),
    [tab, setTab] = useState('overview'),
    [billOpen, setBillOpen] = useState(false),
    [billCategory, setBillCategory] = useState('rent'),
    [billView, setBillView] = useState('edit'),
    [meterBillMessage, setMeterBillMessage] = useState(''),
    [meterBillLoading, setMeterBillLoading] = useState(false),
    [parkingOpen, setParkingOpen] = useState(false),
    [bill, setBill] = useState<Bill>(blankBill('', month)),
    [income, setIncome] = useState(''),
    [vehicles, setVehicles] = useState(''),
    [parkingNotes, setParkingNotes] = useState(''),
    [formError, setFormError] = useState(''),
    [pipeMode, setPipeMode] = useState<null | 'water' | 'power'>(null),
    [pipePoints, setPipePoints] = useState<{ x: number; y: number }[]>([]),
    [pipeName, setPipeName] = useState(''),
    [pipeCursor, setPipeCursor] = useState<{ x: number; y: number } | null>(
      null,
    ),
    [pipeFilter, setPipeFilter] = useState('all'),
    [tenderOpen, setTenderOpen] = useState(false),
    [quoteOpen, setQuoteOpen] = useState(false),
    [tender, setTender] = useState<RepairTender>(blankTender),
    [quoteTenderId, setQuoteTenderId] = useState(''),
    [quote, setQuote] = useState<TenderQuote>(blankQuote),
    [quoteDetail, setQuoteDetail] = useState<{ tender: RepairTender; quote: TenderQuote } | null>(null),
    [imagePreview, setImagePreview] = useState<{ images: RepairTender['images']; index: number } | null>(null),
    [imageZoom, setImageZoom] = useState(1);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);
  const tariffSyncMessage = useMeterTariff(plan, ready);
  const snapshot = useRef({ plan, ops });
  snapshot.current = { plan, ops };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_park_operating_summary',
            title: '读取园区经营汇总',
            description:
              '按月份读取当前浏览器园区的已录入应收实收、用量与记录覆盖情况；空值代表未知，不是零。',
            inputSchema: {
              type: 'object',
              properties: {
                month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
              },
              required: ['month'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              const m = (input as { month?: unknown })?.month;
              if (typeof m !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m))
                throw Error('月份格式必须为 YYYY-MM');
              const { plan, ops } = snapshot.current;
              const r = monthly(ops, plan, m);
              return {
                ...r,
                recordedRegions: r.bills.length,
                parkName: plan.name,
                source: 'manual-browser-local',
                bills: undefined,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const svg = useRef<SVGSVGElement>(null),
    container = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      origin: { x: number; y: number };
      moved: boolean;
    } | null>(null);
  const [size, setSize] = useState({ w: 1100, h: 690 }),
    [scale, setScale] = useState(6),
    [origin, setOrigin] = useState({ x: 0, y: 0 });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (raw) setPlan(migrateOfficeTariff(validatePlan(JSON.parse(raw))));
      const saved = localStorage.getItem(OPS_KEY);
      if (saved) setOps(validateOperations(JSON.parse(saved)));
    } catch {
      setStorageError('本地数据读取失败，请保留原备份并重新导入。');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    const observe = new ResizeObserver(([e]) =>
      e.contentRect.width > 0 && e.contentRect.height > 0 &&
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    if (svg.current) observe.observe(svg.current);
    return () => observe.disconnect();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  function persist(next: Operations) {
    try {
      const checked = validateOperations(next);
      localStorage.setItem(OPS_KEY, JSON.stringify(checked));
      setOps(checked);
      setStorageError('');
      return true;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败');
      setNotice('保存未完成，请检查数据或浏览器存储空间');
      return false;
    }
  }
  const spaces = plan.elements.filter((e) => e.kind !== 'line'),
    rentables = spaces.filter(isRentable),
    visible = spaces.filter(
      (e) =>
        (business === 'all' || e.business === business) &&
        (status === 'all' || e.status === status) &&
        (!query.trim() || `${e.name} ${e.tenant}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) &&
        (tab !== 'overview' || areaFilter === 'all' || (areaFilter === 'unpaid'
          ? (balance(ops.bills.find((b) => b.spaceId === e.id && b.month === month) || blankBill(e.id, month)) ?? 0) > 0
          : e.status === areaFilter)),
    ),
    ids = new Set(visible.map((e) => e.id));
  const summary = monthly(ops, plan, month),
    billMap = new globalThis.Map(summary.bills.map((b) => [b.spaceId, b])),
    item = spaces.find((e) => e.id === selected),
    itemBill = item ? billMap.get(item.id) : undefined;
  const rented = rentables.filter((e) => e.status === '已出租').length,
    occupancy = rentables.length
      ? Math.round((rented / rentables.length) * 100)
      : null,
    parkingToday = ops.parking.find((p) => p.date === day),
    parkingMonth = ops.parking.filter((p) => p.date.startsWith(month));
  const metricMax = Math.max(
    0,
    ...visible.map((e) => mapMetric(e, billMap.get(e.id), view) ?? 0),
  );
  const businesses = Array.from(
    new Set(spaces.map((e) => e.business || '未设置')),
  ).sort();
  const overdue = summary.bills.filter(
    (b) => b.dueDate && b.dueDate < dateLocal() && (balance(b) ?? 0) > 0,
  );
  const missing = rentables.filter((e) => !billMap.has(e.id));
  const totalDue = sumKnown([
      summary.rentDue,
      summary.waterDue,
      summary.powerDue,
      summary.propertyDue,
    ]),
    totalPaid = sumKnown([
      summary.rentPaid,
      summary.waterPaid,
      summary.powerPaid,
      summary.propertyPaid,
    ]);
  function fit(targets = plan.elements) {
    if (!targets.length) return;
    const points = targets.flatMap((e) => {
      const a = (e.rotation * Math.PI) / 180;
      return [
        [0, 0],
        [e.width, 0],
        [e.width, e.height],
        [0, e.height],
      ].map(([x, y]) => ({
        x: e.x + x * Math.cos(a) - y * Math.sin(a),
        y: e.y + x * Math.sin(a) + y * Math.cos(a),
      }));
    });
    const x0 = Math.min(...points.map((p) => p.x)),
      x1 = Math.max(...points.map((p) => p.x)),
      y0 = Math.min(...points.map((p) => p.y)),
      y1 = Math.max(...points.map((p) => p.y));
    const s = Math.max(
      0.01,
      Math.min((size.w - 65) / (targets.length === 1 ? Math.max((x1 - x0) * 3, 60) : x1 - x0 || 1), (size.h - 90) / (targets.length === 1 ? Math.max((y1 - y0) * 3, 45) : y1 - y0 || 1)),
    );
    setScale(s);
    setOrigin({ x: (x0 + x1 - size.w / s) / 2, y: (y0 + y1 - size.h / s) / 2 });
  }
  useEffect(() => {
    if (ready) fit(item ? [item] : plan.elements);
  }, [ready, plan, size.w, size.h, selected]);
  function zoom(f: number, px = size.w / 2, py = size.h / 2) {
    const next = Math.max(0.01, Math.min(100, scale * f));
    setOrigin({
      x: origin.x + px / scale - px / next,
      y: origin.y + py / scale - py / next,
    });
    setScale(next);
  }
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(
        Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * 0.002),
        e.clientX - r.left,
        e.clientY - r.top,
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [scale, origin, size]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPipeMode(null);
        setPipePoints([]);
        setLarge(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const reload = () => {
      try { const raw = localStorage.getItem(PLAN_KEY); if (raw) setPlan(validatePlan(JSON.parse(raw))); } catch { /* Keep the current valid plan. */ }
    };
    window.addEventListener('focus', reload);
    window.addEventListener('storage', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('storage', reload); };
  }, []);
  const billSpace = spaces.find((space) => space.id === bill.spaceId);
  const automaticPower = billSpace?.name.trim() === '研发办公室';
  useEffect(() => {
    setMeterBillMessage('');
    if (!billOpen || billCategory !== 'power' || billSpace?.name.trim() !== '研发办公室') return;
    const saved = ops.bills.find((entry) => entry.spaceId === bill.spaceId && entry.month === bill.month);
    if (bill.month !== dateLocal().slice(0, 7)) {
      setMeterBillMessage('历史账单保留原记录，不使用今天的读数重新计算。'); return;
    }
    let active = true;
    setMeterBillLoading(true);
    void (async () => {
      try {
        const response = await fetch('/api/meter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: '研发办公室', pricePerKwh: billSpace.electricityRate }) });
        const meter = await response.json() as { address: string; warning?: string; readings: {at: string; kwh: number}[];
          billing?: { startKwh: number; tariffs: Tariff[]; amount: number | null; warning?: string }; error?: string };
        if (!response.ok || !meter.billing || meter.billing.amount === null || meter.warning || meter.billing.warning) throw Error(meter.error || '电表数据暂不可用，请核对读数后填写。');
        const latest = meter.readings[meter.readings.length - 1];
        const otherBills = ops.bills.filter((entry) => !(entry.spaceId === bill.spaceId && entry.month === bill.month));
        const recorded = otherBills.filter((entry) => entry.powerMeter?.address === meter.address);
        if (otherBills.some((entry) => entry.spaceId === bill.spaceId && !entry.powerMeter && ((entry.powerDue ?? 0) > 0 || (entry.powerUsage ?? 0) > 0))) throw Error('历史电费缺少结算读数，自动计费暂不可用；现有金额保持不变。');
        if (saved?.powerMeter && recorded.some((entry) => entry.powerMeter!.startKwh >= saved.powerMeter!.endKwh)) {
          if (active) setMeterBillMessage('后续已有电表账单，这笔账单保留原读数和费用。'); return;
        }
        const start = saved?.powerMeter?.startKwh ?? Math.max(meter.billing.startKwh, ...recorded.map((entry) => entry.powerMeter!.endKwh));
        if (!latest || latest.kwh < start) throw Error('当前读数低于已记账读数，请核对电表。');
        const startCharge = calculateMeterCharge(start, meter.billing.tariffs);
        if (startCharge === null) throw Error('电价分段记录无效');
        const usage = Math.round((latest.kwh - start) * 1000) / 1000;
        const amount = Math.round((meter.billing.amount - startCharge) * 100) / 100;
        if (!active) return;
        setBill((current) => ({ ...current, powerUsage: usage, powerDue: amount,
          powerMeter: { address: meter.address, startKwh: start, endKwh: latest.kwh, readingAt: latest.at } }));
        setMeterBillMessage(`已自动读取 ${usage} 度，电费 ${amount.toFixed(2)} 元 · 抄表 ${latest.at}`);
      } catch (error) { if (active) setMeterBillMessage((error as Error).message); }
      finally { if (active) setMeterBillLoading(false); }
    })();
    return () => { active = false; setMeterBillLoading(false); };
  }, [billOpen, billCategory, bill.spaceId, bill.month]);
  useEffect(() => {
    if (!billOpen || billCategory !== 'power') return;
    const updated = ops.bills.find((entry) => entry.spaceId === bill.spaceId && entry.month === bill.month);
    if (!updated?.powerMeter) return;
    setBill((draft) => !draft.powerMeter || updated.powerMeter!.readingAt > draft.powerMeter.readingAt
      ? { ...draft, powerDue: updated.powerDue, powerUsage: updated.powerUsage, powerMeter: updated.powerMeter }
      : draft);
  }, [ops, billOpen, billCategory, bill.spaceId, bill.month]);
  const rentEnd = (() => {
    const [year, m] = (bill.rentStartMonth || bill.month).split('-').map(Number);
    const end = new Date(year, m - 1 + (bill.rentMonths || 1) - 1, 1);
    return dateLocal(end).slice(0, 7);
  })();
  const billIssues = (['rent', 'water', 'power', 'property'] as const).flatMap((key) => {
    const due = bill[`${key}Due`], paid = bill[`${key}Paid`];
    const title = { rent: '房租', water: '水费', power: '电费', property: '物业费' }[key];
    return paid !== null && (due === null || paid > due)
      ? [`${title}：请填写应收金额，且实收不能超过应收。`] : [];
  });
  function discardBillDraft() {
    const saved = ops.bills.find((entry) => entry.spaceId === bill.spaceId && entry.month === bill.month)
      || blankBill(bill.spaceId, bill.month);
    const changed = financialFields.some((key) => bill[key] !== saved[key])
      || bill.notes !== saved.notes || bill.dueDate !== saved.dueDate
      || bill.rentMonths !== saved.rentMonths || bill.rentStartMonth !== saved.rentStartMonth;
    return !changed || window.confirm('这份账单有未保存的修改。放弃修改并继续？');
  }
  function closeBill() {
    if (discardBillDraft()) setBillOpen(false);
  }
  function openBill(
    spaceId = item?.id || rentables[0]?.id || spaces[0]?.id || '',
    category = 'rent',
    targetMonth = month,
  ) {
    setBill(
      structuredClone(
        ops.bills.find((b) => b.spaceId === spaceId && b.month === targetMonth) ||
          blankBill(spaceId, targetMonth),
      ),
    );
    setFormError('');
    setBillCategory(category);
    setBillView('edit');
    setBillOpen(true);
  }
  function replaceBill(spaceId: string, m: string) {
    if (!discardBillDraft()) return false;
    setBill(
      structuredClone(
        ops.bills.find((b) => b.spaceId === spaceId && b.month === m) ||
          blankBill(spaceId, m),
      ),
    );
    setFormError('');
    return true;
  }
  function submitBill(e: React.FormEvent) {
    e.preventDefault();
    if (!spaces.some((s) => s.id === bill.spaceId)) {
      setFormError('请选择区域');
      return;
    }
    if (financialFields.every((k) => bill[k] === null)) {
      setFormError('至少录入一项用量或金额；0 与未录入不同');
      return;
    }
    if (meterBillLoading) { setFormError('正在读取电表，请稍后保存'); return; }
    if (billIssues.length) { setFormError(billIssues.join(' ')); return; }
    const previous = ops.bills.find((entry) => entry.spaceId === bill.spaceId && entry.month === bill.month);
    const paidBefore = previous?.powerPaid ?? 0;
    const delta = (bill.powerPaid ?? 0) - paidBefore;
    const receipts = [...(previous?.powerReceipts || [])];
    if (!receipts.length && paidBefore > 0) receipts.push({ amount: paidBefore, at: previous?.updatedAt || '', kind: 'opening' as const });
    if (delta !== 0) receipts.push({ amount: delta, at: new Date().toISOString(), kind: 'payment' as const });
    const next = { ...bill, ...(receipts.length ? { powerReceipts: receipts } : {}), updatedAt: new Date().toISOString() };
    if (
      persist({
        ...ops,
        bills: [
          ...ops.bills.filter(
            (b) => !(b.spaceId === next.spaceId && b.month === next.month),
          ),
          next,
        ],
      })
    ) {
      setBillOpen(false);
      setNotice('月度台账已保存');
    }
  }
  function openParking() {
    setIncome(parkingToday ? String(parkingToday.income) : '');
    setVehicles(
      parkingToday?.vehicles != null ? String(parkingToday.vehicles) : '',
    );
    setParkingNotes(parkingToday?.notes || '');
    setFormError('');
    setParkingOpen(true);
  }
  function changeParkingDate(d: string) {
    setDay(d);
    const p = ops.parking.find((p) => p.date === d);
    setIncome(p ? String(p.income) : '');
    setVehicles(p?.vehicles != null ? String(p.vehicles) : '');
    setParkingNotes(p?.notes || '');
  }
  function submitParking(e: React.FormEvent) {
    e.preventDefault();
    if (income === '') {
      setFormError('请填写当日停车实收收入，无收入请填 0');
      return;
    }
    if (
      persist({
        ...ops,
        parking: [
          ...ops.parking.filter((p) => p.date !== day),
          {
            date: day,
            income: Number(income),
            vehicles: vehicles === '' ? null : Number(vehicles),
            notes: parkingNotes,
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    ) {
      setParkingOpen(false);
      setNotice('停车日报已保存');
    }
  }
  function openTender(existing?: RepairTender) {
    setTender(structuredClone(existing || { ...blankTender(), spaceId: selected || spaces[0]?.id || '' }));
    setFormError('');
    setTenderOpen(true);
  }
  function submitTender(e: React.FormEvent) {
    e.preventDefault();
    if (!tender.title.trim()) return setFormError('请填写招标项目名称');
    if (!spaces.some((s) => s.id === tender.spaceId)) return setFormError('请选择需要修缮的房屋或区域');
    if (!tender.description.trim()) return setFormError('请填写修缮基础信息');
    const now = new Date().toISOString();
    const next = {
      ...tender,
      id: tender.id || crypto.randomUUID(),
      title: tender.title.trim(),
      createdAt: tender.createdAt || now,
      updatedAt: now,
    };
    if (persist({
      ...ops,
      tenders: [...ops.tenders.filter((item) => item.id !== next.id), next],
    })) {
      setTenderOpen(false);
      setTab('tenders');
      setNotice(tender.id ? '招标项目已更新' : '招标项目已创建，可以开始录入报价');
    }
  }
  async function addTenderImages(files: FileList | null) {
    if (!files?.length) return;
    const available = 6 - tender.images.length;
    const picked = Array.from(files).slice(0, available);
    try {
      const images = await Promise.all(picked.map((f) => new Promise<{ name: string; dataUrl: string }>((resolve, reject) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return reject(Error('图片仅支持 JPG、PNG 或 WebP'));
        if (f.size > 1024 * 1024) return reject(Error(`${f.name} 超过 1MB，请压缩后上传`));
        const reader = new FileReader();
        reader.onload = () => resolve({ name: f.name, dataUrl: String(reader.result) });
        reader.onerror = () => reject(Error('图片读取失败'));
        reader.readAsDataURL(f);
      })));
      setTender((current) => ({ ...current, images: [...current.images, ...images] }));
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '图片上传失败');
    }
  }
  function openQuote(tenderId: string, existing?: TenderQuote) {
    setQuoteTenderId(tenderId);
    setQuote(structuredClone(existing || blankQuote()));
    setFormError('');
    setQuoteOpen(true);
  }
  function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!quote.contractor.trim()) return setFormError('请填写承包商名称');
    if (!(quote.amount >= 0)) return setFormError('请填写有效报价');
    if (!Number.isInteger(quote.durationDays) || quote.durationDays < 1) return setFormError('工期需为至少 1 天的整数');
    const target = ops.tenders.find((item) => item.id === quoteTenderId);
    if (!target) return setFormError('招标项目不存在');
    const nextQuote = { ...quote, id: quote.id || crypto.randomUUID(), contractor: quote.contractor.trim() };
    const nextTender = {
      ...target,
      status: (target.status === '征集中' ? '评审中' : target.status) as RepairTender['status'],
      quotes: [...target.quotes.filter((item) => item.id !== nextQuote.id), nextQuote],
      updatedAt: new Date().toISOString(),
    };
    if (persist({ ...ops, tenders: ops.tenders.map((item) => item.id === target.id ? nextTender : item) })) {
      setQuoteOpen(false);
      setNotice(quote.id ? '报价已更新' : '承包商报价已录入');
    }
  }
  function awardQuote(tenderId: string, quoteId: string) {
    const next = ops.tenders.map((item) => item.id !== tenderId ? item : ({
      ...item,
      status: '已定标' as const,
      quotes: item.quotes.map((entry) => ({ ...entry, status: entry.id === quoteId ? '已中标' as const : '未中标' as const })),
      updatedAt: new Date().toISOString(),
    }));
    if (persist({ ...ops, tenders: next })) setNotice('已完成定标并标记中标方');
  }
  async function importData(f: File) {
    try {
      if (f.size > 20 * 1024 * 1024) throw Error('文件不能超过20MB');
      const data = JSON.parse(await f.text());
      const nextPlan = validatePlan(data.plan || data),
        nextOps = data.operations ? validateOperations(data.operations) : ops;
      const oldPlan = localStorage.getItem(PLAN_KEY),
        oldOps = localStorage.getItem(OPS_KEY);
      try {
        localStorage.setItem(PLAN_KEY, JSON.stringify(nextPlan));
        localStorage.setItem(OPS_KEY, JSON.stringify(nextOps));
      } catch (e) {
        if (oldPlan !== null) localStorage.setItem(PLAN_KEY, oldPlan);
        else localStorage.removeItem(PLAN_KEY);
        if (oldOps !== null) localStorage.setItem(OPS_KEY, oldOps);
        throw e;
      }
      setPlan(nextPlan);
      setOps(nextOps);
      setSelected('');
      setNotice('导入完成；原有不同编号的台账仍保留，汇总只统计当前图纸');
      setStorageError('');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导入失败');
    }
  }
  function savePipe() {
    if (!pipeMode || pipePoints.length < 2) {
      setNotice('请至少标记两个管线节点');
      return;
    }
    if (
      persist({
        ...ops,
        pipes: [
          ...ops.pipes,
          {
            id: crypto.randomUUID(),
            kind: pipeMode,
            name:
              pipeName.trim() ||
              `${pipeMode === 'water' ? '供水' : '供电'}管线 ${ops.pipes.length + 1}`,
            points: pipePoints,
            notes: '手动标注路线，需现场核验',
          },
        ],
      })
    ) {
      setPipeMode(null);
      setPipePoints([]);
      setNotice('管线已保存');
    }
  }
  function color(e: Space) {
    if (view === 'business') return businessColors[e.business] || '#a8b3c4';
    if (view === 'status') return statusColors[e.status] || '#a8b3c4';
    if (view === 'utilities')
      return e.water && e.electricity
        ? '#55b79b'
        : e.water
          ? '#62a5d6'
          : e.electricity
            ? '#e5ad53'
            : '#c6d0dc';
    return heat(mapMetric(e, billMap.get(e.id), view), metricMax, view);
  }
  const pipeList = ops.pipes.filter(
    (p) => pipeFilter === 'all' || p.kind === pipeFilter,
  );
  return (
    <div className={`manager ${large ? 'manager-large' : ''}`}>
      <header className="manager-header">
        <div className="manager-brand">
          <span>
            <Map size={23} />
          </span>
          <div>
            <b>
              园境 <em>OPERATIONS</em>
            </b>
            <small>园区运营管理平台</small>
          </div>
        </div>
        <nav>
          <a className="current" href="/dashboard">
            管理驾驶舱
          </a>
          <a href="/">
            图纸编辑器 <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="manager-head-actions">
          <button onClick={() => file.current?.click()}>
            <Upload size={15} />
            导入图纸 / 备份
          </button>
          <button
            onClick={() =>
              saveFile(`${plan.name}-运营备份.json`, { plan, operations: ops })
            }
          >
            <Download size={15} />
            备份
          </button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json"
          onChange={(e) => {
            if (e.target.files?.[0]) void importData(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </header>
      <main className={`manager-body module-${tab}`}>
        <Tabs value={tab} onValueChange={(v) => { setTab(String(v)); setLarge(false); }} className="module-navigation">
          <TabsList aria-label="运营业务导航">
            <TabsTrigger value="overview"><Map size={17} />园区总览</TabsTrigger>
            <TabsTrigger value="ledger"><Wallet size={17} />区域台账</TabsTrigger>
            <TabsTrigger value="pipes"><Route size={17} />水电管线</TabsTrigger>
            <TabsTrigger value="tenders"><BriefcaseBusiness size={17} />修缮招标</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="manager-title">
          <div>
            <div className="manager-eyebrow">{plan.name}</div>
            <h1>
              {sections[tab].title}
            </h1>
            <p>{sections[tab].description}</p>
          </div>
          <div className="manager-period">
            <label>
              账期
              <input
                aria-label="账期"
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
            {(tab === 'overview' || tab === 'ledger') && <button
              className="primary"
              disabled={!spaces.length}
              onClick={() => openBill()}
            >
              <Plus size={17} />
              录入月度台账
            </button>}
          </div>
        </div>
        <div className="manager-data-note">
          <span className="local-status">本机保存</span>
          <span>图纸与收款保存在本机 · 研发办公室已接入电表</span>
          {storageError && <strong>{storageError}</strong>}
          {tariffSyncMessage && <strong role="alert">{tariffSyncMessage}</strong>}
        </div>
        <section className={`manager-workspace ${item ? 'has-selection' : ''}`}>
          <div className="manager-map-panel" ref={container}>
            <div className="manager-map-heading">
              <div>
                <h2>
                  园区空间总览{' '}
                  <span>
                    {visible.length} / {spaces.length} 个区域
                  </span>
                </h2>
                <p>
                  {view === 'water' || view === 'power'
                    ? `${month} 应收费用，颜色越深金额越高`
                    : view === 'rent'
                      ? '图纸配置的区域月租金，非实收收入'
                      : view === 'utilities'
                        ? '配套接入状态 + 手动标注管线'
                        : '点击区域查看经营与配套详情'}
                </p>
              </div>
              <button
                aria-label={large ? '退出大屏' : '大屏模式'}
                onClick={() => setLarge(!large)}
              >
                {large ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                {large ? '退出全屏' : '全屏看图'}
              </button>
            </div>
            <Tabs
              value={view}
              onValueChange={(v) => {
                setView(v as MapView);
                setPipeMode(null);
                setPipePoints([]);
              }}
            >
              <TabsList className="manager-map-tabs">
                {Object.entries(viewNames).map(([v, t]) => (
                  <TabsTrigger key={v} value={v}>
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="manager-map-filters">
              <input
                placeholder="搜索区域 / 承租方"
                aria-label="搜索区域或承租方"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Choice
                label="筛选业态"
                value={business}
                onChange={setBusiness}
                options={[
                  ['all', '全部业态'],
                  ...businesses.map((v) => [v, v] as [string, string]),
                ]}
              />
              <Choice
                label="筛选出租状态"
                value={status}
                onChange={setStatus}
                options={[
                  ['all', '全部状态'],
                  ...Array.from(new Set(spaces.map((e) => e.status))).map(
                    (v) => [v, v] as [string, string],
                  ),
                ]}
              />
              {(business !== 'all' || status !== 'all' || query || areaFilter !== 'all') && (
                <button
                  onClick={() => {
                    setBusiness('all');
                    setStatus('all');
                    setQuery(''); setAreaFilter('all');
                  }}
                >
                  清除
                </button>
              )}
            </div>
            {view === 'utilities' && (
              <div className="pipe-tools">
                <Choice
                  label="管线类型"
                  value={pipeFilter}
                  onChange={setPipeFilter}
                  options={[
                    ['all', '全部管线'],
                    ['water', '供水管线'],
                    ['power', '供电管线'],
                  ]}
                />
              </div>
            )}
            <div className="area-navigation">
              <button aria-expanded={areaListOpen} aria-controls="park-area-list" onClick={() => setAreaListOpen(!areaListOpen)}>{areaListOpen ? '收起区域列表' : '展开区域列表'}</button>
              <div role="group" aria-label="区域快捷筛选">
                {[['all', '全部'], ['空置', '空置'], ['已出租', '已出租'], ['unpaid', '待收款']].map(([value, label]) =>
                  <button key={value} aria-pressed={areaFilter === value} onClick={() => { setAreaFilter(value); setStatus('all'); }}>{label}</button>)}
              </div>
              <span>{visible.length} 个区域{areaFilter === 'unpaid' ? ` · ${month} 已知待收大于零` : ''}</span>
            </div>
            <div className={`map-and-list ${areaListOpen ? 'list-open' : ''}`}>
              {areaListOpen && <aside className="area-list" id="park-area-list" aria-label="园区区域列表">
                <p className="area-list-hint">点击区域，地图自动定位</p>
                {visible.map((space) => {
                  const due = billMap.get(space.id);
                  return <button key={space.id} aria-pressed={selected === space.id} onClick={() => { setSelected(space.id); if (selected === space.id) fit([space]); }}>
                    <span className="area-list-name">{space.name}<ChevronRight size={15} /></span>
                    <span className="area-list-meta">{space.status} · {space.business}</span>
                    <span className="area-list-tenant">{space.tenant || '未设置承租方'}</span>
                    {due && (balance(due) ?? 0) > 0 && <span className="area-list-due">待收 {money(balance(due))}</span>}
                  </button>;
                })}
                {!visible.length && <p className="area-list-empty">{spaces.length ? '没有匹配区域，请调整搜索或筛选条件。' : '导入图纸后，这里会显示区域列表。'}</p>}
              </aside>}
            <div className="manager-map-canvas">
              <svg
                ref={svg}
                viewBox={`${origin.x} ${origin.y} ${size.w / scale} ${size.h / scale}`}
                aria-label="园区经营分布地图"
                style={{ cursor: pipeMode ? 'crosshair' : 'grab' }}
                onPointerDown={(e) => {
                  if (e.button !== 0 && e.button !== 1) return;
                  if (pipeMode && e.button === 0) {
                    const r = e.currentTarget.getBoundingClientRect();
                    setPipePoints((p) => [
                      ...p,
                      {
                        x: origin.x + (e.clientX - r.left) / scale,
                        y: origin.y + (e.clientY - r.top) / scale,
                      },
                    ]);
                    return;
                  }
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    origin: { ...origin },
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const id = (e.target as Element)
                    .closest('[data-space]')
                    ?.getAttribute('data-space');
                  if (id && !pipeMode) setSelected(id);
                }}
                onPointerLeave={() => setPipeCursor(null)}
                onPointerMove={(e) => {
                  if (pipeMode) {
                    const r = e.currentTarget.getBoundingClientRect();
                    setPipeCursor({
                      x: origin.x + (e.clientX - r.left) / scale,
                      y: origin.y + (e.clientY - r.top) / scale,
                    });
                  }
                  const d = drag.current;
                  if (!d) return;
                  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3)
                    d.moved = true;
                  if (d.moved)
                    setOrigin({
                      x: d.origin.x - (e.clientX - d.x) / scale,
                      y: d.origin.y - (e.clientY - d.y) / scale,
                    });
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onLostPointerCapture={() => (drag.current = null)}
              >
                <defs>
                  <pattern
                    id="manager-grid"
                    width="5"
                    height="5"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="0" cy="0" r={0.65 / scale} fill="#c5d5df" />
                  </pattern>
                </defs>
                <rect
                  x={origin.x}
                  y={origin.y}
                  width={size.w / scale}
                  height={size.h / scale}
                  fill="#f4f7fa"
                />
                <rect
                  x={origin.x}
                  y={origin.y}
                  width={size.w / scale}
                  height={size.h / scale}
                  fill="url(#manager-grid)"
                />
                {plan.elements.map((e) => {
                  if (e.kind === 'line')
                    return (
                      <g
                        key={e.id}
                        transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`}
                      >
                        <line
                          x1={0}
                          y1={0}
                          x2={e.width}
                          y2={e.height}
                          stroke="#a9b5c2"
                          strokeWidth={1.2 / scale}
                        />
                      </g>
                    );
                  const m = mapMetric(e, billMap.get(e.id), view),
                    subtitle = ['water', 'power', 'rent'].includes(view)
                      ? m === null
                        ? '未录入'
                        : money(m)
                      : view === 'business'
                        ? e.business
                        : view === 'status'
                          ? e.status
                          : e.water && e.electricity
                            ? '水电已接入'
                            : e.water
                              ? '已通水'
                              : e.electricity
                                ? '已通电'
                                : '未标接入';
                  const l = layoutLabel(e.name, e.width, e.height, subtitle);
                  const dark =
                    ['water', 'power', 'rent'].includes(view) &&
                    m !== null &&
                    metricMax > 0 &&
                    m / metricMax > 0.65;
                  return (
                    <g
                      key={e.id}
                      data-space={e.id}
                      className="map-building"
                      aria-pressed={selected === e.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`${e.name}，${subtitle}`}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          setSelected(e.id);
                          ev.preventDefault();
                        }
                      }}
                      opacity={ids.has(e.id) ? 1 : 0.14}
                      transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`}
                    >
                      <title>{`${e.name} · ${subtitle}`}</title>
                      <rect
                        width={e.width}
                        height={e.height}
                        rx={0.25}
                        fill={color(e)}
                        stroke="#fff"
                        strokeWidth={1.1 / scale}
                      />
                      <rect
                        className="building-selection-halo"
                        width={e.width}
                        height={e.height}
                        rx={0.25}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={3.5 / scale}
                        pointerEvents="none"
                      />
                      <rect
                        className="building-selection-edge"
                        width={e.width}
                        height={e.height}
                        rx={0.25}
                        fill="none"
                        stroke="#34434a"
                        strokeWidth={1.25 / scale}
                        pointerEvents="none"
                      />
                      <svg
                        x={l.padding}
                        y={l.padding}
                        width={l.innerWidth}
                        height={l.innerHeight}
                        overflow="hidden"
                        pointerEvents="none"
                      >
                        {l.lines.map((line, i) => (
                          <text
                            key={i}
                            x={l.innerWidth / 2}
                            y={line.y}
                            dominantBaseline="central"
                            textAnchor="middle"
                            fontSize={l.font}
                            fill={dark ? 'white' : '#23364a'}
                          >
                            {line.text}
                          </text>
                        ))}
                        <text
                          x={l.innerWidth / 2}
                          y={l.areaY}
                          dominantBaseline="central"
                          textAnchor="middle"
                          fontSize={l.areaFont}
                          fill={dark ? 'white' : '#344960'}
                        >
                          {subtitle}
                        </text>
                      </svg>
                    </g>
                  );
                })}
                {view === 'utilities' &&
                  pipeList.map((p) => (
                    <g key={p.id}>
                      <polyline
                        points={p.points
                          .map((pt) => `${pt.x},${pt.y}`)
                          .join(' ')}
                        fill="none"
                        stroke={p.kind === 'water' ? '#087cc5' : '#f18d22'}
                        strokeWidth={3 / scale}
                        strokeDasharray={
                          p.kind === 'power'
                            ? `${6 / scale} ${3 / scale}`
                            : undefined
                        }
                      >
                        <title>{p.name}</title>
                      </polyline>
                      {p.points.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={3 / scale}
                          fill="white"
                          stroke={p.kind === 'water' ? '#087cc5' : '#f18d22'}
                          strokeWidth={1.5 / scale}
                        />
                      ))}
                    </g>
                  ))}
                {pipeMode && (
                  <g pointerEvents="none">
                    <polyline
                      points={pipePoints
                        .map((pt) => `${pt.x},${pt.y}`)
                        .join(' ')}
                      fill="none"
                      stroke={pipeMode === 'water' ? '#087cc5' : '#f18d22'}
                      strokeWidth={3 / scale}
                    />
                    {pipePoints.length > 0 && pipeCursor && (
                      <line
                        x1={pipePoints[pipePoints.length - 1].x}
                        y1={pipePoints[pipePoints.length - 1].y}
                        x2={pipeCursor.x}
                        y2={pipeCursor.y}
                        stroke={pipeMode === 'water' ? '#087cc5' : '#f18d22'}
                        strokeWidth={2 / scale}
                        strokeDasharray={`${5 / scale} ${4 / scale}`}
                      />
                    )}
                    {pipePoints.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={4 / scale}
                        fill={pipeMode === 'water' ? '#087cc5' : '#f18d22'}
                        stroke="white"
                        strokeWidth={1.5 / scale}
                      />
                    ))}
                  </g>
                )}
              </svg>
              {!spaces.length && (
                <div className="manager-map-empty">
                  <Map size={42} />
                  <h3>载入你已经完成的园区图</h3>
                  <p>同一浏览器会自动读取图纸，也可以导入 JSON。</p>
                  <button onClick={() => file.current?.click()}>
                    导入图纸
                  </button>
                  <a href="/">打开绘图工具</a>
                </div>
              )}
              {pipeMode && (
                <div className="map-instruction">
                  正在绘制
                  {pipeMode === 'water'
                    ? '供水线路（蓝色）'
                    : '供电线路（橙色）'}{' '}
                  · 点击起点和转折点 · 已放置 {pipePoints.length} 个节点 ·
                  点击「保存线路」完成 · 按住鼠标中键平移
                </div>
              )}
              <div className="manager-map-controls">
                <button aria-label="缩小" onClick={() => zoom(0.8)}>
                  <Minus size={15} />
                </button>
                <button aria-label="放大" onClick={() => zoom(1.25)}>
                  <Plus size={15} />
                </button>
                <button
                  title="显示完整园区"
                  aria-label="显示完整园区"
                  onClick={() => fit()}
                >
                  <Move size={16} />适应全图
                </button>
                {item && <button onClick={() => fit([item])}>定位所选区域</button>}
                <span>拖动平移 · 滚轮缩放</span>
              </div>
            </div>
            </div>
            <div className="map-legend">
              {view === 'business' ? (
                businesses.map((b) => (
                  <Legend
                    key={b}
                    color={businessColors[b] || '#a8b3c4'}
                    text={b}
                  />
                ))
              ) : view === 'status' ? (
                Object.entries(statusColors).map(([t, c]) => (
                  <Legend key={t} color={c} text={t} />
                ))
              ) : view === 'utilities' ? (
                <>
                  <Legend color="#55b79b" text="水电均接入" />
                  <Legend color="#62a5d6" text="仅通水" />
                  <Legend color="#e5ad53" text="仅通电" />
                  <Legend color="#c6d0dc" text="未标接入" />
                  <span>实线：水管 · 虚线：电线</span>
                </>
              ) : (
                <>
                  <Legend color="#dce3ea" text="未录入 / 不适用" />
                  <span>¥0</span>
                  <i className={`heat-ramp ${view}`} />
                  <span>{money(metricMax)}</span>
                  <span>按当前可见区域的最大值归一化</span>
                </>
              )}
            </div>
          </div>
          <aside className="manager-insights">
            {item ? (
              <section className="insight-card selected-card">
                <div className="card-heading">
                  <h2>区域详情</h2>
                  <button aria-label="取消选择" onClick={() => setSelected('')}>
                    <X size={16} />
                  </button>
                </div>
                <h3>{item.name}</h3>
                <p className="room-tenant">{item.tenant || '尚未设置承租方'}</p>
                <div className="detail-tags">
                  <span>{names[item.kind]}</span>
                  <span>{item.business}</span>
                  <span>{item.status}</span>
                </div>
                <div className="room-facts">
                  <div><span>空间面积</span><strong>{number(item.width * item.height)}<small> m²</small></strong></div>
                  <div><span>配置月租金</span><strong>{money(item.rent)}</strong></div>
                </div>
                <RoomFeeCards bills={ops.bills.filter((entry) => entry.spaceId === item.id)} month={month} onOpen={(fee, period, history) => { openBill(item.id, fee, period); if (history) setBillView('history'); }} />
                {item.name.trim() === '研发办公室' && <details className="room-device-details"><summary><Zap size={15} />电表与抄表数据</summary>
                <MeterPanel roomName={item.name} bills={ops.bills.filter((entry) => entry.spaceId === item.id)} onReading={(meter: MeterSnapshot) => {
                  const current = snapshot.current.ops;
                  const next = syncMeterLedger(current, item.id, meter, dateLocal().slice(0, 7));
                  if (next !== current) persist(next);
                }} />
                </details>}
                <details className="room-more"><summary>房间资料与配套</summary>
                <dl>
                  <dt>承租方</dt>
                  <dd>{item.tenant || '未设置'}</dd>
                  <dt>图形面积</dt>
                  <dd>{number(item.width * item.height)} m²</dd>
                  <dt>配置月租金</dt>
                  <dd>{money(item.rent)}</dd>
                  <dt>配套接入</dt>
                  <dd>
                    {item.water ? '通水' : '未标通水'} ·{' '}
                    {item.electricity ? '通电' : '未标通电'}
                  </dd>
                  <dt>水 / 电单价</dt>
                  <dd>
                    {item.waterRate} 元/m³ · {item.electricityRate} 元/kWh
                  </dd>
                </dl>
                </details>
                <div className="room-actions">
                  <button className="primary" onClick={() => openBill(item.id)}><Wallet size={16} />记收款 / 编辑账单</button>
                  <button onClick={() => { openBill(item.id); setBillView('history'); }}><Clock3 size={16} />历史记录</button>
                </div>
              </section>
            ) : (
              <section className="insight-card receipt-card">
                <div className="card-heading">
                  <h2>本月收款进度</h2>
                  <span>{month}</span>
                </div>
                <strong>{money(totalPaid)}</strong>
                <p>已收房租、水电及物业费</p>
                <div className="receipt-track">
                  <i
                    style={{
                      width: `${totalDue && totalPaid !== null ? Math.min(100, (totalPaid / totalDue) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="receipt-numbers">
                  <span>
                    已录应收
                    <br />
                    <b>{money(totalDue)}</b>
                  </span>
                  <span>
                    已知待收
                    <br />
                    <b>{money(summary.balance)}</b>
                  </span>
                </div>
                <small>汇总已录入金额，未录入费用不视为 0。</small>
              </section>
            )}
            <section className="insight-card">
              <div className="card-heading">
                <h2>待处理事项</h2>
                <span className="attention-count">
                  {overdue.length + missing.length}
                </span>
              </div>
              <button
                className="attention-row"
                onClick={() => setTab('ledger')}
              >
                <span className="attention-icon overdue">!</span>
                <div>
                  <b>{overdue.length} 个区域有逾期待收</b>
                  <small>按缴费截止日与已知待收计算</small>
                </div>
                <ChevronRight size={15} />
              </button>
              <button
                className="attention-row"
                onClick={() => setTab('ledger')}
              >
                <span className="attention-icon">＋</span>
                <div>
                  <b>{missing.length} 个可租区域待建账</b>
                  <small>本月尚无任何台账记录</small>
                </div>
                <ChevronRight size={15} />
              </button>
              <p className="tiny">
                {summary.bills.length} 个区域已录台账 / {spaces.length}{' '}
                个区域。已录台账也可能有未填费用。
              </p>
            </section>
            <section className="insight-card parking-card">
              <div className="card-heading">
                <h2>
                  <Car size={17} />
                  停车经营
                </h2>
                <button onClick={openParking}>录入</button>
              </div>
              <input
                aria-label="停车收入日期"
                type="date"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
              <div className="parking-total">
                {money(parkingToday?.income)}
                <small>当日实收</small>
              </div>
              <p>
                {month} 累计{' '}
                <b>{money(sumKnown(parkingMonth.map((p) => p.income)))}</b>
              </p>
              <small>已录 {parkingMonth.length} 天 · 不推算未录日期</small>
            </section>
          </aside>
        </section>
        <section className="kpi-grid">
          <KPI
            icon={<Building2 />}
            label="区域出租率"
            value={occupancy === null ? '—' : `${occupancy}%`}
            detail={`${rented} 已出租 / ${rentables.length} 可租区域 · 当前状态`}
          />
          <KPI
            icon={<Wallet />}
            label="本账期应收租金"
            value={money(summary.rentDue)}
            detail={`实收 ${money(summary.rentPaid)} · 以月度台账为准`}
          />
          <KPI
            icon={<Droplets />}
            label="本月应收水费"
            value={money(summary.waterDue)}
            detail={`用量 ${number(summary.waterUsage)} m³ · 实收 ${money(summary.waterPaid)}`}
          />
          <KPI
            icon={<Zap />}
            label="本月应收电费"
            value={money(summary.powerDue)}
            detail={`用量 ${number(summary.powerUsage)} kWh · 实收 ${money(summary.powerPaid)}`}
          />
          <KPI
            icon={<Car />}
            label={day === dateLocal() ? '今日停车收入' : `${day} 停车收入`}
            value={money(parkingToday?.income)}
            detail={`${parkingToday?.vehicles == null ? '车次未录入' : `${parkingToday.vehicles} 车次`} · 点击录入日报`}
            onClick={openParking}
          />
        </section>
        <section className="manager-bottom">
          {(tab === 'overview' || tab === 'ledger') && <div className="section-heading">
            <h2>{tab === 'overview' ? '经营分析' : '本月账单'}</h2>
            <span>{tab === 'ledger' ? `${month} · ${visible.length} 个区域 · 未录入的金额不计为零` : tab === 'overview' ? '按所选账期汇总全园区已录入数据' : '园区设施与维护'}</span>
          </div>}
          {tab === 'ledger' && <div className="ledger-filters">
            <input aria-label="搜索台账区域或承租方" placeholder="搜索区域名称或承租方" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Choice label="台账业态" value={business} onChange={setBusiness} options={[["all", "全部业态"], ...businesses.map((v) => [v, v] as [string, string])]} />
            <Choice label="台账出租状态" value={status} onChange={setStatus} options={[["all", "全部状态"], ...Array.from(new Set(spaces.map((e) => e.status))).map((v) => [v, v] as [string, string])]} />
            {(query || business !== 'all' || status !== 'all') && <button onClick={() => { setQuery(''); setAreaFilter('all'); setBusiness('all'); setStatus('all'); }}>清除筛选</button>}
          </div>}
          {tab === 'overview' ? (
            <div className="analytics-grid">
              <section className="insight-card">
                <h2>
                  业态构成 <span>可租区域数量</span>
                </h2>
                {Array.from(new Set(rentables.map((e) => e.business))).map(
                  (b) => {
                    const count = rentables.filter(
                      (e) => e.business === b,
                    ).length;
                    return (
                      <div className="business-bar" key={b}>
                        <span>{b}</span>
                        <div>
                          <i
                            style={{
                              width: `${(count / Math.max(1, rentables.length)) * 100}%`,
                              background: businessColors[b] || '#a8b3c4',
                            }}
                          />
                        </div>
                        <b>{count}</b>
                      </div>
                    );
                  },
                )}
                {!rentables.length && (
                  <p className="manager-empty-text">导入图纸后显示业态构成</p>
                )}
              </section>
              <section className="insight-card">
                <h2>
                  近六个月水电应收 <span>元 / 月</span>
                </h2>
                <div className="trend-chart">
                  {Array.from({ length: 6 }, (_, i) => {
                    const [y, m] = month.split('-').map(Number);
                    const d = new Date(y, m - 6 + i, 1);
                    return dateLocal(d).slice(0, 7);
                  }).map((m, _, months) => {
                    const s = monthly(ops, plan, m),
                      max = Math.max(
                        1,
                        ...months.flatMap((mm) => {
                          const b = monthly(ops, plan, mm);
                          return [b.waterDue || 0, b.powerDue || 0];
                        }),
                      );
                    return (
                      <div className="trend-month" key={m}>
                        <div className="trend-bars">
                          <div
                            title={`${m} 水费 ${money(s.waterDue)}`}
                            style={{
                              height:
                                s.waterDue === null
                                  ? 3
                                  : Math.max(3, (s.waterDue / max) * 95) + '%',
                            }}
                            className={`water ${s.waterDue === null ? 'no-data' : ''}`}
                          >
                            <span>
                              {s.waterDue === null ? '—' : number(s.waterDue)}
                            </span>
                          </div>
                          <div
                            title={`${m} 电费 ${money(s.powerDue)}`}
                            style={{
                              height:
                                s.powerDue === null
                                  ? 3
                                  : Math.max(3, (s.powerDue / max) * 95) + '%',
                            }}
                            className={`power ${s.powerDue === null ? 'no-data' : ''}`}
                          >
                            <span>
                              {s.powerDue === null ? '—' : number(s.powerDue)}
                            </span>
                          </div>
                        </div>
                        <small>{m.slice(5)}月</small>
                      </div>
                    );
                  })}
                </div>
                <div className="chart-legend">
                  <Legend color="#559aca" text="水费" />
                  <Legend color="#e4a350" text="电费" />
                  <span>— 未录入</span>
                </div>
              </section>
              <section className="insight-card">
                <h2>
                  费用较高的区域 <span>{month}</span>
                </h2>
                {summary.bills
                  .filter((b) => b.waterDue !== null || b.powerDue !== null)
                  .sort(
                    (a, b) =>
                      (b.waterDue || 0) +
                      (b.powerDue || 0) -
                      (a.waterDue || 0) -
                      (a.powerDue || 0),
                  )
                  .slice(0, 5)
                  .map((b, i) => (
                    <button
                      className="ranking-row"
                      key={b.spaceId}
                      onClick={() => setSelected(b.spaceId)}
                    >
                      <em>{String(i + 1).padStart(2, '0')}</em>
                      <span>
                        {spaces.find((e) => e.id === b.spaceId)?.name}
                      </span>
                      <b>{money(sumKnown([b.waterDue, b.powerDue]))}</b>
                    </button>
                  ))}
                {!summary.bills.some(
                  (b) => b.waterDue !== null || b.powerDue !== null,
                ) && (
                  <p className="manager-empty-text">录入水电账单后显示排行</p>
                )}
                <small>水费 + 电费应收合计；高费用不直接等于设备异常。</small>
              </section>
            </div>
          ) : tab === 'ledger' ? (
            <div className="ledger-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      '区域 / 承租方',
                      '业态',
                      '出租状态',
                      '租金应收 / 实收',
                      '水费应收 / 实收',
                      '电费应收 / 实收',
                      '物业费应收 / 实收',
                      '已知待收',
                      '截止日',
                      '操作',
                    ].map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((e) => {
                    const b = billMap.get(e.id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <button
                            className="table-link"
                            onClick={() => { setSelected(e.id); setTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          >
                            {e.name}
                          </button>
                          <small>{e.tenant || '承租方未设置'}</small>
                          {b?.rentMonths === 12 && <small>年付租金 · {b.rentStartMonth || b.month} 起 12 个月</small>}
                        </TableCell>
                        <TableCell>{e.business}</TableCell>
                        <TableCell>{e.status}</TableCell>
                        <TableCell>
                          {money(b?.rentDue)} / {money(b?.rentPaid)}
                        </TableCell>
                        <TableCell>
                          {money(b?.waterDue)} / {money(b?.waterPaid)}
                        </TableCell>
                        <TableCell>
                          {money(b?.powerDue)} / {money(b?.powerPaid)}
                        </TableCell>
                        <TableCell>{money(b?.propertyDue)} / {money(b?.propertyPaid)}</TableCell>
                        <TableCell>
                          {b ? money(balance(b)) : '未录入'}
                        </TableCell>
                        <TableCell>{b?.dueDate || '未设置'}</TableCell>
                        <TableCell>
                          <button onClick={() => openBill(e.id)}>
                            {b ? '编辑' : '录入'}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!visible.length && (
                <div className="manager-empty-text">
                  <p>{spaces.length ? '没有符合筛选条件的区域，请调整搜索或清除筛选。' : '还没有园区图纸，导入后即可按区域录入台账。'}</p>
                  {!spaces.length && <button onClick={() => file.current?.click()}><Upload size={15} />导入图纸 / 备份</button>}
                </div>
              )}
            </div>
          ) : tab === 'pipes' ? (
            <section className="pipe-list">
              <p>
                管线在图纸编辑器中绘制，接入状态在区域属性中维护。 <a className="table-link" href="/">前往图纸编辑器 →</a>
              </p>
              {ops.pipes.map((p) => (
                <div key={p.id}>
                  <span>
                    {p.kind === 'water' ? (
                      <Droplets size={18} />
                    ) : (
                      <Zap size={18} />
                    )}{' '}
                    {p.name} · {p.points.length} 个节点
                  </span>
                </div>
              ))}
              {!ops.pipes.length && (
                <p className="manager-empty-text">
                  尚未标注管线；不会根据建筑位置自动生成路线。
                </p>
              )}
            </section>
          ) : (
            <section className="tender-board">
              <div className="tender-board-head">
                <div>
                  <h2>修缮招标</h2>
                  <p>发布房屋修缮需求，集中比较各承包商报价、开工日期和预计工期。</p>
                </div>
                <button className="primary" onClick={() => openTender()} disabled={!spaces.length}>
                  <Plus size={16} /> 新建招标
                </button>
              </div>
              <div className="tender-grid">
                {ops.tenders.map((entry) => {
                  const linked = spaces.find((space) => space.id === entry.spaceId);
                  const winner = entry.quotes.find((item) => item.status === '已中标');
                  const lowest = entry.quotes.length ? Math.min(...entry.quotes.map((item) => item.amount)) : null;
                  return (
                    <article className="tender-card" key={entry.id}>
                      <div className="tender-card-top">
                        <span className={`tender-status status-${entry.status}`}>{entry.status}</span>
                        <button onClick={() => openTender(entry)}>编辑需求</button>
                      </div>
                      <h3>{entry.title}</h3>
                      <p className="tender-space"><Building2 size={15} /> {linked?.name || '原区域已删除'}</p>
                      <p className="tender-description">{entry.description}</p>
                      <div className="tender-meta">
                        <span><Clock3 size={14} /> 报价截止：{entry.deadline || '未设置'}</span>
                        <span><ImageIcon size={14} /> {entry.images.length} 张现场图</span>
                      </div>
                      {entry.images.length > 0 && (
                        <div className="tender-thumbs">
                          {entry.images.slice(0, 4).map((image, index) => <button key={index} aria-label={`放大查看 ${image.name}`} onClick={() => { setImagePreview({ images: entry.images, index }); setImageZoom(1); }}><img src={image.dataUrl} alt={`${entry.title}现场图 ${index + 1}`} /><span><Maximize2 size={13} /></span></button>)}
                        </div>
                      )}
                      <div className="quote-summary">
                        <span><b>{entry.quotes.length}</b> 家已报价</span>
                        <span>最低报价 <b>{lowest === null ? '—' : money(lowest)}</b></span>
                        {winner && <span className="winner"><Trophy size={14} /> {winner.contractor}</span>}
                      </div>
                      {entry.quotes.length > 0 && (
                        <div className="quote-list">
                          {entry.quotes.slice().sort((a, b) => a.amount - b.amount).map((item) => (
                            <div className={item.status === '已中标' ? 'quote-row awarded' : 'quote-row'} key={item.id}>
                              <div><b>{item.contractor}</b><small>{item.startDate ? `${item.startDate} 开工 · ` : ''}{item.durationDays} 天</small></div>
                              <strong>{money(item.amount)}</strong>
                              <button onClick={() => setQuoteDetail({ tender: entry, quote: item })}>详情</button>
                              <button onClick={() => openQuote(entry.id, item)}>编辑</button>
                              {entry.status !== '已定标' && <button className="award-button" onClick={() => awardQuote(entry.id, item.id)}>定标</button>}
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="add-quote" onClick={() => openQuote(entry.id)}><Plus size={15} /> 录入承包商报价</button>
                    </article>
                  );
                })}
              </div>
              {!ops.tenders.length && (
                <div className="tender-empty"><BriefcaseBusiness size={38} /><h3>还没有修缮招标</h3><p>创建需求后，可持续录入不同承包商的报价和工期。</p><button className="primary" onClick={() => openTender()} disabled={!spaces.length}>新建第一个招标</button></div>
              )}
            </section>
          )}
        </section>
        <footer className="manager-footer">
          园境 · 运营管理{' '}
          <span>按区域独立编号关联台账 · 请定期导出运营备份</span>
        </footer>
      </main>
      {notice && (
        <div className="manager-toast" role="status">
          {notice}
        </div>
      )}
      <Dialog open={billOpen} onOpenChange={(open) => open ? setBillOpen(true) : closeBill()}>
        <DialogContent className="manager-dialog bill-dialog">
          <DialogHeader>
            <DialogTitle>{billSpace?.name || '区域'} · 费用账单</DialogTitle>
            <DialogDescription>
              选择费用，填写该收多少、已经收到多少。留空表示暂未记录。
            </DialogDescription>
          </DialogHeader>
          <Tabs className="bill-page-tabs" value={billView} onValueChange={(value) => setBillView(String(value))}>
            <TabsList aria-label="账单操作"><TabsTrigger value="edit">录入 / 编辑</TabsTrigger><TabsTrigger value="history"><Clock3 size={16} />历史记录</TabsTrigger></TabsList>
          </Tabs>
          {billView === 'history' && <BillHistory initialCategory={billCategory} key={`${bill.spaceId}-${billCategory}`} roomName={billSpace?.name || ''} bills={ops.bills.filter((entry) => entry.spaceId === bill.spaceId)} onOpen={(m) => { if (replaceBill(bill.spaceId, m)) setBillView('edit'); }} />}
          <form onSubmit={submitBill} hidden={billView !== 'edit'}>
            <div className="form-pair">
              <label>
                区域
                <Choice
                  label="账单区域"
                  value={bill.spaceId}
                  onChange={(id) => replaceBill(id, bill.month)}
                  options={spaces.map((e) => [e.id, e.name])}
                />
              </label>
              <label>
                账期
                <input
                  required
                  type="month"
                  value={bill.month}
                  onChange={(e) =>
                    e.target.value && replaceBill(bill.spaceId, e.target.value)
                  }
                />
              </label>
            </div>
            <div className="bill-context">
              <span>承租方 <b>{billSpace?.tenant || '未设置'}</b></span>
              <span>{ops.bills.some((entry) => entry.spaceId === bill.spaceId && entry.month === bill.month) ? '编辑已有账单' : '新建本月账单'}</span>
            </div>
            <Tabs className="bill-category-tabs" value={billCategory} onValueChange={(value) => { setBillCategory(String(value)); setFormError(''); }}>
              <TabsList aria-label="选择要处理的费用">
                <TabsTrigger value="rent"><Building2 size={17} />租金</TabsTrigger>
                <TabsTrigger value="water"><Droplets size={17} />水费</TabsTrigger>
                <TabsTrigger value="power"><Zap size={17} />电费</TabsTrigger>
                <TabsTrigger value="property"><Building2 size={17} />物业费</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="bill-groups bill-simple">
              {[
                ['rent', '租金', ''],
                ['water', '水费', 'm³'],
                ['power', '电费', 'kWh'],
                ['property', '物业费', ''],
              ].filter(([key]) => key === billCategory).map(([key, title, unit]) => (
                <section key={key}>
                  <h3>{key === 'rent' ? <Building2 size={18} /> : key === 'water' ? <Droplets size={18} /> : <Zap size={18} />}{title}</h3>
                  {key === 'power' && <p className="bill-source-note" role="status">{meterBillLoading ? '正在自动读取电表费用…' : meterBillMessage || (bill.powerMeter ? `用电 ${bill.powerUsage} 度 · 抄表 ${bill.powerMeter.readingAt}` : '等待电表数据')}</p>}
                  {key === 'rent' && <p className="bill-source-note">{bill.rentMonths === 12 ? '年付' : '月付'} · {bill.rentStartMonth || bill.month} 至 {rentEnd}</p>}
                  {[
                    ['Due', key === 'power' && automaticPower ? (bill.powerMeter ? '电表自动计算（元）' : '原账单金额（自动读取后更新）') : '该收多少（元）'],
                    ['Paid', '已经收到（元）'],
                  ].map(([suffix, label]) => (
                    <label key={suffix}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        max="1000000000000"
                        step=".01"
                        readOnly={key === 'power' && suffix === 'Due' && automaticPower}
                        aria-label={`${title}${label}`}
                        placeholder="未录入"
                        value={bill[`${key}${suffix}` as FinancialField] ?? ''}
                        onChange={(e) =>
                          setBill((b) => ({
                            ...b,
                            [`${key}${suffix}`]:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                  <div className="bill-payment-shortcuts">
                    <button type="button" onClick={() => setBill((current) => ({ ...current, [`${key}Paid`]: 0 }))}>还没收到</button>
                    <button type="button" disabled={bill[`${key}Due` as FinancialField] === null} onClick={() => setBill((current) => ({ ...current, [`${key}Paid`]: current[`${key}Due` as FinancialField] }))}>已全额收到</button>
                  </div>
                  <div className="bill-current-balance">这项还需收 <strong>{bill[`${key}Due` as FinancialField] === null || bill[`${key}Paid` as FinancialField] === null ? '待填写' : money(Math.max(0, bill[`${key}Due` as FinancialField]! - bill[`${key}Paid` as FinancialField]!))}</strong></div>
                  {key !== 'property' && !(key === 'power' && automaticPower) && <details className="bill-calculation" key={`${key}-${bill.spaceId}-${bill.month}`}>
                    <summary>{key === 'rent' ? `租期与金额设置 · ${bill.rentMonths === 12 ? '年付' : '月付'}` : '查看用量、单价与计算方式'}</summary>
                  <p className="bill-rate">{key === 'rent' ? `配置月租金 ${money(billSpace?.rent)}` : `配置单价 ${number(key === 'water' ? billSpace?.waterRate : billSpace?.electricityRate)} 元/${unit}`}</p>
                  {key === 'rent' ? (
                    <>
                    <label>租金付款周期<Choice label="租金付款周期" value={String(bill.rentMonths || 1)} onChange={(value) => setBill((current) => ({ ...current, rentMonths: Number(value) as 1 | 12, rentStartMonth: current.rentStartMonth || current.month, rentDue: Math.round((billSpace?.rent || 0) * Number(value) * 100) / 100 }))} options={[["1", "月付"], ["12", "年付"]]} /></label>
                    <label>租金起始月份<input type="month" value={bill.rentStartMonth || bill.month} onChange={(e) => e.target.value && setBill({ ...bill, rentStartMonth: e.target.value })} /></label>
                    <p className="bill-rate">覆盖至 {rentEnd}（含） · 合计 {bill.rentMonths || 1} 个月</p>
                    <button
                      type="button"
                      onClick={() =>
                        setBill((b) => ({
                          ...b,
                          rentDue:
                            Math.round((spaces.find((s) => s.id === b.spaceId)?.rent || 0) * (b.rentMonths || 1) * 100) / 100,
                        }))
                      }
                    >
                      带入{bill.rentMonths === 12 ? '全年租金（月租 × 12）' : '配置月租金'}
                    </button>
                    <p className="bill-rate">应收可按合同修改。全年金额计入本账期，不自动拆成 12 笔。</p>
                    </>
                  ) : (
                    <>
                      <label>
                        本次记账用量（{unit}，非累计读数）
                        <input
                          type="number"
                          readOnly={key === 'power' && !!bill.powerMeter}
                          min="0"
                          max="1000000000000"
                          step="any"
                          value={bill[`${key}Usage` as FinancialField] ?? ''}
                          onChange={(e) =>
                            setBill((b) => ({
                              ...b,
                              [`${key}Usage`]: e.target.value === '' ? null : Number(e.target.value),
                              [`${key}Due`]: e.target.value === '' ? null : Math.round(Number(e.target.value) * (key === 'water' ? billSpace?.waterRate || 0 : billSpace?.electricityRate || 0) * 100) / 100,
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={key === 'power' && !!bill.powerMeter}
                        onClick={() => {
                          const s = spaces.find((s) => s.id === bill.spaceId),
                            usage = bill[`${key}Usage` as FinancialField];
                          if (!s || usage === null) {
                            setFormError('请先录入用量');
                            return;
                          }
                          const rate =
                            key === 'water' ? s.waterRate : s.electricityRate;
                          if (rate <= 0) {
                            setFormError(
                              '请先在图纸中设置有效水电单价，也可直接填写金额',
                            );
                            return;
                          }
                          setBill((b) => ({
                            ...b,
                            [`${key}Due`]: Math.round(usage * rate * 100) / 100,
                          }));
                          setFormError('');
                        }}
                      >
                        按图纸单价计算应收
                      </button>
                    </>
                  )}

                  {key === 'power' && <p className="bill-rate" role="status">{meterBillLoading ? '正在同步电价并读取电表…' : meterBillMessage}</p>}
                  </details>}
                </section>
              ))}
            </div>
            <details className="bill-extra"><summary>缴费截止日与备注{bill.dueDate ? ` · ${bill.dueDate}` : '（选填）'}</summary>
            <div className="form-pair">
              <label>
                缴费截止日
                <input
                  type="date"
                  value={bill.dueDate}
                  onChange={(e) =>
                    setBill({ ...bill, dueDate: e.target.value })
                  }
                />
              </label>
              <label>
                备注
                <input
                  maxLength={5000}
                  value={bill.notes}
                  onChange={(e) => setBill({ ...bill, notes: e.target.value })}
                />
              </label>
            </div>
            </details>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="bill-save-summary" aria-live="polite">
              本账单合计：该收 {money(sumKnown([bill.rentDue, bill.waterDue, bill.powerDue, bill.propertyDue]))} · 已收 {money(sumKnown([bill.rentPaid, bill.waterPaid, bill.powerPaid, bill.propertyPaid]))}
              {billIssues.map((issue) => <p className="form-error" key={issue}>{issue}</p>)}
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={closeBill}>
                取消
              </button>
              <button className="primary" type="submit">
                <Save size={16} />
                保存账单
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={parkingOpen} onOpenChange={setParkingOpen}>
        <DialogContent className="manager-dialog parking-dialog">
          <DialogHeader>
            <DialogTitle>停车经营日报</DialogTitle>
            <DialogDescription>
              录入全园区当日实收停车收入，不包含租金和充电收入；再次保存同一天会更新该日记录。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitParking}>
            <label>
              日期
              <input
                required
                type="date"
                value={day}
                onChange={(e) =>
                  e.target.value && changeParkingDate(e.target.value)
                }
              />
            </label>
            <label>
              实收停车收入（元）
              <input
                required
                type="number"
                min="0"
                max="1000000000000"
                step=".01"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </label>
            <label>
              收费车次（可留空）
              <input
                type="number"
                min="0"
                max="1000000000000"
                step="1"
                value={vehicles}
                onChange={(e) => setVehicles(e.target.value)}
              />
            </label>
            <label>
              备注
              <input
                maxLength={5000}
                value={parkingNotes}
                onChange={(e) => setParkingNotes(e.target.value)}
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setParkingOpen(false)}>
                取消
              </button>
              <button className="primary" type="submit">
                保存日报
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={tenderOpen} onOpenChange={setTenderOpen}>
        <DialogContent className="manager-dialog tender-dialog">
          <DialogHeader>
            <DialogTitle>{tender.id ? '编辑修缮招标' : '新建修缮招标'}</DialogTitle>
            <DialogDescription>整理房屋现状、修缮范围、时间要求和现场图片，作为承包商报价依据。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTender}>
            <div className="form-pair">
              <label>项目名称<input required maxLength={200} value={tender.title} onChange={(e) => setTender({ ...tender, title: e.target.value })} placeholder="例如：东侧办公楼屋面防水修缮" /></label>
              <label>关联房屋 / 区域<Choice label="关联修缮区域" value={tender.spaceId} onChange={(spaceId) => setTender({ ...tender, spaceId })} options={spaces.map((space) => [space.id, space.name])} /></label>
            </div>
            <label>基础信息与现状<textarea required rows={4} maxLength={5000} value={tender.description} onChange={(e) => setTender({ ...tender, description: e.target.value })} placeholder="说明漏水、墙面开裂等现状，以及大致面积和现场条件" /></label>
            <label>修缮范围与验收要求<textarea rows={4} maxLength={5000} value={tender.requirements} onChange={(e) => setTender({ ...tender, requirements: e.target.value })} placeholder="说明材料、施工范围、质保期、验收标准等要求" /></label>
            <div className="form-pair">
              <label>报价截止日<input type="date" value={tender.deadline} onChange={(e) => setTender({ ...tender, deadline: e.target.value })} /></label>
              <label>期望开工日期<input type="date" value={tender.desiredStartDate} onChange={(e) => setTender({ ...tender, desiredStartDate: e.target.value })} /></label>
            </div>
            <div className="form-pair">
              <label>招标状态<Choice label="招标状态" value={tender.status} onChange={(status) => setTender({ ...tender, status: status as RepairTender['status'] })} options={['征集中', '评审中', '已定标', '已结束'].map((item) => [item, item]) as [string, string][]} /></label>
              <label className="image-upload">现场图片（最多 6 张，每张 1MB）<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void addTenderImages(e.target.files); e.target.value = ''; }} /></label>
            </div>
            {tender.images.length > 0 && <div className="upload-preview">{tender.images.map((image, index) => <div key={index}><img src={image.dataUrl} alt={image.name} /><button type="button" aria-label={`删除 ${image.name}`} onClick={() => setTender({ ...tender, images: tender.images.filter((_, i) => i !== index) })}><X size={14} /></button><small>{image.name}</small></div>)}</div>}
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="dialog-actions"><button type="button" onClick={() => setTenderOpen(false)}>取消</button><button className="primary" type="submit"><Save size={16} />保存招标</button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent className="manager-dialog quote-dialog">
          <DialogHeader><DialogTitle>{quote.id ? '编辑承包商报价' : '录入承包商报价'}</DialogTitle><DialogDescription>同一招标可录入多家报价，金额和工期会在列表中自动横向比较。</DialogDescription></DialogHeader>
          <form onSubmit={submitQuote}>
            <label>承包商 / 开发商名称<input required maxLength={200} value={quote.contractor} onChange={(e) => setQuote({ ...quote, contractor: e.target.value })} /></label>
            <div className="form-pair">
              <label>报价总额（元）<input required type="number" min="0" step=".01" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: Number(e.target.value) })} /></label>
              <label>预计工期（天）<input required type="number" min="1" step="1" value={quote.durationDays} onChange={(e) => setQuote({ ...quote, durationDays: Number(e.target.value) })} /></label>
            </div>
            <label>预计开工日期<input type="date" value={quote.startDate} onChange={(e) => setQuote({ ...quote, startDate: e.target.value })} /></label>
            <label>报价说明<textarea rows={4} maxLength={5000} value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} placeholder="可填写材料品牌、税费、质保、付款节点和不含项目" /></label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="dialog-actions"><button type="button" onClick={() => setQuoteOpen(false)}>取消</button><button className="primary" type="submit"><Save size={16} />保存报价</button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!quoteDetail} onOpenChange={(open) => !open && setQuoteDetail(null)}>
        <DialogContent className="manager-dialog quote-detail-dialog">
          {quoteDetail && <>
            <DialogHeader><DialogTitle>{quoteDetail.quote.contractor} · 报价详情</DialogTitle><DialogDescription>{quoteDetail.tender.title} · {spaces.find((space) => space.id === quoteDetail.tender.spaceId)?.name || '原区域已删除'}</DialogDescription></DialogHeader>
            <div className="quote-detail-hero"><span>{quoteDetail.quote.status}</span><strong>{money(quoteDetail.quote.amount)}</strong><small>报价总额</small></div>
            <dl className="quote-detail-grid">
              <div><dt>预计开工</dt><dd>{quoteDetail.quote.startDate || '未填写'}</dd></div>
              <div><dt>预计工期</dt><dd>{quoteDetail.quote.durationDays} 天</dd></div>
              <div><dt>报价状态</dt><dd>{quoteDetail.quote.status}</dd></div>
              <div><dt>报价差额</dt><dd>{money(quoteDetail.quote.amount - Math.min(...quoteDetail.tender.quotes.map((item) => item.amount)))}</dd></div>
            </dl>
            <section className="quote-notes"><h3>报价说明</h3><p>{quoteDetail.quote.notes || '供应商未填写材料、税费、质保或付款节点说明。'}</p></section>
            <section className="quote-notes muted"><h3>对应修缮要求</h3><p>{quoteDetail.tender.requirements || '招标项目未填写单独的修缮与验收要求。'}</p></section>
            <div className="dialog-actions"><button onClick={() => { openQuote(quoteDetail.tender.id, quoteDetail.quote); setQuoteDetail(null); }}>编辑报价</button>{quoteDetail.tender.status !== '已定标' && <button className="primary" onClick={() => { awardQuote(quoteDetail.tender.id, quoteDetail.quote.id); setQuoteDetail(null); }}><Trophy size={15} />选为中标方</button>}</div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="image-preview-dialog">
          {imagePreview && <>
            <DialogHeader><DialogTitle>{imagePreview.images[imagePreview.index].name}</DialogTitle><DialogDescription>第 {imagePreview.index + 1} / {imagePreview.images.length} 张 · 可放大查看现场细节</DialogDescription></DialogHeader>
            <div className="image-preview-toolbar">
              <button aria-label="缩小图片" onClick={() => setImageZoom((value) => Math.max(.5, value - .25))}><Minus size={17} /></button>
              <span>{Math.round(imageZoom * 100)}%</span>
              <button aria-label="放大图片" onClick={() => setImageZoom((value) => Math.min(4, value + .25))}><Plus size={17} /></button>
              <button onClick={() => setImageZoom(1)}>恢复大小</button>
            </div>
            <div className="image-preview-stage"><img style={{ transform: `scale(${imageZoom})` }} src={imagePreview.images[imagePreview.index].dataUrl} alt={imagePreview.images[imagePreview.index].name} /></div>
            {imagePreview.images.length > 1 && <div className="image-preview-nav"><button disabled={imagePreview.index === 0} onClick={() => { setImagePreview({ ...imagePreview, index: imagePreview.index - 1 }); setImageZoom(1); }}>上一张</button><button disabled={imagePreview.index === imagePreview.images.length - 1} onClick={() => { setImagePreview({ ...imagePreview, index: imagePreview.index + 1 }); setImageZoom(1); }}>下一张</button></div>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function KPI({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`kpi-card ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}
function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="legend-item">
      <i style={{ background: color }} />
      {text}
    </span>
  );
}
