import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sql from 'mssql';
import { emptySnapshot, type Snapshot } from '../../../shared/models.ts';
import { crewLedger } from '../../../shared/crew-ledger.ts';
import { normalizeSnapshot } from '../../../shared/normalize-snapshot.ts';
import { mode, sqlConfig } from '../config/environment.ts';
export interface Repository {
  read(): Promise<Snapshot>;
  transaction<T>(fn: (state: Snapshot) => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function createRepository(): Promise<Repository> {
  if (mode === 'demo') {
    const { DatabaseSync } = await import('node:sqlite');
    await mkdir('data', { recursive: true });
    const db = new DatabaseSync(path.resolve('data/boatcore-demo.sqlite'));
    db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS State (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)',
    );
    db.prepare('INSERT OR IGNORE INTO State VALUES (1,?)').run(JSON.stringify(emptySnapshot()));
    const read = async () =>
      normalizeSnapshot(
        JSON.parse(
          (db.prepare('SELECT data FROM State WHERE id=1').get() as { data: string }).data,
        ) as Snapshot,
      );
    let queue = Promise.resolve();
    return {
      read,
      async transaction<T>(fn: (s: Snapshot) => T | Promise<T>) {
        let release!: () => void;
        const previous = queue;
        queue = new Promise((r) => (release = r));
        await previous;
        try {
          db.exec('BEGIN IMMEDIATE');
          const s = await read();
          const result = await fn(s);
          db.prepare('UPDATE State SET data=? WHERE id=1').run(JSON.stringify(s));
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        } finally {
          release();
        }
      },
      async close() {
        db.close();
      },
    };
  }
  const pool = await new sql.ConnectionPool(sqlConfig()).connect();
  async function load(request: sql.Request) {
    const result = await request.query('SELECT Payload FROM dbo.AppState WHERE Id=1');
    if (!result.recordset[0]) throw Error('Run database setup and seed first.');
    return normalizeSnapshot(JSON.parse(result.recordset[0].Payload) as Snapshot);
  }
  return {
    read: () => load(pool.request()),
    async transaction<T>(fn: (s: Snapshot) => T | Promise<T>) {
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        await new sql.Request(tx).query(
          "DECLARE @r int; EXEC @r=sp_getapplock @Resource='BoatCoreWrite',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 50001,'Write lock unavailable',1;",
        );
        const s = await load(new sql.Request(tx));
        const out = await fn(s);
        await new sql.Request(tx)
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(s))
          .query('UPDATE dbo.AppState SET Payload=@payload WHERE Id=1');
        // SQL read projections are refreshed in the same transaction for SSMS reporting.
        await new sql.Request(tx)
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(s))
          .execute('dbo.RefreshReportingTables');
        await new sql.Request(tx)
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(s))
          .input('ledger', sql.NVarChar(sql.MAX), JSON.stringify(crewLedger(s)))
          .execute('dbo.RefreshCrewPayableTables');
        await tx.commit();
        return out;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
    async close() {
      await pool.close();
    },
  };
}
