import { Decimal } from 'decimal.js';
import type { Snapshot, Entity } from './models.ts';
import { calculateSettlement, money, expenseBalance } from './settlement-calculator.ts';
export type CrewSalary = {
  key: string;
  sourceType: 'trip' | 'wage';
  sourceId: string;
  crewId: string;
  name: string;
  tripId: string | null;
  trip: string;
  date: string;
  salary: string;
  advance: string;
  appliedAdvance: string;
  balance: string;
  overdue: string;
  ready: boolean;
  isFirst: boolean;
  revision: string;
  sourceVersion: number;
};
export function tripSummary(s: Snapshot, trip: Entity) {
  if (trip.completed && trip.archiveSummary) return trip.archiveSummary;
  return calculateSettlement(
    trip.id,
    s.entities.sales,
    s.entities.expenses,
    s.entities.crew.filter((c) => trip.crewIds.includes(c.id)),
    { ...s.entities.settlements.find((v) => v.tripId === trip.id), captainId: trip.captainId },
    s.settings,
  );
}
export const paymentFor = (s: Snapshot, sourceType: string, sourceId: string, crewId: string) =>
  s.entities.crewPayments.find(
    (p) => p.sourceType === sourceType && p.sourceId === sourceId && p.crewId === crewId,
  );
export function outstandingAdvance(s: Snapshot, crewId: string) {
  return new Decimal(
    s.entities.advances
      .filter((a) => a.crewId === crewId)
      .reduce((n, a) => n.plus(a.amount), new Decimal(0)),
  ).minus(
    s.entities.crewPayments
      .filter((p) => p.crewId === crewId)
      .reduce((n, p) => n.plus(p.appliedAdvance), new Decimal(0)),
  );
}
export function crewLedger(s: Snapshot) {
  const pending: CrewSalary[] = [];
  for (const trip of s.entities.trips) {
    if (!s.entities.settlements.some((v) => v.tripId === trip.id)) continue;
    const summary = tripSummary(s, trip);
    for (const payout of summary.payouts) {
      if (paymentFor(s, 'trip', trip.id, payout.crewId)) continue;
      pending.push({
        key: `trip:${trip.id}:${payout.crewId}`,
        sourceType: 'trip',
        sourceId: trip.id,
        crewId: payout.crewId,
        name: payout.name,
        tripId: trip.id,
        trip: trip.name,
        date: trip.returnDate || trip.departure,
        salary: payout.amount,
        advance: '0.00',
        appliedAdvance: '0.00',
        balance: payout.amount,
        overdue: '0.00',
        ready: Boolean(trip.completed),
        isFirst: false,
        revision: '',
        sourceVersion: trip.version,
      });
    }
  }
  for (const batch of s.entities.wages)
    for (const member of batch.members) {
      if (paymentFor(s, 'wage', batch.id, member.crewId)) continue;
      pending.push({
        key: `wage:${batch.id}:${member.crewId}`,
        sourceType: 'wage',
        sourceId: batch.id,
        crewId: member.crewId,
        name: s.entities.crew.find((c) => c.id === member.crewId)?.name || member.name || 'Crew',
        tripId: null,
        trip: batch.notes || 'Land wages',
        date: batch.date,
        salary: member.amount,
        advance: '0.00',
        appliedAdvance: '0.00',
        balance: member.amount,
        overdue: '0.00',
        ready: true,
        isFirst: false,
        revision: '',
        sourceVersion: batch.version,
      });
    }
  pending.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.sourceId.localeCompare(b.sourceId) ||
      a.crewId.localeCompare(b.crewId),
  );
  const remaining: Record<string, Decimal> = {},
    first = new Set<string>();
  for (const row of pending) {
    // Draft trip shares are informative only and do not reserve advances ahead of payable salaries.
    const available = remaining[row.crewId] ?? outstandingAdvance(s, row.crewId);
    const applied = Decimal.min(available, row.salary);
    row.advance = money(available);
    row.appliedAdvance = money(applied);
    row.balance = money(new Decimal(row.salary).minus(applied));
    row.overdue = money(Decimal.max(0, available.minus(row.salary)));
    if (row.ready) {
      row.isFirst = !first.has(row.crewId);
      first.add(row.crewId);
      remaining[row.crewId] = available.minus(applied);
    }
    row.revision = [
      row.sourceVersion,
      row.salary,
      money(outstandingAdvance(s, row.crewId)),
      s.entities.crewPayments.filter((p) => p.crewId === row.crewId).length,
    ].join('|');
  }
  return {
    pending,
    crew: s.entities.crew.map((c) => ({
      crewId: c.id,
      name: c.name,
      advance: money(outstandingAdvance(s, c.id)),
      pendingSalary: money(
        pending
          .filter((p) => p.crewId === c.id && p.ready)
          .reduce((n, p) => n.plus(p.salary), new Decimal(0)),
      ),
      pendingCount: pending.filter((p) => p.crewId === c.id && p.ready).length,
    })),
    payments: s.entities.crewPayments,
  };
}
export function saleBalance(sale: Entity) {
  if (sale.type === 'cash' || sale.payments === undefined)
    return { paid: money(sale.amount), balance: '0.00', status: 'Paid' };
  return expenseBalance(sale);
}
export function ownerTotals(s: Snapshot) {
  const landWages = s.entities.wages.reduce((n, w) => n.plus(w.amount), new Decimal(0));
  const profit = s.entities.trips
    .reduce((n, t) => n.plus(tripSummary(s, t).profit), new Decimal(0))
    .minus(landWages);
  return { landWages: money(landWages), profit: money(profit) };
}
