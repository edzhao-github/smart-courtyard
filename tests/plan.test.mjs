import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpace, rectangle, validatePlan, demo } from '../lib/plan.ts';
test('reverse drag produces normalized rectangle and Shift locks square', () => {
  assert.deepEqual(rectangle({ x: 10, y: 10 }, { x: 3, y: 6 }), {
    x: 3,
    y: 6,
    width: 7,
    height: 4,
  });
  assert.deepEqual(rectangle({ x: 10, y: 10 }, { x: 3, y: 6 }, true), {
    x: 3,
    y: 3,
    width: 7,
    height: 7,
  });
});
test('JSON roundtrip retains IDs, geometry and business attributes', () => {
  const p = demo();
  Object.assign(p.elements[6], {
    water: true,
    electricity: true,
    waterRate: 3.5,
    electricityRate: 0.8,
    rent: 4000,
    rotation: 20,
    tenant: '测试商户',
  });
  const result = validatePlan(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(result, p);
  result.elements[0].name = 'changed';
  assert.notEqual(result.elements[0].name, p.elements[0].name);
});
test('invalid imports fail before replacing current drawing', () => {
  for (const mutate of [
    (p) => (p.schemaVersion = 2),
    (p) => (p.elements[0].x = Infinity),
    (p) => (p.elements[6].width = -1),
    (p) => (p.elements[6].rent = -1),
    (p) => (p.elements[6].water = 'true'),
    (p) => (p.elements[1].id = p.elements[0].id),
    (p) => (p.elements[0].kind = '__proto__'),
  ]) {
    const p = demo();
    mutate(p);
    assert.throws(() => validatePlan(p));
  }
});
test('lines accept signed deltas and zero thickness, regions require positive sizes', () => {
  const p = {
    schemaVersion: 1,
    name: 'test',
    unit: 'm',
    elements: [createSpace('line', 5, 5, -5, 0)],
  };
  assert.doesNotThrow(() => validatePlan(p));
  p.elements = [createSpace('room', 0, 0, 0, 4)];
  assert.throws(() => validatePlan(p));
});
