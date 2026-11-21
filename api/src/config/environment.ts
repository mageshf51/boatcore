export const mode = process.env.DATA_MODE || 'sqlserver';
export const sqlConfig = (setup = false) => ({
  server: process.env.SQL_HOST || '127.0.0.1',
  port: Number(process.env.SQL_PORT || 1433),
  database: process.env.SQL_DATABASE || 'BoatCore',
  user: setup ? process.env.SQL_SETUP_USER : process.env.SQL_USER,
  password: setup ? process.env.SQL_SETUP_PASSWORD : process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
});
