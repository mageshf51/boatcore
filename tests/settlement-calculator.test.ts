import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from 'decimal.js';
import { calculateSettlement, expenseBalance } from '../shared/settlement-calculator.ts';
import type { Entity } from '../shared/models.ts';
const entity = (data: object) =>
  ({ id: 'x', version: 1, createdAt: '', updatedAt: '', ...data }) as Entity;
const crew = Array.from({ length: 12 }, (_, i) =>
  entity({ id: `crew-${i}`, serial: i + 1, name: `Crew ${i}`, isCaptain: i === 0 }),
);
test('cash is commission-free and the corrected settlement is ₹379,000', () => {
  const s = calculateSettlement(
    'trip',
    [
      entity({ tripId: 'trip', type: 'cash', amount: '100000' }),
      entity({ tripId: 'trip', type: 'sale', amount: '300000' }),
    ],
    [],
    crew,
    { deduction: '15000' },
  );
  assert.equal(s.commission, '6000.00');
  assert.equal(s.revenue, '379000.00');
  assert.equal(s.crewPool, '79590.00');
});
test('12 crew and captain 1.5 shares reconcile ₹82,740 exactly', () => {
  const s = calculateSettlement(
    'trip',
    [entity({ tripId: 'trip', type: 'cash', amount: '394000' })],
    [],
    crew,
    { extraShareIds: ['crew-0'] },
  );
  assert.equal(s.totalUnits, '12.5');
  assert.equal(s.crewPool, '82740.00');
  assert.equal(s.payouts[0].amount, '9928.80');
  assert.equal(s.payouts[1].amount, '6619.20');
});
test('largest remainder allocation reconciles even awkward paisa amounts', () => {
  for (let i = 1; i < 250; i++) {
    const s = calculateSettlement(
      't',
      [entity({ tripId: 't', type: 'cash', amount: String(i / 100) })],
      [],
      crew,
      { extraShareIds: ['crew-0', 'crew-3'] },
    );
    const sum = s.payouts.reduce((n, c) => n.plus(c.amount), new Decimal(0));
    assert.equal(sum.toFixed(2), s.crewPool);
    assert.deepEqual(
      s,
      calculateSettlement(
        't',
        [entity({ tripId: 't', type: 'cash', amount: String(i / 100) })],
        [],
        crew,
        { extraShareIds: ['crew-0', 'crew-3'] },
      ),
    );
  }
});
test('no negative payouts, no division by zero, missing crew pool is explicit', () => {
  const negative = calculateSettlement('t', [], [], crew, { deduction: '500' });
  assert.equal(negative.crewPool, '0.00');
  assert.equal(negative.profit, '-500.00');
  assert(negative.payouts.every((p) => p.amount === '0.00'));
  const missing = calculateSettlement(
    't',
    [entity({ tripId: 't', type: 'cash', amount: '100' })],
    [],
    [],
  );
  assert.equal(missing.undistributed, '21.00');
});
test('linked expense is subtracted once and overrides retain source totals', () => {
  const expenses = [entity({ id: 'fuel', tripId: 't', amount: '1000' })];
  const s = calculateSettlement(
    't',
    [entity({ tripId: 't', type: 'cash', amount: '10000' })],
    expenses,
    crew,
    { deduction: '1000', deductedExpenseIds: ['fuel'], cashOverride: '12000', wages: '100' },
  );
  assert.equal(s.sourceCash, '10000.00');
  assert.equal(s.revenue, '11000.00');
  assert.equal(s.profit, '8590.00');
});
test('partial payments affect balance, not recorded expense amount', () => {
  const expense = entity({ amount: '1000', payments: [{ amount: '400' }, { amount: '100' }] });
  assert.deepEqual(expenseBalance(expense), {
    paid: '500.00',
    balance: '500.00',
    status: 'Partially Paid',
  });
});
