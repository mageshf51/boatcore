import { randomUUID } from 'node:crypto';
import type { Snapshot, Entity, Role } from '../../../shared/models.ts';
import { hashPin } from '../security/pin-security.ts';
export function seed(s: Snapshot, sample = false, demo = false) {
  if (s.users.length) return;
  const config =
    process.env.SEED_USERS_JSON ||
    (demo
      ? JSON.stringify([
          { name: 'Operator One', pin: '2601', role: 'operator' },
          { name: 'Operator Two', pin: '2602', role: 'operator' },
          { name: 'Operator Three', pin: '2603', role: 'operator' },
          { name: 'Admin', pin: '2604', role: 'admin' },
          { name: 'Guest', pin: '2605', role: 'guest' },
        ])
      : '');
  if (!config) throw Error('Set SEED_USERS_JSON in api/.env before seeding.');
  const users = JSON.parse(config);
  if (!Array.isArray(users) || new Set(users.map((u) => u.pin)).size !== users.length)
    throw Error('Unique PINs required');
  s.users = users.map((u: { name: string; pin: string; role: Role }) => {
    if (!/^\d{4}$/.test(u.pin) || !['admin', 'operator', 'guest'].includes(u.role))
      throw Error('Invalid seed user');
    return { id: randomUUID(), name: u.name, role: u.role, pinHash: hashPin(u.pin), active: true };
  });
  const now = new Date().toISOString();
  const e = (data: object): Entity => ({
    id: randomUUID(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...data,
  });
  s.entities.products = ['Diesel', 'Ice', 'Food', 'Maintenance'].map((name) =>
    e({ name, unit: name === 'Diesel' ? 'litre' : name === 'Ice' ? 'kg' : 'item', active: true }),
  );
  if (!sample) return;
  s.entities.crew = [
    'Arun (Captain)',
    'Kumar',
    'Selvam',
    'Ravi',
    'Mani',
    'Bala',
    'Suresh',
    'Velu',
    'Raja',
    'Rajan',
    'Meena',
    'Operator Three',
  ].map((name, i) => e({ name, serial: i + 1, isCaptain: i === 0, active: true }));
  for (let i = 0; i < 7; i++) {
    const departure = `2026-${String(5 + i).padStart(2, '0')}-05`;
    const trip = e({
      name: `Demo Boat · Voyage ${String(i + 1).padStart(3, '0')}`,
      departure,
      returnDate: i < 6 ? `2026-${String(5 + i).padStart(2, '0')}-14` : null,
      crewIds: s.entities.crew.map((c) => c.id),
      notes: 'Fictional portfolio demonstration data',
      completed: i < 6,
    });
    s.entities.trips.push(trip);
    s.entities.sales.push(
      e({
        tripId: trip.id,
        type: 'cash',
        date: departure,
        amount: '100000.00',
        buyer: '',
        notes: 'Cash credit',
      }),
      e({
        tripId: trip.id,
        type: 'sale',
        date: departure,
        amount: String(200000 + i * 25000),
        buyer: 'Harbour Fish Traders',
        phone: '',
        notes: 'Fictional buyer',
      }),
    );
    s.entities.expenses.push(
      e({
        tripId: trip.id,
        date: departure,
        productId: s.entities.products[0].id,
        quantity: '1000',
        unitPrice: '85',
        amount: '85000.00',
        payments: [
          { id: randomUUID(), amount: '50000.00', date: departure, actor: 'Admin', at: now },
        ],
        notes: 'Fuel',
        attachmentId: null,
      }),
    );
    s.entities.settlements.push(
      e({
        tripId: trip.id,
        deduction: '15000.00',
        wages: '12000.00',
        extraShareIds: [s.entities.crew[0].id],
        deductedExpenseIds: [],
        cashOverride: null,
        salesOverride: null,
        overrideReason: '',
        locked: i < 6,
      }),
    );
  }
  s.entities.messages.push(
    e({
      text: 'Welcome to BoatCore. This workspace contains fictional demonstration records.',
      author: 'Admin',
      userId: s.users.find((u) => u.role === 'admin')!.id,
    }),
  );
}
