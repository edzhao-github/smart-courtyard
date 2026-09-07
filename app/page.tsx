'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import {
  MousePointer2,
  Minus,
  Warehouse,
  Sprout,
  Sun,
  DoorOpen,
  Layers,
  Download,
  Upload,
  Undo2,
  Redo2,
  Map,
  Plus,
  Move,
  Save,
  Copy,
  ClipboardPaste,
  Trash2,
  Hand,
  ParkingSquare,
  Zap,
  RotateCw,
} from 'lucide-react';
import { layoutLabel } from '@/lib/label-layout';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  blank,
  createSpace,
  rectangle,
  rotateSpace,
  snapSpace,
  type SnapSide,
  type SnapAlignment,
  validatePlan,
  demo,
  colors,
  names,
  type Kind,
  type Space,
  type Plan,
} from '@/lib/plan';
const toolDefs = [
  { id: 'select', name: '选择 / 移动', icon: MousePointer2 },
  { id: 'line', name: '结构线', icon: Minus },
  { id: 'room', name: '房间', icon: Warehouse },
  { id: 'greenhouse', name: '大棚区', icon: Sprout },
  { id: 'outdoor', name: '露天区', icon: Sun },
  { id: 'gate', name: '园区大门', icon: DoorOpen },
  { id: 'parking', name: '停车场', icon: ParkingSquare },
  { id: 'charger', name: '充电桩', icon: Zap },
  { id: 'pan', name: '平移画布', icon: Hand },
];
type Point = { x: number; y: number };
type Gesture = {
  type: 'draw' | 'move' | 'resize' | 'pan' | 'rotate';
  start: Point;
  original?: Space;
  origin?: Point;
};
const BUSINESS_OPTIONS = [
  '未设置',
  '宠物',
  '运动',
  '餐饮',
  '办公室',
  '仓库',
  '汽车',
  '花店',
];
const KEY = 'courtyard-plan-v1';
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [plan, setPlan] = useState<Plan>(blank),
    [ready, setReady] = useState(false),
    [tool, setTool] = useState('select'),
    [spaceHeld, setSpaceHeld] = useState(false),
    [clipboard, setClipboard] = useState<Space | null>(null),
    [snapTarget, setSnapTarget] = useState(''),
    [snapSide, setSnapSide] = useState<SnapSide>('auto'),
    [snapAlignment, setSnapAlignment] = useState<SnapAlignment>('start'),
    [pickingTarget, setPickingTarget] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [past, setPast] = useState<Plan[]>([]),
    [future, setFuture] = useState<Plan[]>([]),
    [draft, setDraft] = useState<Space | null>(null),
    [lineStart, setLineStart] = useState<Point | null>(null),
    [gesture, setGesture] = useState<Gesture | null>(null),
    [snap, setSnap] = useState(true),
    [zoom, setZoom] = useState(1),
    [origin, setOrigin] = useState<Point>({ x: 0, y: 0 }),
    [notice, setNotice] = useState(''),
    [saved, setSaved] = useState('当前浏览器自动保存'),
    [size, setSize] = useState({ w: 900, h: 600 });
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null),
    current = useRef(plan),
    pasteCount = useRef(0);
  current.current = plan;
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
    const controller = new AbortController();
    const registrations = [
      {
        name: 'read_park_plan',
        title: '读取园区图纸',
        description: '读取当前园区全部空间几何数据与业务属性。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => structuredClone(current.current),
      },
      {
        name: 'select_park_space',
        title: '选择园区空间',
        description: '通过空间编号选中区域，在属性面板查看和编辑。',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: unknown) => {
          const id = (input as { id?: unknown })?.id;
          if (
            typeof id !== 'string' ||
            !current.current.elements.some((e) => e.id === id)
          )
            throw Error('空间编号不存在');
          flushSync(() => {
            setSelected(id);
            setTool('select');
            setDraft(null);
            setGesture(null);
            setLineStart(null);
          });
          return { selectedId: id };
        },
      },
    ];
    for (const registration of registrations) {
      try {
        void Promise.resolve(
          context.registerTool(registration, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, []);
  const item = plan.elements.find((e) => e.id === selected),
    scale = 7 * zoom;
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setPlan(validatePlan(JSON.parse(s)));
    } catch {
      setSaved('本地草稿无法读取，请导入备份');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(plan));
      setSaved('已自动保存到当前浏览器');
    } catch {
      setSaved('本地保存失败，请导出备份');
    }
  }, [plan, ready]);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  function commit(next: Plan) {
    setPast((p) => [...p.slice(-79), current.current]);
    setFuture([]);
    setPlan(next);
  }
  function applySnap() {
    const source = plan.elements.find((e) => e.id === selected),
      target = plan.elements.find((e) => e.id === snapTarget);
    if (!source || !target) {
      setNotice('请先选择 A 和目标 B');
      return;
    }
    try {
      const result = snapSpace(source, target, snapSide, snapAlignment);
      cancel();
      commit({
        ...plan,
        elements: plan.elements.map((e) => (e.id === source.id ? result : e)),
      });
      setNotice(`已将 ${source.name} 与 ${target.name} 对齐贴合`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '吸附失败');
    }
  }
  function update(patch: Partial<Space>) {
    if (item)
      commit({
        ...plan,
        elements: plan.elements.map((e) =>
          e.id === item.id
            ? patch.rotation !== undefined && e.kind !== 'line'
              ? rotateSpace(
                  { ...e, ...patch, rotation: e.rotation },
                  patch.rotation,
                )
              : { ...e, ...patch }
            : e,
        ),
      });
  }
  function cancel() {
    setPickingTarget(null);
    setDraft(null);
    setGesture(null);
    setLineStart(null);
  }
  function choose(t: string) {
    cancel();
    setTool(t);
  }
  function undo() {
    cancel();
    if (!past.length) return;
    setFuture((f) => [plan, ...f]);
    setPlan(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    cancel();
    if (!future.length) return;
    setPast((p) => [...p, plan]);
    setPlan(future[0]);
    setFuture((f) => f.slice(1));
  }
  function remove() {
    if (item) {
      commit({
        ...plan,
        elements: plan.elements.filter((e) => e.id !== selected),
      });
      setSelected(null);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,[role="combobox"],[contenteditable="true"]',
        )
      )
        return;
      if (
        e.code === 'Space' &&
        !(e.target as HTMLElement).closest('button,[role=button]')
      ) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === 'Escape') cancel();
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.repeat &&
        e.key.toLowerCase() === 'c' &&
        item
      ) {
        e.preventDefault();
        copy();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.repeat &&
        e.key.toLowerCase() === 'v' &&
        clipboard
      ) {
        e.preventDefault();
        paste();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.repeat &&
        e.key.toLowerCase() === 'd' &&
        item
      ) {
        e.preventDefault();
        duplicate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        exportJSON();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      }
    };
    const release = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    const blur = () => {
      setSpaceHeld(false);
      cancel();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (gesture) return;
      const delta =
        e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.h : 1);
      const next = Math.max(
        0.05,
        Math.min(
          4,
          zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002),
        ),
      );
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left,
        py = e.clientY - rect.top;
      setOrigin({
        x: origin.x + px / scale - px / (7 * next),
        y: origin.y + py / scale - py / (7 * next),
      });
      setZoom(next);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [gesture, zoom, origin, scale, size.h]);
  function point(e: React.PointerEvent, aligned = true): Point {
    const r = svg.current!.getBoundingClientRect();
    const x = origin.x + (e.clientX - r.left) / scale,
      y = origin.y + (e.clientY - r.top) / scale;
    return {
      x: aligned && snap ? Math.round(x) : x,
      y: aligned && snap ? Math.round(y) : y,
    };
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    const p = point(e);
    const target = e.target as Element;
    const id = target.closest('[data-id]')?.getAttribute('data-id');
    const found = plan.elements.find((s) => s.id === id);
    if (pickingTarget && e.button === 0 && !spaceHeld) {
      if (!found || found.kind === 'line' || found.id === pickingTarget) {
        setNotice('请点击另一个矩形区域作为 B');
        return;
      }
      setSnapTarget(found.id);
      setSelected(pickingTarget);
      setPickingTarget(null);
      setNotice(`已选择目标 ${found.name}，点击「执行吸附」完成`);
      return;
    }
    if (
      tool === 'pan' ||
      spaceHeld ||
      e.button === 1 ||
      (tool === 'select' && !found)
    ) {
      if (gesture) return;
      if (tool === 'select' && !found && !spaceHeld && e.button === 0)
        setSelected(null);
      setGesture({
        type: 'pan',
        start: { x: e.clientX, y: e.clientY },
        origin,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === 'select') {
      setSelected(found?.id || null);
      if (found) {
        setGesture({
          type:
            target.getAttribute('data-handle') === 'rotate'
              ? 'rotate'
              : target.getAttribute('data-handle') === 'resize'
                ? 'resize'
                : 'move',
          start:
            target.getAttribute('data-handle') === 'rotate'
              ? point(e, false)
              : p,
          original: found,
        });
        setDraft(found);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (tool === 'line') {
      if (!lineStart) {
        setLineStart(p);
        setDraft(createSpace('line', p.x, p.y, 0, 0));
      } else {
        if (Math.hypot(p.x - lineStart.x, p.y - lineStart.y) < 0.2) return;
        const el = createSpace(
          'line',
          lineStart.x,
          lineStart.y,
          e.shiftKey && draft ? draft.width : p.x - lineStart.x,
          e.shiftKey && draft ? draft.height : p.y - lineStart.y,
        );
        commit({ ...plan, elements: [...plan.elements, el] });
        setSelected(el.id);
        cancel();
      }
      return;
    }
    const el = createSpace(tool as Kind, p.x, p.y, 0, 0);
    setDraft(el);
    setGesture({ type: 'draw', start: p });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (gesture?.type === 'pan') {
      setOrigin({
        x: gesture.origin!.x - (e.clientX - gesture.start.x) / scale,
        y: gesture.origin!.y - (e.clientY - gesture.start.y) / scale,
      });
      return;
    }
    const p = point(e);
    if (lineStart) {
      let end = p;
      if (e.shiftKey)
        end =
          Math.abs(p.x - lineStart.x) > Math.abs(p.y - lineStart.y)
            ? { x: p.x, y: lineStart.y }
            : { x: lineStart.x, y: p.y };
      setDraft((d) =>
        d
          ? { ...d, width: end.x - lineStart.x, height: end.y - lineStart.y }
          : d,
      );
      return;
    }
    if (!gesture) return;
    if (gesture.type === 'draw') {
      setDraft((d) =>
        d ? { ...d, ...rectangle(gesture.start, p, e.shiftKey) } : d,
      );
      return;
    }
    const o = gesture.original!;
    if (gesture.type === 'rotate') {
      const a = (o.rotation * Math.PI) / 180;
      const cx =
        o.x + (o.width / 2) * Math.cos(a) - (o.height / 2) * Math.sin(a);
      const cy =
        o.y + (o.width / 2) * Math.sin(a) + (o.height / 2) * Math.cos(a);
      const cursor = point(e, false);
      let rotation =
        o.rotation +
        ((Math.atan2(cursor.y - cy, cursor.x - cx) -
          Math.atan2(gesture.start.y - cy, gesture.start.x - cx)) *
          180) /
          Math.PI;
      rotation = ((((rotation + 180) % 360) + 360) % 360) - 180;
      if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
      setDraft(rotateSpace(o, Math.round(rotation * 10) / 10));
      return;
    }
    const dx = p.x - gesture.start.x,
      dy = p.y - gesture.start.y;
    if (gesture.type === 'move') setDraft({ ...o, x: o.x + dx, y: o.y + dy });
    else {
      const angle = (o.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle),
        localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      setDraft({
        ...o,
        width: Math.max(0.5, o.width + localX),
        height: Math.max(0.5, o.height + localY),
      });
    }
  }
  function up() {
    if (!gesture) return;
    if (gesture.type === 'pan') {
      setGesture(null);
      return;
    }
    if (draft) {
      if (gesture.type === 'draw') {
        const drawing =
          draft.kind === 'charger' && draft.width < 0.5 && draft.height < 0.5
            ? { ...draft, width: 2, height: 2 }
            : draft;
        if (drawing.width >= 0.5 && drawing.height >= 0.5) {
          const count =
            plan.elements.filter((e) => e.kind === draft.kind).length + 1;
          const el = {
            ...drawing,
            name: `${names[draft.kind]} ${String(count).padStart(2, '0')}`,
          };
          commit({ ...plan, elements: [...plan.elements, el] });
          setSelected(el.id);
          setTool('select');
        }
      } else if (JSON.stringify(draft) !== JSON.stringify(gesture.original)) {
        commit({
          ...plan,
          elements: plan.elements.map((e) => (e.id === draft.id ? draft : e)),
        });
      }
    }
    setGesture(null);
    setDraft(null);
  }
  function fit(elements = plan.elements) {
    if (!elements.length) {
      setOrigin({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    const points = elements.flatMap((e) => {
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
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x)),
      minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    const z = Math.min(
      4,
      Math.max(
        0.05,
        Math.min(
          (size.w - 100) / (maxX - minX || 1),
          (size.h - 140) / (maxY - minY || 1),
        ) / 7,
      ),
    );
    setZoom(z);
    setOrigin({
      x: (maxX + minX - size.w / (7 * z)) / 2,
      y: (maxY + minY - size.h / (7 * z)) / 2,
    });
  }
  function changeZoom(factor: number) {
    const next = Math.max(0.05, Math.min(4, zoom * factor));
    setOrigin({
      x: origin.x + size.w / scale / 2 - size.w / (7 * next) / 2,
      y: origin.y + size.h / scale / 2 - size.h / (7 * next) / 2,
    });
    setZoom(next);
  }
  function exportJSON() {
    download(
      `${plan.name}.json`,
      JSON.stringify(plan, null, 2),
      'application/json',
    );
    setNotice('图纸数据已导出，包含全部空间属性');
  }
  function exportSVG() {
    const node = svg.current?.cloneNode(true) as SVGSVGElement;
    if (!node) return;
    node.querySelectorAll('[data-editor]').forEach((n) => n.remove());
    node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    node.setAttribute('width', String(size.w));
    node.setAttribute('height', String(size.h));
    download(
      `${plan.name}.svg`,
      new XMLSerializer().serializeToString(node),
      'image/svg+xml',
    );
    setNotice('已导出当前视图的 SVG 平面图');
  }
  async function importFile(f: File) {
    try {
      if (f.size > 10 * 1024 * 1024) throw Error('文件不能超过 10MB');
      const next = validatePlan(JSON.parse(await f.text()));
      commit(next);
      cancel();
      setSelected(null);
      fit(next.elements);
      setNotice('图纸已导入');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '导入失败');
    }
  }
  function copy() {
    if (!item) return;
    setClipboard(structuredClone(item));
    pasteCount.current = 0;
    setNotice(`已复制 ${item.name}，按 Ctrl/Cmd+V 粘贴`);
  }
  function paste() {
    if (!clipboard) return;
    pasteCount.current += 1;
    const offset = pasteCount.current * 2;
    const next = {
      ...structuredClone(clipboard),
      id: crypto.randomUUID(),
      name: `${clipboard.name} 副本 ${pasteCount.current}`,
      x: clipboard.x + offset,
      y: clipboard.y + offset,
    };
    cancel();
    setTool('select');
    commit({ ...plan, elements: [...plan.elements, next] });
    setSelected(next.id);
    setNotice('已粘贴，可拖动副本或使用吸附功能对齐');
  }
  function duplicate() {
    if (!item) return;
    const next = {
      ...item,
      id: crypto.randomUUID(),
      name: `${item.name} 副本`,
      x: item.x + 2,
      y: item.y + 2,
    };
    commit({ ...plan, elements: [...plan.elements, next] });
    setSelected(next.id);
  }
  function field(label: string, key: keyof Space, numeric = false, min = 0) {
    return (
      <label className="field">
        {label}
        <input
          key={`${item!.id}-${key}-${item![key]}`}
          type={numeric ? 'number' : 'text'}
          min={numeric ? min : undefined}
          step={key === 'floor' ? 1 : 'any'}
          maxLength={numeric ? undefined : 120}
          defaultValue={String(item![key])}
          onBlur={(e) => {
            const v = numeric ? Number(e.target.value) : e.target.value;
            if (
              numeric &&
              (!e.target.value ||
                !Number.isFinite(v) ||
                Number(v) < min ||
                Number(v) > 1000000 ||
                (key === 'floor' && !Number.isInteger(v)))
            ) {
              e.target.value = String(item![key]);
              setNotice('请输入有效的尺寸或金额');
              return;
            }
            if (v !== item![key]) update({ [key]: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
    );
  }
  function renderShape(e: Space, preview = false) {
    const chosen = e.id === selected && !preview;
    const color = colors[e.kind];
    const labelName =
      e.kind === 'parking'
        ? `P · ${e.name}`
        : e.kind === 'charger'
          ? `ϟ ${e.name}`
          : e.name;
    const areaText =
      e.height > 5 ? `${(e.width * e.height).toFixed(1)} m²` : null;
    const label = layoutLabel(
      labelName,
      Math.abs(e.width),
      Math.abs(e.height),
      areaText,
    );
    return (
      <g
        key={e.id}
        data-id={e.id}
        transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`}
        opacity={preview ? 0.7 : 1}
        style={{
          cursor: spaceHeld ? 'grab' : tool === 'select' ? 'move' : undefined,
        }}
      >
        {e.kind === 'line' ? (
          <>
            <line
              x1="0"
              y1="0"
              x2={e.width}
              y2={e.height}
              stroke="transparent"
              strokeWidth={12 / scale}
            />
            <line
              x1="0"
              y1="0"
              x2={e.width}
              y2={e.height}
              stroke={chosen ? '#127560' : color}
              strokeWidth={chosen ? 3 / scale : 2 / scale}
            />
          </>
        ) : (
          <>
            <rect
              width={e.width}
              height={e.height}
              fill={
                e.kind === 'greenhouse'
                  ? 'url(#greenhouse)'
                  : e.kind === 'outdoor'
                    ? 'url(#outdoor)'
                    : e.kind === 'parking'
                      ? '#e7edff'
                      : e.kind === 'charger'
                        ? '#d9f4ea'
                        : e.kind === 'gate'
                          ? '#f2dfe4'
                          : '#e4edf8'
              }
              stroke={color}
              strokeWidth={1.5 / scale}
            />
            {e.kind === 'gate' && (
              <path
                d={`M 0 0 V ${e.height} M ${e.width} 0 V ${e.height} M 0 ${e.height / 2} H ${e.width}`}
                fill="none"
                stroke={color}
                strokeWidth={3 / scale}
              />
            )}
            <title>
              {labelName}
              {areaText ? ` · ${areaText}` : ''}
            </title>
            <svg
              x={label.padding}
              y={label.padding}
              width={label.innerWidth}
              height={label.innerHeight}
              overflow="hidden"
              pointerEvents="none"
              aria-hidden="true"
            >
              {label.lines.map((line, i) => (
                <text
                  key={i}
                  x={label.innerWidth / 2}
                  y={line.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color}
                  fontSize={label.font}
                  fontFamily="Arial, sans-serif"
                >
                  {line.text}
                </text>
              ))}
              {areaText && (
                <text
                  x={label.innerWidth / 2}
                  y={label.areaY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color}
                  fontSize={label.areaFont}
                  fontFamily="Arial, sans-serif"
                >
                  {areaText}
                </text>
              )}
            </svg>
          </>
        )}
        {chosen && (
          <g data-editor="true">
            <rect
              x={-3 / scale}
              y={-3 / scale}
              width={Math.max(0.1, e.width) + 6 / scale}
              height={Math.max(0.1, e.height) + 6 / scale}
              fill="none"
              stroke="#127560"
              strokeWidth={1 / scale}
              strokeDasharray={`${4 / scale} ${3 / scale}`}
              pointerEvents="none"
            />
            {e.kind !== 'line' && (
              <>
                <line
                  x1={e.width / 2}
                  y1={0}
                  x2={e.width / 2}
                  y2={-28 / scale}
                  stroke="#127560"
                  strokeWidth={1.5 / scale}
                  pointerEvents="none"
                />
                <circle
                  data-handle="rotate"
                  cx={e.width / 2}
                  cy={-28 / scale}
                  r={9 / scale}
                  fill="white"
                  stroke="#127560"
                  strokeWidth={2 / scale}
                  style={{ cursor: 'grab' }}
                >
                  <title>拖动旋转 · Shift 吸附15°</title>
                </circle>
              </>
            )}
            {e.kind !== 'line' && (
              <rect
                data-handle="resize"
                x={e.width - 4 / scale}
                y={e.height - 4 / scale}
                width={8 / scale}
                height={8 / scale}
                fill="white"
                stroke="#127560"
                strokeWidth={1.5 / scale}
                style={{ cursor: 'nwse-resize' }}
              />
            )}
          </g>
        )}
      </g>
    );
  }
  const area = plan.elements
    .filter((e) => ['room', 'greenhouse', 'outdoor'].includes(e.kind))
    .reduce((n, e) => n + e.width * e.height, 0);
  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <Map size={22} />
          </span>
          <b>
            园境 <small>PARK STUDIO</small>
          </b>
          <span className="divider" />
          <span>园区绘图工作台</span>
          <Link
            href="/dashboard"
            style={{
              fontSize: 14,
              color: '#167560',
              textDecoration: 'none',
              marginLeft: 12,
            }}
          >
            管理驾驶舱 ↗
          </Link>
        </div>
        <div className="actions">
          <button onClick={() => file.current?.click()}>
            <Upload size={16} />
            导入
          </button>
          <button onClick={exportSVG}>导出 SVG</button>
          <button className="primary" onClick={exportJSON}>
            <Download size={16} />
            导出图纸
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void importFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      <div className="projectbar">
        <div>
          <span className="eyebrow">SMART COURTYARD / 平面规划</span>
          <h1>
            <input
              className="project-name"
              aria-label="园区名称"
              key={plan.name}
              defaultValue={plan.name}
              maxLength={120}
              onBlur={(e) => {
                const name = e.target.value.trim() || '未命名园区';
                if (name !== plan.name) commit({ ...plan, name });
              }}
            />
            <span className="tag">二维平面</span>
          </h1>
        </div>
        <div className="actions">
          <button
            onClick={copy}
            disabled={!item}
            title="复制选中区域 Ctrl/Cmd+C"
          >
            <Copy size={16} />
            复制
          </button>
          <button
            onClick={paste}
            disabled={!clipboard}
            title="粘贴区域 Ctrl/Cmd+V"
          >
            <ClipboardPaste size={16} />
            粘贴
          </button>
          <button
            onClick={() => {
              const p = demo();
              commit(p);
              setSelected(null);
              cancel();
              fit(p.elements);
              setNotice('已加载参考示意，可撤销恢复原图；尺寸均为演示');
            }}
          >
            参考示例
          </button>
          <button
            onClick={() => {
              commit({ ...blank });
              setSelected(null);
              cancel();
              fit([]);
              setNotice('已新建图纸，可撤销恢复');
            }}
          >
            新建
          </button>
          <div className="undo-group">
            <button
              aria-label="撤销"
              title="撤销 Ctrl/⌘ Z"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button aria-label="重做" disabled={!future.length} onClick={redo}>
              <Redo2 size={17} />
            </button>
          </div>
        </div>
      </div>
      <div className="workspace">
        <aside className="leftpanel">
          <h2>
            绘图工具 <span>01</span>
          </h2>
          <div className="tools">
            {toolDefs.map((t) => (
              <button
                key={t.id}
                aria-pressed={tool === t.id}
                className={tool === t.id ? 'active' : ''}
                onClick={() => choose(t.id)}
              >
                <t.icon size={19} />
                {t.name}
              </button>
            ))}
          </div>
          <h2>
            空间图层 <span>{plan.elements.length}</span>
          </h2>
          {!plan.elements.length ? (
            <div className="empty-layers">绘制的空间将出现在这里</div>
          ) : (
            <div className="layer-list">
              {plan.elements.map((e) => (
                <button
                  key={e.id}
                  className={`layer ${selected === e.id ? 'selected' : ''}`}
                  onClick={() => {
                    choose('select');
                    setSelected(e.id);
                  }}
                >
                  <span
                    className="dot"
                    style={{ background: colors[e.kind] }}
                  />
                  <span>{e.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="tip">
            <b>绘图小贴士</b>
            <p>
              结构线：点击起点，再点击终点。
              <br />
              区域：按住左键拖出矩形。
              <br />
              Shift：正方形 / 水平垂直线。
              <br />
              拖动空白处平移画布。
              <br />
              圆形手柄旋转，Shift 吸附 15°。
              <br />
              空格 + 拖动 / 中键拖动平移。
              <br />
              滚轮缩放，右下角调区域尺寸。
            </p>
            <span>ESC 取消 · Delete 删除</span>
          </div>
        </aside>
        <section className="canvas-wrap">
          <div className="canvas-toolbar">
            <span>
              <Layers size={16} />
              {toolDefs.find((t) => t.id === tool)?.name}
              {pickingTarget ? ' · 点击目标 B' : lineStart ? ' · 点击终点' : ''}
            </span>
            <span className="muted">空白拖动平移 · 滚轮缩放</span>
          </div>
          <svg
            ref={svg}
            className="scene"
            viewBox={`${origin.x} ${origin.y} ${size.w / scale} ${size.h / scale}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancel}
            onLostPointerCapture={() => setGesture(null)}
            onAuxClick={(e) => e.preventDefault()}
            style={{
              cursor:
                gesture?.type === 'pan'
                  ? 'grabbing'
                  : tool === 'pan' || spaceHeld
                    ? 'grab'
                    : tool === 'select'
                      ? 'grab'
                      : 'crosshair',
            }}
            aria-label="园区平面图绘制画布"
          >
            <defs>
              <pattern
                id="grid"
                width="1"
                height="1"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="0" cy="0" r={0.7 / scale} fill="#bdcdd5" />
              </pattern>
              <pattern
                id="greenhouse"
                width="2"
                height="2"
                patternUnits="userSpaceOnUse"
              >
                <rect width="2" height="2" fill="#e3f1e9" />
                <path d="M 0 0 V 2" stroke="#bbdccb" strokeWidth=".12" />
              </pattern>
              <pattern
                id="outdoor"
                width="2"
                height="2"
                patternUnits="userSpaceOnUse"
              >
                <rect width="2" height="2" fill="#faf2db" />
                <circle cx="1" cy="1" r=".12" fill="#d9c792" />
              </pattern>
            </defs>
            <rect
              x={origin.x}
              y={origin.y}
              width={size.w / scale}
              height={size.h / scale}
              fill="#f5f8fa"
            />
            <rect
              data-editor="true"
              x={origin.x}
              y={origin.y}
              width={size.w / scale}
              height={size.h / scale}
              fill="url(#grid)"
            />
            {plan.elements.map((e) =>
              renderShape(draft?.id === e.id ? draft : e),
            )}
            {draft &&
              !plan.elements.some((e) => e.id === draft.id) &&
              renderShape(draft, true)}
          </svg>
          {!plan.elements.length && !draft && (
            <div className="canvas-empty">
              <Map size={40} />
              <h2>在这里绘制你的园区</h2>
              <p>选择左侧工具，或载入参考示例开始编辑</p>
            </div>
          )}
          <div className="zoom">
            <button aria-label="缩小" onClick={() => changeZoom(1 / 1.2)}>
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="放大" onClick={() => changeZoom(1.2)}>
              <Plus size={16} />
            </button>
            <button
              aria-label="适应全部图形"
              title="适应全部图形"
              onClick={() => fit()}
            >
              <Move size={16} />
            </button>
          </div>
          <span className="north">
            N<br />↑
          </span>
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
        </section>
        <aside className="properties">
          <h2>
            空间属性 <span>{item ? names[item.kind] : '未选择'}</span>
          </h2>
          {item ? (
            <>
              {field('空间名称', 'name')}
              <div className="pair">
                {field(
                  item.kind === 'line' ? '终点 ΔX（m）' : '宽度（m）',
                  'width',
                  true,
                  item.kind === 'line' ? -1000000 : 0.5,
                )}
                {field(
                  item.kind === 'line' ? '终点 ΔY（m）' : '长度（m）',
                  'height',
                  true,
                  item.kind === 'line' ? -1000000 : 0.5,
                )}
              </div>
              <div className="pair">
                {field('位置 X（m）', 'x', true, -1000000)}
                {field('位置 Y（m）', 'y', true, -1000000)}
              </div>
              {field('旋转角度（°）', 'rotation', true, -360)}
              {item.kind !== 'line' && (
                <section className="plan-settings">
                  <h2>吸附到其他区域</h2>
                  <p className="tiny">
                    当前为 A；A 跟随 B 的角度，尺寸不变，边缘无间隙贴合。方向以
                    B 自身朝向为准。
                  </p>
                  <label className="field">
                    目标 B
                    <Select
                      value={
                        plan.elements.some(
                          (e) => e.id === snapTarget && e.id !== item.id,
                        )
                          ? snapTarget
                          : null
                      }
                      onValueChange={(v) => {
                        setSnapTarget(v || '');
                        setPickingTarget(null);
                      }}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder="选择目标区域" />
                      </SelectTrigger>
                      <SelectContent>
                        {plan.elements
                          .filter((e) => e.id !== item.id && e.kind !== 'line')
                          .map((e, i) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} · {i + 1}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <button
                    className="mt-2 w-full"
                    onClick={() => {
                      setPickingTarget(item.id);
                      setTool('select');
                      setDraft(null);
                      setGesture(null);
                      setLineStart(null);
                    }}
                  >
                    {pickingTarget
                      ? '请在画布点击 B（Esc 取消）'
                      : '在画布上选择 B'}
                  </button>
                  <label className="field">
                    贴到 B 的哪一边
                    <Select
                      value={snapSide}
                      onValueChange={(v) => v && setSnapSide(v as SnapSide)}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          ['auto', '自动选择最近一边'],
                          ['left', '左边'],
                          ['right', '右边'],
                          ['top', '上边'],
                          ['bottom', '下边'],
                        ].map(([v, t]) => (
                          <SelectItem key={v} value={v}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="field">
                    沿贴合边对齐
                    <Select
                      value={snapAlignment}
                      onValueChange={(v) =>
                        v && setSnapAlignment(v as SnapAlignment)
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">
                          起点对齐（顶部 / 左侧）
                        </SelectItem>
                        <SelectItem value="center">居中对齐</SelectItem>
                        <SelectItem value="end">
                          终点对齐（底部 / 右侧）
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <button
                    className="primary mt-3 w-full"
                    disabled={
                      !snapTarget ||
                      snapTarget === item.id ||
                      !plan.elements.some(
                        (e) => e.id === snapTarget && e.kind !== 'line',
                      )
                    }
                    onClick={applySnap}
                  >
                    执行吸附
                  </button>
                </section>
              )}
              {item.kind !== 'line' && (
                <div className="inspector-actions">
                  <button
                    onClick={() =>
                      update({ rotation: (item.rotation + 90) % 360 })
                    }
                  >
                    <RotateCw size={15} />
                    旋转 90°
                  </button>
                  <button onClick={() => update({ rotation: 0 })}>归零</button>
                </div>
              )}
              <p className="tiny">
                拖动矩形上方圆形手柄旋转，按住 Shift 每 15° 吸附。
              </p>
              {!['line', 'gate', 'charger'].includes(item.kind) && (
                <>
                  <div className="area-stat">
                    <strong>{(item.width * item.height).toFixed(1)}</strong>
                    <span>m² 占地面积</span>
                  </div>
                  <div className="pair">
                    {field('楼层数', 'floor', true, 1)}
                    {field('层高（m）', 'ceiling', true)}
                  </div>
                  <h3 className="section-title">经营信息</h3>
                  <label className="field">
                    业态
                    <Select
                      value={item.business}
                      onValueChange={(value) => {
                        if (value !== null) update({ business: value });
                      }}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder="选择业态" />
                      </SelectTrigger>
                      <SelectContent>
                        {!BUSINESS_OPTIONS.includes(item.business) && (
                          <SelectItem value={item.business}>
                            {item.business || '空白'}（原有值）
                          </SelectItem>
                        )}
                        {BUSINESS_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="field">
                    出租状态
                    <Select
                      value={item.status}
                      onValueChange={(v) => v && update({ status: v })}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['待规划', '空置', '已出租', '自用', '维修中'].map(
                          (v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </label>
                  {field('承租方 / 使用单位', 'tenant')}
                  {field('月租金（元 / 月，区域总额）', 'rent', true)}
                  <h3 className="section-title">水电配套</h3>
                  <div className="checks">
                    <label>
                      <Checkbox
                        checked={item.water}
                        onCheckedChange={(v) => update({ water: !!v })}
                      />
                      通水
                    </label>
                    <label>
                      <Checkbox
                        checked={item.electricity}
                        onCheckedChange={(v) => update({ electricity: !!v })}
                      />
                      通电
                    </label>
                  </div>
                  <div className="pair">
                    {field('水价（元 / m³）', 'waterRate', true)}
                    {field('电价（元 / kWh）', 'electricityRate', true)}
                  </div>
                </>
              )}
              {field(
                item.kind === 'gate' ? '入口说明 / 开放时间' : '备注',
                'notes',
              )}
              <div className="inspector-actions">
                <button onClick={copy}>
                  <Copy size={15} />
                  复制
                </button>
                <button onClick={paste} disabled={!clipboard}>
                  <ClipboardPaste size={15} />
                  粘贴
                </button>
                <button className="danger" onClick={remove}>
                  <Trash2 size={15} />
                  删除
                </button>
              </div>
              <p className="tiny">
                Ctrl/Cmd+C 复制，Ctrl/Cmd+V 粘贴；Ctrl/Cmd+D
                直接创建副本。复制内容保留在当前页面，刷新后清空。尺寸与位置均以米为单位。
              </p>
            </>
          ) : (
            <div className="property-empty">
              <Warehouse size={34} />
              <h3>让空间拥有更多信息</h3>
              <p>
                绘制或选择一个区域，
                <br />
                在这里设置尺寸与经营属性。
              </p>
            </div>
          )}
          <div className="plan-settings">
            <h2>画布设置</h2>
            <div className="checks">
              <label>
                <Checkbox
                  checked={snap}
                  onCheckedChange={(v) => setSnap(!!v)}
                />
                吸附到 1 米网格
              </label>
            </div>
            <p className="tiny">
              区域总面积 {area.toFixed(1)} m²
              <br />
              按各区域面积累加，重叠部分未扣除。
              <br />
              参考示例仅表达布局，不代表实测。
            </p>
          </div>
        </aside>
      </div>
      <footer>
        <span className="status-dot" />
        {saved}
        <span className="footer-right">
          {plan.elements.length} 个对象 · 坐标单位 m · 导出 JSON 可再次编辑
        </span>
      </footer>
    </main>
  );
}
