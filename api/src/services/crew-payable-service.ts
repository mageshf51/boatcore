import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import type { Snapshot, Entity, User } from '../../../shared/models.ts';
import {
  crewLedger,
  paymentFor,
  saleBalance,
  outstandingAdvance,
} from '../../../shared/crew-ledger.ts';
import { money } from '../../../shared/settlement-calculator.ts';
import { HttpError, requireWrite, assert, audit } from './service-utils.ts';
const amount = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use an amount with up to 2 decimal places');
const date = z.iso.date(),
  note = z.string().max(2000).default('');
function finance(s: Snapshot, u: User) {
  requireWrite(u);
  const fields = s.settings.fieldVisibility[u.role];
  if (!fields.includes('*') && !fields.includes('finance'))
    throw new HttpError(403, 'Finance access required');
}
function record(data: object, old?: Entity): Entity {
  const now = new Date().toISOString();
  return {
    id: old?.id || randomUUID(),
    createdAt: old?.createdAt || now,
    updatedAt: now,
    version: (old?.version || 0) + 1,
    ...data,
  };
}
export function addAdvance(s: Snapshot, u: User, body: unknown) {
  finance(s, u);
  const value = z.object({ crewId: z.uuid(), date, amount, notes: note }).parse(body);
  assert(
    s.entities.crew.some((c) => c.id === value.crewId && c.active),
    'Choose an active crew member',
  );
  assert(new Decimal(value.amount).gt(0), 'Advance must be positive');
  const result = record({ ...value, amount: money(value.amount), actor: u.name });
  s.entities.advances.push(result);
  audit(s, u, 'advance', 'advances', null, result);
  return result;
}
export function saveWages(s: Snapshot, u: User, body: unknown, id?: string) {
  finance(s, u);
  const value = z
    .object({
      date,
      notes: note,
      version: z.number().int().optional(),
      members: z
        .array(z.object({ crewId: z.uuid(), amount }))
        .min(1)
        .max(100),
    })
    .parse(body);
  const old = id ? s.entities.wages.find((w) => w.id === id) : undefined;
  if (id && !old) throw new HttpError(404, 'Wage entry not found');
  if (old && old.version !== value.version) throw new HttpError(409, 'Wage entry changed; reload');
  assert(
    new Set(value.members.map((m) => m.crewId)).size === value.members.length,
    'Duplicate crew selection',
  );
  for (const member of value.members) {
    assert(
      s.entities.crew.some(
        (c) =>
          c.id === member.crewId && (c.active || old?.members.some((m: any) => m.crewId === c.id)),
      ),
      'Unknown or inactive crew member',
    );
    assert(new Decimal(member.amount).gt(0), 'Each wage must be positive');
  }
  if (old) {
    const paid = s.entities.crewPayments.filter(
      (p) => p.sourceType === 'wage' && p.sourceId === old.id,
    );
    for (const payment of paid) {
      const newMember = value.members.find((m) => m.crewId === payment.crewId);
      assert(
        newMember && new Decimal(newMember.amount).eq(payment.salary),
        'A paid wage cannot be removed or changed',
      );
    }
    assert(!paid.length || value.date === old.date, 'Date is locked after a wage payment');
  }
  const result = record(
    {
      date: value.date,
      notes: value.notes,
      members: value.members.map((m) => ({
        ...m,
        amount: money(m.amount),
        name: s.entities.crew.find((c) => c.id === m.crewId)!.name,
      })),
      amount: money(value.members.reduce((n, m) => n.plus(m.amount), new Decimal(0))),
      actor: u.name,
    },
    old,
  );
  if (old) s.entities.wages = s.entities.wages.map((w) => (w.id === id ? result : w));
  else s.entities.wages.push(result);
  audit(s, u, old ? 'update' : 'create', 'wages', old || null, result);
  return result;
}
export function payCrew(s: Snapshot, u: User, body: unknown) {
  finance(s, u);
  const value = z
    .object({
      sourceType: z.enum(['trip', 'wage']),
      sourceId: z.uuid(),
      crewId: z.uuid(),
      revision: z.string().max(200),
      date,
      mode: z.enum(['net', 'full']).default('net'),
      confirmExcess: z.boolean().default(false),
      notes: note,
    })
    .parse(body);
  if (paymentFor(s, value.sourceType, value.sourceId, value.crewId))
    throw new HttpError(409, 'This salary has already been paid');
  const row = crewLedger(s).pending.find(
    (r) =>
      r.sourceType === value.sourceType &&
      r.sourceId === value.sourceId &&
      r.crewId === value.crewId,
  );
  if (!row) throw new HttpError(404, 'Salary not found');
  assert(row.ready, 'Complete the trip settlement before paying its final shares');
  if (row.revision !== value.revision)
    throw new HttpError(409, 'Salary or advance changed; reload and confirm the new balance');
  assert(row.isFirst, "Settle this crew member's earlier pending salary first");
  assert(value.date >= row.date, 'Payment cannot precede salary date');
  assert(
    s.entities.advances.filter((a) => a.crewId === value.crewId).every((a) => a.date <= value.date),
    'Payment date cannot precede this crew member’s latest advance',
  );
  const excess = new Decimal(row.overdue).gt(0);
  assert(
    !excess || value.confirmExcess,
    'Advance exceeds salary; explicit confirmation is required',
  );
  assert(
    value.mode !== 'full' || excess,
    'Full salary override is only for an advance exceeding salary',
  );
  const applied = value.mode === 'full' ? '0.00' : row.appliedAdvance;
  const cash = money(new Decimal(row.salary).minus(applied));
  const result = record({
    sourceType: value.sourceType,
    sourceId: value.sourceId,
    crewId: value.crewId,
    tripId: row.tripId,
    date: value.date,
    notes: value.notes,
    salary: row.salary,
    amount: cash,
    appliedAdvance: applied,
    advanceBefore: money(outstandingAdvance(s, row.crewId)),
    advanceAfter: money(outstandingAdvance(s, row.crewId).minus(applied)),
    mode: value.mode,
    actor: u.name,
    name: row.name,
    sourceLabel: row.trip,
    status: 'Paid',
  });
  s.entities.crewPayments.push(result);
  audit(s, u, 'salary-paid', 'crewPayments', null, result);
  return result;
}
export function receiveSalePayment(s: Snapshot, u: User, id: string, body: unknown) {
  finance(s, u);
  const v = z.object({ amount, date, version: z.number().int(), notes: note }).parse(body);
  const sale = s.entities.sales.find((x) => x.id === id && x.type === 'sale');
  if (!sale) throw new HttpError(404, 'Buyer sale not found');
  if (sale.version !== v.version) throw new HttpError(409, 'Sale changed; reload');
  const balance = saleBalance(sale);
  assert(
    new Decimal(v.amount).gt(0) && new Decimal(v.amount).lte(balance.balance),
    'Receipt must be positive and no greater than balance',
  );
  assert(v.date >= sale.date, 'Receipt cannot precede sale date');
  const before = structuredClone(sale);
  sale.payments ||= [];
  sale.payments.push({
    id: randomUUID(),
    amount: money(v.amount),
    date: v.date,
    notes: v.notes,
    actor: u.name,
    at: new Date().toISOString(),
  });
  sale.version++;
  sale.updatedAt = new Date().toISOString();
  audit(s, u, 'receipt', 'sales', before, sale);
  return sale;
}
