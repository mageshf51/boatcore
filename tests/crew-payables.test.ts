import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { emptySnapshot, type Entity, type User } from '../shared/models.ts';
import { normalizeSnapshot } from '../shared/normalize-snapshot.ts';
import {
  crewLedger,
  outstandingAdvance,
  ownerTotals,
  saleBalance,
  tripSummary,
} from '../shared/crew-ledger.ts';
import { upsert, completeTrip } from '../api/src/services/business-service.ts';
import {
  addAdvance,
  saveWages,
  payCrew,
  receiveSalePayment,
} from '../api/src/services/crew-payable-service.ts';
const user: User = { id: randomUUID(), name: 'Operator One', role: 'operator' };
const guest: User = { id: randomUUID(), name: 'Guest', role: 'guest' };
const e = (value: object): Entity => ({
  id: randomUUID(),
  version: 1,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...value,
});
function fixture() {
  const s = emptySnapshot();
  const crew = e({ name: 'Operator Three', serial: 1, isCaptain: true, active: true });
  s.entities.crew.push(crew);
  for (let i = 1; i <= 2; i++) {
    const trip = e({
      name: `Trip ${i}`,
      departure: `2026-11-0${i}`,
      returnDate: `2026-11-0${i + 1}`,
      crewIds: [crew.id],
      captainId: crew.id,
      completed: true,
    });
    s.entities.trips.push(trip);
    s.entities.sales.push(
      e({ tripId: trip.id, type: 'cash', date: trip.departure, amount: '10000' }),
    );
    s.entities.settlements.push(
      e({
        tripId: trip.id,
        deduction: '0',
        wages: '0',
        extraShareIds: [crew.id],
        deductedExpenseIds: [],
        cashOverride: null,
        salesOverride: null,
        overrideReason: '',
      }),
    );
  }
  normalizeSnapshot(s);
  return { s, crew };
}
function pay(
  s: ReturnType<typeof emptySnapshot>,
  mode: 'net' | 'full' = 'net',
  confirmExcess = true,
) {
  const row = crewLedger(s).pending.find((r) => r.ready && r.isFirst)!;
  return payCrew(s, user, {
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    crewId: row.crewId,
    revision: row.revision,
    date: '2026-11-19',
    mode,
    confirmExcess,
    notes: 'Test payment',
  });
}
test('captain-only rule rejects forged +0.5 for regular crew and respects per-trip captain', () => {
  const s = emptySnapshot();
  const captain = upsert(s, user, 'crew', { name: 'Captain', serial: 1, isCaptain: true }),
    regular = upsert(s, user, 'crew', { name: 'Regular', serial: 2, isCaptain: false });
  const trip = upsert(s, user, 'trips', {
    name: 'Captain test',
    departure: '2026-11-01',
    crewIds: [captain.id, regular.id],
    captainId: captain.id,
  });
  const input = {
    tripId: trip.id,
    deduction: '0',
    wages: '0',
    extraShareIds: [regular.id],
    deductedExpenseIds: [],
    cashOverride: null,
    salesOverride: null,
    overrideReason: '',
  };
  assert.throws(() => upsert(s, user, 'settlements', input), /Invalid extra share/);
  upsert(s, user, 'settlements', { ...input, extraShareIds: [captain.id] });
  assert.equal(tripSummary(s, trip).payouts[0].weight, '1.5');
  assert.equal(tripSummary(s, trip).payouts[1].weight, '1');
});
test('advance carries across two trips; rows leave pending after pay; recovery is not duplicated', () => {
  const { s, crew } = fixture();
  addAdvance(s, user, { crewId: crew.id, date: '2026-11-01', amount: '3000', notes: 'Advance' });
  let rows = crewLedger(s).pending;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].salary, '2100.00');
  assert.equal(rows[0].overdue, '900.00');
  assert.equal(rows[1].balance, '1200.00');
  assert.throws(() => pay(s, 'net', false), /explicit confirmation/);
  const first = pay(s);
  assert.equal(first.amount, '0.00');
  assert.equal(first.appliedAdvance, '2100.00');
  assert.equal(outstandingAdvance(s, crew.id).toFixed(2), '900.00');
  rows = crewLedger(s).pending;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].advance, '900.00');
  const second = pay(s);
  assert.equal(second.amount, '1200.00');
  assert.equal(crewLedger(s).pending.length, 0);
  assert.equal(outstandingAdvance(s, crew.id).toFixed(2), '0.00');
  assert.equal(s.entities.crewPayments.length, 2);
});
test('excess-advance full-salary override preserves debt and records the exact cash paid', () => {
  const { s, crew } = fixture();
  addAdvance(s, user, { crewId: crew.id, date: '2026-11-01', amount: '3000' });
  const payment = pay(s, 'full');
  assert.equal(payment.amount, '2100.00');
  assert.equal(payment.appliedAdvance, '0.00');
  assert.equal(payment.advanceAfter, '3000.00');
  assert.equal(crewLedger(s).pending.length, 1);
  assert.equal(crewLedger(s).pending[0].overdue, '900.00');
});
test('duplicate, stale and out-of-order crew payments are rejected', () => {
  const { s, crew } = fixture();
  const rows = crewLedger(s).pending;
  assert.throws(
    () =>
      payCrew(s, user, {
        sourceType: rows[1].sourceType,
        sourceId: rows[1].sourceId,
        crewId: crew.id,
        revision: rows[1].revision,
        date: '2026-11-19',
      }),
    /earlier pending/,
  );
  addAdvance(s, user, { crewId: crew.id, date: '2026-11-01', amount: '100' });
  assert.throws(
    () =>
      payCrew(s, user, {
        sourceType: rows[0].sourceType,
        sourceId: rows[0].sourceId,
        crewId: crew.id,
        revision: rows[0].revision,
        date: '2026-11-19',
      }),
    /changed/,
  );
  const first = pay(s);
  assert.throws(
    () =>
      payCrew(s, user, {
        sourceType: first.sourceType,
        sourceId: first.sourceId,
        crewId: crew.id,
        revision: 'old',
        date: '2026-11-19',
      }),
    /already been paid/,
  );
});
test('land wages allow per-person amounts, editable unpaid rows, and one owner-profit deduction', () => {
  const s = emptySnapshot();
  const a = e({ name: 'A', serial: 1, active: true }),
    b = e({ name: 'B', serial: 2, active: true });
  s.entities.crew.push(a, b);
  let batch = saveWages(s, user, {
    date: '2026-11-01',
    notes: 'Land work',
    members: [
      { crewId: a.id, amount: '300' },
      { crewId: b.id, amount: '500' },
    ],
  });
  assert.equal(batch.amount, '800.00');
  assert.equal(ownerTotals(s).profit, '-800.00');
  const first = pay(s);
  assert.equal(ownerTotals(s).profit, '-800.00');
  const paidId = first.crewId;
  assert.throws(
    () =>
      saveWages(
        s,
        user,
        { date: batch.date, version: batch.version, members: [{ crewId: paidId, amount: '999' }] },
        batch.id,
      ),
    /paid wage/,
  );
  batch = saveWages(
    s,
    user,
    {
      date: batch.date,
      version: batch.version,
      members: batch.members.map((m: any) => ({
        crewId: m.crewId,
        amount: m.crewId === paidId ? m.amount : '200',
      })),
    },
    batch.id,
  );
  assert.equal(crewLedger(s).pending.length, 1);
  assert.equal(crewLedger(s).pending[0].salary, '200.00');
  assert.equal(ownerTotals(s).landWages, String(Number(first.salary) + 200) + '.00');
});
test('buyer partial receipts close dues after trip completion without changing revenue', () => {
  const { s } = fixture();
  const trip = s.entities.trips[0];
  trip.completed = false;
  delete trip.archiveSummary;
  const sale = upsert(s, user, 'sales', {
    tripId: trip.id,
    type: 'sale',
    date: trip.departure,
    amount: '1000',
    buyer: 'Buyer',
    initialPaid: '200',
  });
  assert.equal(saleBalance(sale).balance, '800.00');
  trip.completed = true;
  const revenue = tripSummary(s, trip).revenue;
  receiveSalePayment(s, user, sale.id, {
    amount: '300',
    date: '2026-11-19',
    version: 1,
    notes: 'Part',
  });
  assert.equal(saleBalance(sale).balance, '500.00');
  assert.throws(
    () => receiveSalePayment(s, user, sale.id, { amount: '501', date: '2026-11-19', version: 2 }),
    /no greater/,
  );
  receiveSalePayment(s, user, sale.id, { amount: '500', date: '2026-11-19', version: 2 });
  assert.equal(saleBalance(sale).status, 'Paid');
  assert.equal(tripSummary(s, trip).revenue, revenue);
  assert.equal(s.entities.sales.find((x) => x.id === sale.id)!.payments.length, 3);
});
test('guest cannot write new crew advances, wages, payouts or receipts', () => {
  const { s, crew } = fixture();
  assert.throws(
    () => addAdvance(s, guest, { crewId: crew.id, date: '2026-11-01', amount: '10' }),
    /read only/,
  );
  assert.throws(() => saveWages(s, guest, {}), /read only/);
  assert.throws(() => payCrew(s, guest, {}), /read only/);
  assert.throws(() => receiveSalePayment(s, guest, 'x', {}), /read only/);
});
test('legacy upgrade preserves business records, freezes completed totals and invents no buyer dues', () => {
  const { s } = fixture();
  const legacy = structuredClone(s) as any;
  delete legacy.entities.advances;
  delete legacy.entities.wages;
  delete legacy.entities.crewPayments;
  delete legacy.entities.crew[0].isCaptain;
  legacy.entities.crew[0].name = 'Operator Three (Captain)';
  legacy.entities.sales.push(
    e({
      tripId: legacy.entities.trips[0].id,
      type: 'sale',
      amount: '100',
      date: '2026-11-01',
      buyer: 'Old fully paid buyer',
    }),
  );
  const upgraded = normalizeSnapshot(legacy);
  assert(upgraded.entities.crew[0].isCaptain);
  assert.equal(saleBalance(upgraded.entities.sales.at(-1)!).balance, '0.00');
  const before = tripSummary(upgraded, upgraded.entities.trips[0]);
  upgraded.entities.crew[0].isCaptain = false;
  assert.deepEqual(tripSummary(upgraded, upgraded.entities.trips[0]), before);
});
