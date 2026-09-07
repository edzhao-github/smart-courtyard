export type Kind =
  | 'room'
  | 'greenhouse'
  | 'outdoor'
  | 'gate'
  | 'line'
  | 'parking'
  | 'charger';
export type Space = {
  id: string;
  kind: Kind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  floor: number;
  ceiling: number;
  water: boolean;
  electricity: boolean;
  waterRate: number;
  electricityRate: number;
  rent: number;
  business: string;
  tenant: string;
  status: string;
  notes: string;
};
export type Plan = {
  schemaVersion: 1;
  name: string;
  unit: 'm';
  elements: Space[];
};
export const names: Record<Kind, string> = {
  room: '房间',
  greenhouse: '大棚区',
  outdoor: '露天区',
  gate: '园区大门',
  line: '结构线',
  parking: '停车场',
  charger: '充电桩',
};
export const colors: Record<Kind, string> = {
  room: '#507fb8',
  greenhouse: '#3c9578',
  outdoor: '#c69a40',
  gate: '#b06978',
  line: '#697d89',
  parking: '#476ac0',
  charger: '#16866e',
};
export const blank: Plan = {
  schemaVersion: 1,
  name: '我的智慧园区',
  unit: 'm',
  elements: [],
};
export function createSpace(
  kind: Kind,
  x: number,
  y: number,
  width: number,
  height: number,
): Space {
  return {
    id: crypto.randomUUID(),
    kind,
    name: names[kind],
    x,
    y,
    width,
    height,
    rotation: 0,
    floor: 1,
    ceiling: 3,
    water: false,
    electricity: false,
    waterRate: 0,
    electricityRate: 0,
    rent: 0,
    business: '未设置',
    tenant: '',
    status: '待规划',
    notes: '',
  };
}
export function rectangle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  square = false,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const x = square ? a.x + Math.sign(dx || 1) * side : b.x,
    y = square ? a.y + Math.sign(dy || 1) * side : b.y;
  return {
    x: Math.min(a.x, x),
    y: Math.min(a.y, y),
    width: Math.abs(x - a.x),
    height: Math.abs(y - a.y),
  };
}
export function validatePlan(data: unknown): Plan {
  if (!data || typeof data !== 'object') throw Error('图纸格式无效');
  const p = data as Plan;
  if (
    p.schemaVersion !== 1 ||
    p.unit !== 'm' ||
    typeof p.name !== 'string' ||
    p.name.length > 120 ||
    !Array.isArray(p.elements) ||
    p.elements.length > 5000
  )
    throw Error('请导入本工具导出的 JSON 图纸（版本 1）');
  const ids = new Set();
  for (const e of p.elements) {
    if (
      !e ||
      !Object.hasOwn(names, e.kind) ||
      typeof e.id !== 'string' ||
      ids.has(e.id)
    )
      throw Error('图纸对象类型或编号无效');
    ids.add(e.id);
    for (const k of ['name', 'business', 'tenant', 'status', 'notes'] as const)
      if (typeof e[k] !== 'string' || e[k].length > 5000)
        throw Error('图纸文本属性无效');
    for (const k of [
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'floor',
      'ceiling',
      'waterRate',
      'electricityRate',
      'rent',
    ] as const)
      if (
        typeof e[k] !== 'number' ||
        !Number.isFinite(e[k]) ||
        Math.abs(e[k]) > 1000000
      )
        throw Error('图纸数值无效');
    if (
      (e.kind !== 'line' && (e.width <= 0 || e.height <= 0)) ||
      e.floor < 1 ||
      !Number.isInteger(e.floor) ||
      e.ceiling < 0 ||
      e.rent < 0 ||
      e.waterRate < 0 ||
      e.electricityRate < 0 ||
      typeof e.water !== 'boolean' ||
      typeof e.electricity !== 'boolean'
    )
      throw Error('图纸尺寸或费用无效');
  }
  return structuredClone(p);
}
export function demo(): Plan {
  const elements: Space[] = [];
  const add = (
    kind: Kind,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    const e = createSpace(kind, x, y, w, h);
    e.name = name;
    elements.push(e);
    return e;
  };
  add('line', '西侧边界', 7, 9, 0, 67);
  add('line', '北侧边界', 7, 9, 115, 0);
  add('line', '东侧边界', 122, 9, 0, 67);
  add('line', '南侧边界', 7, 76, 44, 0);
  add('line', '南侧边界', 65, 76, 57, 0);
  for (let i = 0; i < 12; i++) {
    const e = add(
      'room',
      `沿街店铺 ${String(i + 1).padStart(2, '0')}`,
      12 + i * 8.5,
      13,
      7,
      5,
    );
    e.business = '零售';
  }
  add('room', '管理中心', 12, 26, 12, 10).business = '办公';
  add('room', '工坊', 12, 43, 16, 12).business = '文创';
  add('room', '仓储超市', 81, 26, 28, 16).business = '零售';
  add('room', '活力中心', 39, 26, 30, 16).business = '文体';
  add('outdoor', '中央庭院', 39, 47, 30, 17);
  add('greenhouse', '集市大棚 A', 81, 49, 28, 8);
  add('greenhouse', '集市大棚 B', 81, 61, 28, 8);
  add('outdoor', '露天集市', 12, 62, 18, 8);
  add('gate', '园区主入口', 52, 74.5, 12, 3);
  return {
    schemaVersion: 1,
    name: '梧桐院 · 参考示意（非实测）',
    unit: 'm',
    elements,
  };
}

// Rotate about the visual center while retaining the top-left based file format.
export function rotateSpace(space: Space, rotation: number): Space {
  const before = (space.rotation * Math.PI) / 180;
  const after = (rotation * Math.PI) / 180;
  const cx =
    space.x +
    (space.width / 2) * Math.cos(before) -
    (space.height / 2) * Math.sin(before);
  const cy =
    space.y +
    (space.width / 2) * Math.sin(before) +
    (space.height / 2) * Math.cos(before);
  return {
    ...space,
    rotation,
    x:
      cx -
      (space.width / 2) * Math.cos(after) +
      (space.height / 2) * Math.sin(after),
    y:
      cy -
      (space.width / 2) * Math.sin(after) -
      (space.height / 2) * Math.cos(after),
  };
}
