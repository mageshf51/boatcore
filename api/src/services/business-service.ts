import { normalizeSnapshot } from '../../../shared/normalize-snapshot.ts';
import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { schemas } from '../validation/entity-schemas.ts';
import {
  calculateSettlement,
  expenseBalance,
  money,
} from '../../../shared/settlement-calculator.ts';
import type { Snapshot, Entity, Kind, User } from '../../../shared/models.ts';
export { HttpError, requireWrite, audit, tripFor } from './service-utils.ts';
import { HttpError, requireWrite, audit, tripFor, assert } from './service-utils.ts';
import { tripSummary, crewLedger, ownerTotals } from '../../../shared/crew-ledger.ts';
import { captainIdFor } from '../../../shared/captain-rules.ts';
export function settlementFor(s: Snapshot, trip: Entity, saved?: Partial<Entity>) {
  if (!saved) return tripSummary(s, trip);
  return calculateSettlement(
    trip.id,
    s.entities.sales,
    s.entities.expenses,
    s.entities.crew.filter((c) => trip.crewIds.includes(c.id)),
    { ...saved, captainId: trip.captainId },
    s.settings,
  );
}
export function upsert(s: Snapshot, u: User, kind: Kind, body: unknown, id?: string) {
  requireWrite(u);
  if (['advances', 'wages', 'crewPayments'].includes(kind))
    throw new HttpError(400, 'Use the crew ledger endpoints');
  const visible = s.settings.fieldVisibility[u.role];
  if (
    ['sales', 'expenses', 'settlements'].includes(kind) &&
    !visible.includes('*') &&
    !visible.includes('finance')
  )
    throw new HttpError(403, 'Finance access required');
  const input = body as Record<string, unknown>;
  const old = id ? s.entities[kind].find((x) => x.id === id) : null;
  if (id && !old) throw new HttpError(404, 'Record not found');
  if (old && input.version !== old.version)
    throw new HttpError(409, 'This record changed. Reload before saving.');
  if (kind === 'messages' && old) throw new HttpError(400, 'Messages cannot be edited');
  const value = schemas[kind].parse(body) as Record<string, any>;
  if (kind === 'trips') {
    assert(!old?.completed, 'Completed trips are archived');
    assert(new Set(value.crewIds).size === value.crewIds.length, 'Duplicate crew selection');
    assert(
      value.crewIds.every((cid: string) =>
        s.entities.crew.some((c) => c.id === cid && (c.active || old?.crewIds.includes(cid))),
      ),
      'Unknown or inactive crew member',
    );
    const selected = s.entities.crew.filter((c) => value.crewIds.includes(c.id));
    const captain = captainIdFor(selected, value.captainId);
    assert(
      !value.captainId || captain === value.captainId,
      'Captain must be an eligible selected crew member',
    );
    value.captainId = captain;
    assert(
      !value.returnDate || value.returnDate >= value.departure,
      'Return cannot be before departure',
    );
    const linked = [...s.entities.sales, ...s.entities.expenses].filter((r) => r.tripId === id);
    assert(
      linked.every(
        (r) => r.date >= value.departure && (!value.returnDate || r.date <= value.returnDate),
      ),
      'Trip dates must include its transactions',
    );
  }
  if (['sales', 'expenses', 'settlements'].includes(kind)) {
    const trip = tripFor(s, value.tripId);
    assert(!trip.completed, 'Completed trips are archived');
    assert(!old || old.tripId === value.tripId, 'A saved record cannot move to another trip');
    if (value.date)
      assert(
        value.date >= trip.departure && (!trip.returnDate || value.date <= trip.returnDate),
        'Transaction date must be within the trip dates',
      );
  }
  if (kind === 'crew' || kind === 'products')
    assert(
      !s.entities[kind].some(
        (x) =>
          x.id !== id &&
          (x.name.toLowerCase() === value.name.toLowerCase() ||
            (kind === 'crew' && x.serial === value.serial)),
      ),
      'Name or serial number already exists',
    );
  if (kind === 'sales') {
    assert(new Decimal(value.amount).greaterThan(0), 'Amount must be positive');
    assert(value.type === 'cash' || value.buyer.trim(), 'Buyer is required');
    assert(!old || old.type === value.type, 'Transaction type cannot change after saving');
    const initialPaid = value.initialPaid ?? value.amount;
    value.payments =
      old?.payments ??
      (old
        ? [
            {
              id: randomUUID(),
              amount: old.amount,
              date: old.date,
              actor: 'Legacy receipt',
              at: old.createdAt,
            },
          ]
        : []);
    if (!old && new Decimal(initialPaid).gt(0))
      value.payments = [
        {
          id: randomUUID(),
          amount: money(initialPaid),
          date: value.date,
          actor: u.name,
          at: new Date().toISOString(),
        },
      ];
    assert(
      value.type === 'cash' || new Decimal(expenseBalance(value as Entity).balance).gte(0),
      'Receipts exceed bill amount',
    );
    delete value.initialPaid;
  }
  if (kind === 'expenses') {
    assert(
      s.entities.products.some(
        (p) => p.id === value.productId && (p.active || old?.productId === p.id),
      ),
      'Unknown product',
    );
    assert(new Decimal(value.quantity).gt(0), 'Quantity must be positive');
    value.amount = money(new Decimal(value.quantity).mul(value.unitPrice));
    value.payments = old?.payments || [];
    if (!old && new Decimal(value.initialPaid || 0).gt(0))
      value.payments = [
        {
          id: randomUUID(),
          amount: money(value.initialPaid),
          date: value.date,
          actor: u.name,
          at: new Date().toISOString(),
        },
      ];
    assert(
      new Decimal(expenseBalance(value as Entity).balance).gte(0),
      'Payments exceed the expense total',
    );
    delete value.initialPaid;
  }
  if (kind === 'sales' || kind === 'expenses')
    if (value.attachmentId)
      assert(
        (s as any).attachments?.some(
          (a: any) => a.id === value.attachmentId && a.userId === u.id,
        ) || old?.attachmentId === value.attachmentId,
        'Attachment unavailable',
      );
  if (kind === 'settlements') {
    assert(
      !s.entities.settlements.some((x) => x.tripId === value.tripId && x.id !== id),
      'Settlement already exists; reload',
    );
    const trip = tripFor(s, value.tripId);
    assert(
      new Set(value.extraShareIds).size === value.extraShareIds.length &&
        value.extraShareIds.length <= 1 &&
        value.extraShareIds.every(
          (cid: string) =>
            cid ===
            captainIdFor(
              s.entities.crew.filter((c) => trip.crewIds.includes(c.id)),
              trip.captainId,
            ),
        ),
      'Invalid extra share selection',
    );
    assert(
      new Set(value.deductedExpenseIds).size === value.deductedExpenseIds.length,
      'Duplicate expense selection',
    );
    const included = value.deductedExpenseIds.map((eid: string) =>
      s.entities.expenses.find((e) => e.id === eid && e.tripId === value.tripId),
    );
    assert(included.every(Boolean), 'Invalid expense deduction');
    assert(
      included
        .reduce((n: Decimal, e: Entity) => n.plus(e.amount), new Decimal(0))
        .lte(value.deduction),
      'Manual deduction must cover expenses marked as included',
    );
    assert(
      (value.cashOverride === null && value.salesOverride === null) || value.overrideReason.trim(),
      'Override reason is required',
    );
    const source = settlementFor(s, trip, {});
    value.sourceCash = source.sourceCash;
    value.sourceSales = source.sourceSales;
    value.overrideBy = u.name;
    value.overrideAt = new Date().toISOString();
  }
  if (kind === 'messages') {
    value.author = u.name;
    value.userId = u.id;
  }
  const now = new Date().toISOString();
  const record: Entity = {
    ...value,
    id: id || randomUUID(),
    version: (old?.version || 0) + 1,
    createdAt: old?.createdAt || now,
    updatedAt: now,
  };
  if (kind === 'trips') record.completed = old?.completed || false;
  if (old) s.entities[kind] = s.entities[kind].map((r) => (r.id === id ? record : r));
  else s.entities[kind].push(record);
  audit(s, u, old ? 'update' : 'create', kind, old || null, record);
  return record;
}
export const paymentSchema = z.object({
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  date: z.iso.date(),
  version: z.number().int(),
  notes: z.string().max(2000).default(''),
});
export function addPayment(s: Snapshot, u: User, id: string, body: unknown) {
  requireWrite(u);
  const visible = s.settings.fieldVisibility[u.role];
  if (!visible.includes('*') && !visible.includes('finance'))
    throw new HttpError(403, 'Finance access required');
  const v = paymentSchema.parse(body);
  const e = s.entities.expenses.find((x) => x.id === id);
  if (!e) throw new HttpError(404, 'Expense not found');
  if (e.version !== v.version) throw new HttpError(409, 'Expense changed; reload');
  assert(
    new Decimal(v.amount).gt(0) && new Decimal(v.amount).lte(expenseBalance(e).balance),
    'Invalid payment amount',
  );
  assert(v.date >= e.date, 'Payment date cannot precede expense');
  const before = structuredClone(e);
  e.payments.push({
    id: randomUUID(),
    amount: money(v.amount),
    notes: v.notes,
    date: v.date,
    actor: u.name,
    at: new Date().toISOString(),
  });
  e.version++;
  e.updatedAt = new Date().toISOString();
  audit(s, u, 'payment', 'expenses', before, e);
  return e;
}
export function completeTrip(s: Snapshot, u: User, id: string, version: number) {
  requireWrite(u);
  const visible = s.settings.fieldVisibility[u.role];
  if (!visible.includes('*') && !visible.includes('finance'))
    throw new HttpError(403, 'Finance access required');
  const trip = tripFor(s, id);
  if (trip.version !== version) throw new HttpError(409, 'Trip changed; reload');
  assert(!trip.completed, 'Trip already complete');
  assert(trip.returnDate, 'End the trip before completing settlement');
  assert(
    s.entities.settlements.some((x) => x.tripId === id),
    'Save the settlement first',
  );
  const before = structuredClone(trip);
  trip.archiveSummary = settlementFor(s, trip);
  trip.archiveCrew = structuredClone(
    s.entities.crew.filter((c) => trip.crewIds.includes(c.id)).sort((a, b) => a.serial - b.serial),
  );
  trip.completed = true;
  trip.version++;
  trip.updatedAt = new Date().toISOString();
  audit(s, u, 'complete', 'trips', before, trip);
  return trip;
}
export function publicState(s: Snapshot, u: User) {
  normalizeSnapshot(s);
  const allowed = s.settings.fieldVisibility[u.role];
  const entities = structuredClone(s.entities);
  if (!allowed.includes('*') && !allowed.includes('finance')) {
    for (const key of [
      'sales',
      'expenses',
      'settlements',
      'advances',
      'wages',
      'crewPayments',
    ] as Kind[])
      entities[key] = [];
    for (const trip of entities.trips) delete trip.archiveSummary;
  }
  const visibleAudit = structuredClone(
    allowed.includes('*')
      ? s.audit
      : s.audit.filter(
          (a) =>
            a.kind !== 'settings' &&
            a.kind !== 'users' &&
            (allowed.includes('finance') ||
              !['sales', 'expenses', 'settlements', 'advances', 'wages', 'crewPayments'].includes(
                a.kind,
              )),
        ),
  );
  if (!allowed.includes('*') && !allowed.includes('finance'))
    for (const event of visibleAudit) {
      if (event.before) delete event.before.archiveSummary;
      if (event.after) delete event.after.archiveSummary;
    }
  return {
    user: u,
    entities,
    settings: s.settings,
    team: s.users.filter((x) => x.active).map(({ id, name, role }) => ({ id, name, role })),
    summaries:
      allowed.includes('*') || allowed.includes('finance')
        ? s.entities.trips.map((t) => ({
            tripId: t.id,
            departure: t.departure,
            ...settlementFor(s, t),
          }))
        : [],
    audit: visibleAudit,
    crewLedger:
      allowed.includes('*') || allowed.includes('finance')
        ? crewLedger(s)
        : { pending: [], crew: [], payments: [] },
    ownerTotals:
      allowed.includes('*') || allowed.includes('finance')
        ? ownerTotals(s)
        : { landWages: '0.00', profit: '0.00' },
    mode: process.env.DATA_MODE || 'sqlserver',
  };
}
