import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankBill,
  emptyOperations,
  sumKnown,
  balance,
  monthly,
  validateOperations,
  heat,
} from '../lib/operations.ts';
import { createSpace } from '../lib/plan.ts';
test('missing money stays unknown while confirmed zero remains zero', () => {
  assert.equal(sumKnown([null, undefined]), null);
  assert.equal(sumKnown([null, 0]), 0);
  assert.equal(sumKnown([0.1, 0.2]), 0.3);
  assert.equal(balance(blankBill('a', '2026-09')), null);
  const b = { ...blankBill('a', '2026-09'), rentDue: 100 };
  assert.equal(balance(b), null);
  b.rentPaid = 0;
  assert.equal(balance(b), 100);
  b.rentPaid = 100;
  assert.equal(balance(b), 0);
});
test('monthly reporting isolates periods and excludes orphaned room bills', () => {
  const s = createSpace('room', 0, 0, 4, 4),
    plan = { schemaVersion: 1, name: 'Test', unit: 'm', elements: [s] };
  const ops = {
    ...emptyOperations,
    bills: [
      { ...blankBill(s.id, '2026-09'), waterDue: 24, powerDue: 0 },
      { ...blankBill(s.id, '2026-08'), waterDue: 50 },
      { ...blankBill('old-removed-room', '2026-09'), waterDue: 9999 },
    ],
  };
  const report = monthly(ops, plan, '2026-09');
  assert.equal(report.waterDue, 24);
  assert.equal(report.powerDue, 0);
  assert.equal(report.rentDue, null);
  assert.equal(report.bills.length, 1);
});
test('operations roundtrip preserves independent monthly and daily records', () => {
  const ops = {
    schemaVersion: 1,
    bills: [
      {
        ...blankBill('room', '2026-09'),
        waterUsage: 12,
        waterDue: 36,
        waterPaid: 12,
        dueDate: '2026-09-15',
      },
    ],
    parking: [
      {
        date: '2026-09-07',
        income: 168.5,
        vehicles: 11,
        notes: '日报',
        updatedAt: '',
      },
    ],
    pipes: [
      {
        id: 'pipe',
        name: '供水',
        kind: 'water',
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 8 },
        ],
        notes: '',
      },
    ],
    tenders: [],
  };
  assert.deepEqual(validateOperations(JSON.parse(JSON.stringify(ops))), ops);
  const copied = validateOperations(ops);
  copied.bills[0].waterDue = 100;
  assert.equal(ops.bills[0].waterDue, 36);
});
test('reject invalid dates, duplicates, negative amounts, overpayments and malformed pipes', () => {
  const valid = () => ({
    schemaVersion: 1,
    bills: [{ ...blankBill('a', '2026-09'), rentDue: 100, rentPaid: 0 }],
    parking: [],
    pipes: [],
  });
  for (const mutate of [
    (o) => o.bills.push({ ...o.bills[0] }),
    (o) => (o.bills[0].rentDue = -1),
    (o) => (o.bills[0].rentPaid = 101),
    (o) => (o.bills[0].rentDue = null),
    (o) => (o.bills[0].dueDate = '2026-02-30'),
    (o) => (o.bills[0].month = '2026-13'),
    (o) => (o.bills[0].powerUsage = Infinity),
    (o) =>
      o.parking.push({
        date: '2026-09-01',
        income: -1,
        vehicles: null,
        notes: '',
        updatedAt: '',
      }),
    (o) =>
      o.pipes.push({
        id: 'p',
        name: 'bad',
        kind: 'power',
        points: [{ x: 0, y: 0 }],
        notes: '',
      }),
  ]) {
    const o = valid();
    mutate(o);
    assert.throws(() => validateOperations(o));
  }
});
test('heat map distinguishes zero from missing and caps maximum', () => {
  assert.notEqual(heat(null, 0, 'water'), heat(0, 0, 'water'));
  assert.equal(heat(200, 100, 'power'), heat(100, 100, 'power'));
  assert.notEqual(heat(0, 100, 'water'), heat(100, 100, 'water'));
});

test('annual rent retains coverage and prevents duplicate monthly charging', () => {
  const annual = { ...blankBill('a', '2026-09'), rentMonths: 12, rentStartMonth: '2026-09', rentDue: 12000, rentPaid: 12000 };
  const ops = { ...emptyOperations, bills: [annual] };
  assert.equal(validateOperations(JSON.parse(JSON.stringify(ops))).bills[0].rentMonths, 12);
  assert.throws(() => validateOperations({ ...ops, bills: [annual, { ...blankBill('a', '2027-08'), rentDue: 1000 }] }), /重叠/);
  assert.doesNotThrow(() => validateOperations({ ...ops, bills: [annual, { ...blankBill('a', '2027-09'), rentDue: 1000 }] }));
  assert.doesNotThrow(() => validateOperations({ ...ops, bills: [annual, { ...blankBill('a', '2026-10'), powerDue: 12 }] }));
});
test('meter bill intervals reject overlapping usage and accept adjacent readings', () => {
  const first = { ...blankBill('a', '2026-09'), powerUsage: 1.79, powerDue: 1.79, powerMeter: { address: 'meter', startKwh: 0, endKwh: 1.79, readingAt: '2026-09-15 10:33:28' } };
  const next = { ...blankBill('a', '2026-10'), powerUsage: 1, powerDue: 2, powerMeter: { address: 'meter', startKwh: 1.79, endKwh: 2.79, readingAt: '2026-10-01 00:00:00' } };
  assert.doesNotThrow(() => validateOperations({ ...emptyOperations, bills: [first, next] }));
  assert.throws(() => validateOperations({ ...emptyOperations, bills: [first, { ...next, powerUsage: 1.79, powerMeter: { ...next.powerMeter, startKwh: 1 } }] }), /重复/);
});

test('legacy bills migrate property fees without inventing income; property fees aggregate', () => {
  const old = { ...blankBill('a', '2026-09') };
  delete old.propertyDue; delete old.propertyPaid;
  const migrated = validateOperations({ ...emptyOperations, bills: [old] });
  assert.equal(migrated.bills[0].propertyDue, null);
  assert.equal(migrated.bills[0].propertyPaid, null);
  const bill = { ...migrated.bills[0], propertyDue: 120, propertyPaid: 20 };
  const ops = validateOperations({ ...emptyOperations, bills: [bill] });
  assert.equal(balance(ops.bills[0]), 100);
  assert.equal(monthly(ops, { elements: [{id:'a'}] }, '2026-09').propertyPaid, 20);
  assert.throws(() => validateOperations({ ...emptyOperations, bills: [{ ...bill, propertyPaid: 121 }] }));
});
