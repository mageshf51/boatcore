import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { emptySnapshot } from '../shared/models.ts';
import { seed } from '../api/src/services/seed-service.ts';
process.env.BOATCORE_TEST = '1';
const { createApp } = await import('../api/src/server.ts');
test('authenticated workflows, guest enforcement, conflicts, idempotency and archived records', async () => {
  let state = emptySnapshot();
  seed(state, false, true);
  const repo = {
    read: async () => structuredClone(state),
    transaction: async (fn: any) => {
      const next = structuredClone(state);
      const result = await fn(next);
      state = next;
      return result;
    },
    close: async () => {},
  };
  const server = createApp(repo).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  async function request(
    path: string,
    method = 'GET',
    body?: any,
    cookie = '',
    key = randomUUID(),
  ) {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-BoatCore-Client': 'web',
        'Idempotency-Key': key,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    };
  }
  try {
    let operator = '',
      guest = '';
    for (const [pin, name] of [
      ['2601', 'Operator One'],
      ['2602', 'Operator Two'],
      ['2603', 'Operator Three'],
      ['2604', 'Admin'],
      ['2605', 'Guest'],
    ]) {
      const r = await request('/auth/login', 'POST', { pin });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.name, name);
      if (pin === '2601') operator = r.cookie;
      if (pin === '2605') guest = r.cookie;
    }
    assert.equal((await request('/state')).status, 401);
    const g = await request('/state', 'GET', undefined, guest);
    assert(!JSON.stringify(g.body).includes('pinHash'));
    assert(!JSON.stringify(g.body).includes('2601'));
    assert.equal(
      (await request('/records/crew', 'POST', { name: 'Intruder', serial: 99 }, guest)).status,
      403,
    );
    assert.equal((await request('/settings', 'PUT', {}, operator)).status, 403);
    const noCsrf = await fetch(base + '/api/records/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: operator },
      body: '{}',
    });
    assert.equal(noCsrf.status, 403);
    const key = randomUUID();
    const c = await request('/records/crew', 'POST', { name: 'Captain', serial: 1 }, operator, key);
    assert.equal(c.status, 201);
    assert.equal(
      (await request('/records/crew', 'POST', { name: 'Captain', serial: 1 }, operator, key)).body
        .id,
      c.body.id,
    );
    assert.equal(state.entities.crew.length, 1);
    const p = state.entities.products[0];
    const trip = await request(
      '/records/trips',
      'POST',
      { name: 'Integration voyage', departure: '2026-11-01', crewIds: [c.body.id], notes: '' },
      operator,
    );
    assert.equal(trip.status, 201);
    const tripId = trip.body.id;
    const cash = await request(
      '/records/sales',
      'POST',
      { tripId, type: 'cash', date: '2026-11-02', amount: '100000' },
      operator,
    );
    assert.equal(cash.status, 201);
    assert.equal(
      (
        await request(
          '/records/sales',
          'POST',
          { tripId, type: 'sale', date: '2026-11-02', amount: '300000', buyer: 'Test Buyer' },
          operator,
        )
      ).status,
      201,
    );
    const expense = await request(
      '/records/expenses',
      'POST',
      {
        tripId,
        date: '2026-11-02',
        productId: p.id,
        quantity: '10',
        unitPrice: '100',
        initialPaid: '400',
      },
      operator,
    );
    assert.equal(expense.status, 201);
    assert.equal(
      (
        await request(
          `/expenses/${expense.body.id}/payments`,
          'POST',
          { version: 1, amount: '601', date: '2026-11-03' },
          operator,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/expenses/${expense.body.id}/payments`,
          'POST',
          { version: 1, amount: '600', date: '2026-11-03' },
          operator,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/expenses/${expense.body.id}/payments`,
          'POST',
          { version: 1, amount: '1', date: '2026-11-03' },
          operator,
        )
      ).status,
      409,
    );
    const settlement = await request(
      '/records/settlements',
      'POST',
      {
        tripId,
        deduction: '15000',
        wages: '0',
        extraShareIds: [],
        deductedExpenseIds: [],
        cashOverride: null,
        salesOverride: null,
        overrideReason: '',
      },
      operator,
    );
    assert.equal(settlement.status, 201);
    let snapshot = await request('/state', 'GET', undefined, operator);
    assert.equal(snapshot.body.summaries[0].revenue, '379000.00');
    assert.equal(
      (
        await request(
          `/records/trips/${tripId}`,
          'PUT',
          { ...trip.body, returnDate: '2026-10-31' },
          operator,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/records/trips/${tripId}`,
          'PUT',
          { ...trip.body, returnDate: '2026-11-10' },
          operator,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request(`/trips/${tripId}/complete`, 'POST', { version: 2 }, operator)).status,
      200,
    );
    assert.equal(
      (
        await request(
          '/records/sales',
          'POST',
          { tripId, type: 'cash', date: '2026-11-03', amount: '1' },
          operator,
        )
      ).status,
      400,
    );
    snapshot = await request('/state', 'GET', undefined, operator);
    assert(snapshot.body.entities.trips[0].completed);
    assert.equal(snapshot.body.summaries[0].revenue, '379000.00');
    assert(snapshot.body.audit.some((a: any) => a.actor === 'Operator One' && a.action === 'complete'));
    assert.equal(
      (await request('/records/messages', 'POST', { text: 'Hello team' }, guest)).status,
      403,
    );
    assert.equal(
      (await request('/records/messages', 'POST', { text: 'Hello team' }, operator)).status,
      201,
    );
    state.settings.fieldVisibility.operator = ['operations'];
    const hidden = await request('/state', 'GET', undefined, operator);
    assert.equal(hidden.body.summaries.length, 0);
    assert.equal(hidden.body.entities.sales.length, 0);
    assert(!JSON.stringify(hidden.body).includes('archiveSummary'));
    assert.equal(
      (
        await request(
          '/records/sales',
          'POST',
          { tripId, type: 'cash', date: '2026-11-03', amount: '1' },
          operator,
        )
      ).status,
      403,
    );
    state.settings.fieldVisibility.operator = ['operations', 'finance'];
    // Rate limiter persists failed attempts and rejects even a correct PIN while blocked.
    for (let i = 0; i < 8; i++)
      assert.equal((await request('/auth/login', 'POST', { pin: '9999' })).status, 401);
    assert.equal((await request('/auth/login', 'POST', { pin: '2601' })).status, 429);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
