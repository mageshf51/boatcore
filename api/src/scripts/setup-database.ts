import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import { sqlConfig } from '../config/environment.ts';
const config = sqlConfig(true),
  name = config.database;
if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) throw Error('Invalid SQL_DATABASE');
const admin = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
await admin.request().query(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}]`);
await admin.close();
const pool = await new sql.ConnectionPool(config).connect();
try {
  for (const filename of ['001-create-database.sql', '003-crew-dues-payables.sql']) {
    const script = await readFile(
      new URL(`../../../database/${filename}`, import.meta.url),
      'utf8',
    );
    for (const batch of script.split(/^GO\s*$/im)) {
      if (batch.trim()) await pool.request().query(batch);
    }
  }
  console.log(
    `Database ${name} is ready. Provision the restricted application login using database/002-application-permissions.sql, then npm run seed.`,
  );
} finally {
  await pool.close();
}
