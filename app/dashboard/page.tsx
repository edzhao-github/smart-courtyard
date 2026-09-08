'use client';
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
        <SelectValue />
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
    [business, setBusiness] = useState('all'),
    [status, setStatus] = useState('all'),
    [notice, setNotice] = useState(''),
    [large, setLarge] = useState(false),
    [tab, setTab] = useState('overview'),
    [billOpen, setBillOpen] = useState(false),
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
      if (raw) setPlan(validatePlan(JSON.parse(raw)));
      const saved = localStorage.getItem(OPS_KEY);
      if (saved) setOps(validateOperations(JSON.parse(saved)));
    } catch {
      setStorageError('本地数据读取失败，请保留原备份并重新导入。');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    const observe = new ResizeObserver(([e]) =>
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
        (!query || `${e.name} ${e.tenant}`.includes(query)),
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
    ]),
    totalPaid = sumKnown([
      summary.rentPaid,
      summary.waterPaid,
      summary.powerPaid,
    ]);
  function fit() {
    if (!plan.elements.length) return;
    const points = plan.elements.flatMap((e) => {
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
      Math.min((size.w - 65) / (x1 - x0 || 1), (size.h - 90) / (y1 - y0 || 1)),
    );
    setScale(s);
    setOrigin({ x: (x0 + x1 - size.w / s) / 2, y: (y0 + y1 - size.h / s) / 2 });
  }
  useEffect(() => {
    if (ready) fit();
  }, [ready, plan, size.w, size.h]);
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
  function openBill(
    spaceId = item?.id || rentables[0]?.id || spaces[0]?.id || '',
  ) {
    setBill(
      structuredClone(
        ops.bills.find((b) => b.spaceId === spaceId && b.month === month) ||
          blankBill(spaceId, month),
      ),
    );
    setFormError('');
    setBillOpen(true);
  }
  function replaceBill(spaceId: string, m: string) {
    setBill(
      structuredClone(
        ops.bills.find((b) => b.spaceId === spaceId && b.month === m) ||
          blankBill(spaceId, m),
      ),
    );
    setFormError('');
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
    const next = { ...bill, updatedAt: new Date().toISOString() };
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
      <main className="manager-body">
        <div className="manager-title">
          <div>
            <div className="manager-eyebrow">PARK MANAGEMENT / 经营全景</div>
            <h1>
              {plan.name}
              <span>管理驾驶舱</span>
            </h1>
            <p>空间、经营与配套，在一张图上看清。</p>
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
            <button
              className="primary"
              disabled={!spaces.length}
              onClick={() => openBill()}
            >
              <Plus size={17} />
              录入月度台账
            </button>
          </div>
        </div>
        <div className="manager-data-note">
          ● 手动台账 · 当前浏览器保存{' '}
          <span>
            图纸实时读取自编辑器；未录入 ≠ 0；暂无设备实时数据和多端同步。
          </span>
          {storageError && <strong>{storageError}</strong>}
        </div>
        <section className="kpi-grid">
          <KPI
            icon={<Building2 />}
            label="区域出租率"
            value={occupancy === null ? '—' : `${occupancy}%`}
            detail={`${rented} 已出租 / ${rentables.length} 可租区域 · 当前状态`}
          />
          <KPI
            icon={<Wallet />}
            label="本月应收租金"
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
        <section className="manager-workspace">
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
              {(business !== 'all' || status !== 'all' || query) && (
                <button
                  onClick={() => {
                    setBusiness('all');
                    setStatus('all');
                    setQuery('');
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
                  onClick={fit}
                >
                  <Move size={16} />
                </button>
                <span>拖动平移 · 滚轮缩放</span>
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
                <div className="detail-tags">
                  <span>{names[item.kind]}</span>
                  <span>{item.business}</span>
                  <span>{item.status}</span>
                </div>
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
                <div className="selected-billing">
                  <span>{month} 已知待收金额</span>
                  <strong>
                    {itemBill ? money(balance(itemBill)) : '未录入'}
                  </strong>
                  <small>仅计算同时填写应收、实收的费用项</small>
                </div>
                <button className="primary" onClick={() => openBill(item.id)}>
                  <Plus size={15} />
                  录入 / 编辑本月账单
                </button>
                <p className="tiny">
                  名称、业态、出租状态在图纸编辑器维护。面积为绘图计算值。
                </p>
              </section>
            ) : (
              <section className="insight-card receipt-card">
                <div className="card-heading">
                  <h2>本月收款进度</h2>
                  <span>{month}</span>
                </div>
                <strong>{money(totalPaid)}</strong>
                <p>已收租金 + 水费 + 电费</p>
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
        <section className="manager-bottom">
          <div className="bottom-tabs">
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList>
                <TabsTrigger value="overview">经营分析</TabsTrigger>
                <TabsTrigger value="ledger">区域台账</TabsTrigger>
                <TabsTrigger value="pipes">管线清单</TabsTrigger>
                <TabsTrigger value="tenders">修缮招标</TabsTrigger>
              </TabsList>
            </Tabs>
            <span>指标按全园区统计，地图筛选仅影响地图与台账列表。</span>
          </div>
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
                            onClick={() => setSelected(e.id)}
                          >
                            {e.name}
                          </button>
                          <small>{e.tenant || '承租方未设置'}</small>
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
                <p className="manager-empty-text">没有符合筛选条件的区域</p>
              )}
            </div>
          ) : tab === 'pipes' ? (
            <section className="pipe-list">
              <p>
                管线在「图纸编辑器」中绘制；接入状态来自图纸属性，两者独立维护。
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
      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="manager-dialog">
          <DialogHeader>
            <DialogTitle>录入月度台账</DialogTitle>
            <DialogDescription>
              留空表示未录入，0
              表示确认为零。应收与实收分开填写；保存会更新该区域该月份的账单。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBill}>
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
            <div className="bill-groups">
              {[
                ['rent', '租金', ''],
                ['water', '水费', 'm³'],
                ['power', '电费', 'kWh'],
              ].map(([key, title, unit]) => (
                <section key={key}>
                  <h3>{title}</h3>
                  {key === 'rent' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setBill((b) => ({
                          ...b,
                          rentDue:
                            spaces.find((s) => s.id === b.spaceId)?.rent ??
                            null,
                        }))
                      }
                    >
                      带入配置月租金
                    </button>
                  ) : (
                    <>
                      <label>
                        本月用量（{unit}）
                        <input
                          type="number"
                          min="0"
                          max="1000000000000"
                          step="any"
                          value={bill[`${key}Usage` as FinancialField] ?? ''}
                          onChange={(e) =>
                            setBill((b) => ({
                              ...b,
                              [`${key}Usage`]:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
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
                  {[
                    ['Due', '应收（元）'],
                    ['Paid', '实收（元）'],
                  ].map(([suffix, label]) => (
                    <label key={suffix}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        max="1000000000000"
                        step=".01"
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
                </section>
              ))}
            </div>
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
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setBillOpen(false)}>
                取消
              </button>
              <button className="primary" type="submit">
                <Save size={16} />
                保存台账
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
