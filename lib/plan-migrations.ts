import type { Plan } from './plan';

// Apply the confirmed initial meter tariff to existing browser drawings once.
// Per-room markers allow later user edits without resetting their tariff.
export function migrateOfficeTariff(plan: Plan): Plan {
  const rooms = plan.elements.filter((space) =>
    space.name.trim() === '研发办公室' &&
    localStorage.getItem(`courtyard-tariff-20260915-${space.id}`) !== 'done',
  );
  if (!rooms.length) return plan;
  const ids = new Set(rooms.map((room) => room.id));
  const next = { ...plan, elements: plan.elements.map((space) =>
    ids.has(space.id) ? { ...space, electricityRate: 1 } : space,
  ) };
  localStorage.setItem('courtyard-plan-v1', JSON.stringify(next));
  rooms.forEach((room) => localStorage.setItem(`courtyard-tariff-20260915-${room.id}`, 'done'));
  return next;
}
