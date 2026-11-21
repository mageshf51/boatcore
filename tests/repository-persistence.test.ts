import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seed } from '../api/src/services/seed-service.ts';
import { addAdvance } from '../api/src/services/crew-payable-service.ts';
import { crewLedger } from '../shared/crew-ledger.ts';
test('persistent adapter saves crew advances across restart, serializes writes and rolls back failure', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'boatcore-ledger-'));
  const previous = process.cwd();
  process.env.DATA_MODE = 'demo';
  process.chdir(directory);
  const { createRepository } = await import('../api/src/repositories/state-repository.ts');
  let repo = await createRepository();
  try {
    await repo.transaction((s) => seed(s, true, true));
    let state = await repo.read();
    const crewId = state.entities.crew[0].id;
    const user = { id: state.users[0].id, name: state.users[0].name, role: 'operator' as const };
    await Promise.all(
      ['100', '50'].map((amount) =>
        repo.transaction((s) =>
          addAdvance(s, user, { crewId, date: '2026-11-19', amount, notes: 'Adapter test' }),
        ),
      ),
    );
    await assert.rejects(
      repo.transaction((s) => {
        addAdvance(s, user, { crewId, date: '2026-11-19', amount: '999' });
        throw Error('Rollback test');
      }),
      /Rollback test/,
    );
    await repo.close();
    repo = await createRepository();
    state = await repo.read();
    assert.equal(state.entities.advances.length, 2);
    assert.equal(crewLedger(state).crew.find((c) => c.crewId === crewId)!.advance, '150.00');
    assert.equal(state.audit.filter((a) => a.kind === 'advances').length, 2);
  } finally {
    await repo.close();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});
