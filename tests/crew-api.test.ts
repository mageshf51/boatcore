import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { emptySnapshot } from '../shared/models.ts';
import { normalizeSnapshot } from '../shared/normalize-snapshot.ts';
import { seed } from '../api/src/services/seed-service.ts';
process.env.BOATCORE_TEST = '1';
const { createApp } = await import('../api/src/server.ts');
test('crew and dues HTTP routes persist, deduplicate and deny guest writes', async () => {
  let state = emptySnapshot();
  seed(state, true, true);
  normalizeSnapshot(state);
  let queue = Promise.resolve();
  const repo = {
    read: async () => structuredClone(state),
    transaction: async (fn: any) => {
      let release!: () => void;
      const previous = queue;
      queue = new Promise((r) => (release = r));
      await previous;
      try {
        const next = structuredClone(state);
        const result = await fn(next);
        state = next;
        return result;
      } finally {
        release();
      }
    },
    close: async () => {},
  };
  const server = createApp(repo).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  async function request(
    path: string,
    method = 'GET',
    body?: any,
    cookie = '',
    key = randomUUID(),
  ) {
    const res = await fetch(base + path, {
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
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get('set-cookie')?.split(';')[0] || '',
    };
  }
  try {
    const auth = await request('/auth/login', 'POST', { pin: '2601' }),
      cookie = auth.cookie;
    assert.equal(auth.status, 200);
    const guest = (await request('/auth/guest', 'POST', {})).cookie;
    let view = (await request('/state', 'GET', undefined, cookie)).body;
    const crewId = view.entities.crew[0].id;
    const key = randomUUID();
    const advance = { crewId, date: '2026-11-01', amount: '100000', notes: 'Crew advance' };
    const results = await Promise.all([
      request('/crew/advances', 'POST', advance, cookie, key),
      request('/crew/advances', 'POST', advance, cookie, key),
    ]);
    assert.equal(results[0].status, 201);
    assert.equal(results[0].body.id, results[1].body.id);
    assert.equal(state.entities.advances.length, 1);
    view = (await request('/state', 'GET', undefined, cookie)).body;
    const row = view.crewLedger.pending.find(
      (r: any) => r.crewId === crewId && r.ready && r.isFirst,
    );
    const payout = {
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      crewId,
      revision: row.revision,
      date: '2026-11-19',
      mode: 'full',
      confirmExcess: true,
    };
    const paid = await request('/crew/pay', 'POST', payout, cookie);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.advanceAfter, '100000.00');
    assert.equal((await request('/crew/pay', 'POST', payout, cookie)).status, 409);
    const wage = await request(
      '/crew/wages',
      'POST',
      { date: '2026-11-19', notes: 'Land work', members: [{ crewId, amount: '300' }] },
      cookie,
    );
    assert.equal(wage.status, 201);
    const changed = await request(
      `/crew/wages/${wage.body.id}`,
      'PUT',
      { ...wage.body, members: [{ crewId, amount: '500' }] },
      cookie,
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.amount, '500.00');
    const active = state.entities.trips.find((t) => !t.completed)!;
    const sale = await request(
      '/records/sales',
      'POST',
      {
        tripId: active.id,
        type: 'sale',
        buyer: 'Dues buyer',
        date: active.departure,
        amount: '100',
        initialPaid: '20',
      },
      cookie,
    );
    assert.equal(sale.status, 201);
    assert.equal(
      (
        await request(
          `/sales/${sale.body.id}/payments`,
          'POST',
          { amount: '80', version: 1, date: '2026-11-19', notes: 'Final receipt' },
          cookie,
        )
      ).status,
      200,
    );
    for (const path of [
      '/crew/advances',
      '/crew/wages',
      '/crew/pay',
      `/sales/${sale.body.id}/payments`,
    ])
      assert.equal((await request(path, 'POST', {}, guest)).status, 403);
    assert.equal((await request('/records/crewPayments', 'POST', {}, cookie)).status, 400);
    assert(state.audit.some((a) => a.action === 'salary-paid' && a.actor === 'Operator One'));
    view = (await request('/state', 'GET', undefined, cookie)).body;
    assert.equal(view.ownerTotals.landWages, '500.00');
    assert(
      !view.crewLedger.pending.some((r: any) => r.sourceId === row.sourceId && r.crewId === crewId),
    );
    assert.equal(view.crewLedger.payments.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
