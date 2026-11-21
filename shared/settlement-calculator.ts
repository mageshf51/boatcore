import { Decimal } from 'decimal.js';
import { captainIdFor } from './captain-rules.ts';
import type { Entity } from './models.ts';
const D = (v: Decimal.Value = 0) => new Decimal(v);
export const money = (v: Decimal.Value) =>
  D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
export function calculateSettlement(
  tripId: string,
  sales: Entity[],
  expenses: Entity[],
  crew: Entity[],
  saved: Partial<Entity> = {},
  settings = { commissionPercent: '2', crewPercent: '21' },
) {
  const linkedSales = sales.filter((s) => s.tripId === tripId),
    linkedExpenses = expenses.filter((e) => e.tripId === tripId);
  const sum = (xs: Entity[]) => xs.reduce((n, x) => n.plus(x.amount), D(0));
  const sourceCash = sum(linkedSales.filter((x) => x.type === 'cash')),
    sourceSales = sum(linkedSales.filter((x) => x.type === 'sale'));
  const cash = D(
      saved.cashOverride === null || saved.cashOverride === undefined
        ? sourceCash
        : saved.cashOverride || 0,
    ),
    gross = D(
      saved.salesOverride === null || saved.salesOverride === undefined
        ? sourceSales
        : saved.salesOverride || 0,
    );
  const commission = cash
    .mul(0)
    .plus(gross.mul(settings.commissionPercent).div(100))
    .toDecimalPlaces(2);
  const deduction = D(saved.deduction || 0),
    revenue = cash.plus(gross).minus(commission).minus(deduction);
  const expense = sum(linkedExpenses),
    linkedDeducted = linkedExpenses.filter((e) => (saved.deductedExpenseIds || []).includes(e.id));
  const included = sum(linkedDeducted);
  const pool = Decimal.max(0, revenue).mul(settings.crewPercent).div(100).toDecimalPlaces(2);
  const captainId = captainIdFor(crew, saved.captainId);
  const hasExtra = (id: string) => id === captainId && saved.extraShareIds?.includes(id);
  const units = crew.reduce((n, c) => n.plus(hasExtra(c.id) ? '1.5' : 1), D(0));
  const sorted = [...crew].sort((a, b) => a.serial - b.serial);
  // Largest remainder, with serial-number tie break, keeps payouts equal to pool to the paisa.
  const cents = pool.mul(100).toNumber();
  const raw = sorted.map((c) => ({
    crewId: c.id,
    name: c.name,
    weight: hasExtra(c.id) ? '1.5' : '1',
    raw: units.isZero()
      ? D(0)
      : pool
          .mul(100)
          .mul(hasExtra(c.id) ? '1.5' : 1)
          .div(units),
  }));
  const allocations = raw.map((c) => ({ ...c, cents: c.raw.floor().toNumber() }));
  let remaining = crew.length ? cents - allocations.reduce((n, c) => n + c.cents, 0) : 0;
  const order = [...allocations].sort((a, b) => b.raw.minus(b.cents).cmp(a.raw.minus(a.cents)));
  for (let i = 0; remaining > 0; i++, remaining--) order[i % order.length].cents++;
  const wages = D(saved.wages || 0),
    profit = revenue.minus(expense.minus(included)).minus(pool).minus(wages);
  return {
    sourceCash: money(sourceCash),
    sourceSales: money(sourceSales),
    cash: money(cash),
    grossSales: money(gross),
    commission: money(commission),
    netSales: money(gross.minus(commission)),
    deduction: money(deduction),
    revenue: money(revenue),
    expenses: money(expense),
    includedExpenses: money(included),
    crewPool: money(pool),
    wages: money(wages),
    profit: money(profit),
    totalUnits: units.toString(),
    undistributed: crew.length ? '0.00' : money(pool),
    payouts: allocations.map((c) => ({
      crewId: c.crewId,
      name: c.name,
      weight: c.weight,
      amount: money(D(c.cents).div(100)),
    })),
  };
}
export function expenseBalance(expense: Entity) {
  const paid = (expense.payments || []).reduce(
    (n: Decimal, p: { amount: string }) => n.plus(p.amount),
    D(0),
  );
  const balance = D(expense.amount).minus(paid);
  return {
    paid: money(paid),
    balance: money(balance),
    status: balance.isZero() ? 'Paid' : paid.isZero() ? 'Pending' : 'Partially Paid',
  };
}
