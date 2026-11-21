# Fresh SQL Server 2019 Express setup

## 1. Enable a connection

Install SQL Server 2019 Express and SSMS. In SQL Server Configuration Manager enable **TCP/IP** for your instance. Set **IPAll → TCP Port = 1433**, clear TCP Dynamic Ports and restart the SQL Server service. For named instances the actual port can differ; use that real port in `SQL_PORT`.

In SSMS connect as an administrator. Enable **SQL Server and Windows Authentication mode** in server properties and restart the service if changed. The Node API uses SQL authentication in this package.

Do not open SQL port 1433 to the public internet. The backend should reach it over localhost or a private network.

## 2. Configure credentials

Copy `api/.env.example` to `api/.env`. Use an administrator account only in `SQL_SETUP_USER` and `SQL_SETUP_PASSWORD`. Set `SQL_DATABASE=BoatCore` for a new workspace. `SQL_USER` / `SQL_PASSWORD` are for the restricted application login created below. The example password `CHANGE_ME` is not a working credential.

For a local development instance without a trusted TLS certificate, `SQL_ENCRYPT=false` and `SQL_TRUST_CERT=true` are convenient. For a hosted database use a valid trusted certificate and encryption. These flags are server-side and do not configure the browser.

```sh
npm run db:setup
```

This creates the database if absent and executes each `GO`-delimited batch in `database/001-create-database.sql` and `database/003-crew-dues-payables.sql`. Re-running setup preserves existing data. No database is dropped. Use a different database name for another independent clean installation rather than deleting a real workspace.

## 3. Create the application login in SSMS

Choose a strong password and run as administrator:

```sql
USE master;
CREATE LOGIN boatcore_app WITH PASSWORD = 'YOUR_STRONG_UNIQUE_PASSWORD', CHECK_POLICY = ON;
```

Then run `database/002-application-permissions.sql` in SSMS. If you changed the database name, update `USE BoatCore` in that permissions file first. Set the exact same password in `SQL_PASSWORD` in `api/.env`. Do not include SQL string quotes as part of the environment value.

The login can read/update the aggregate, execute the transactional projection procedure and read reporting views. It is not assigned `sysadmin` or `db_owner`.

## 4. Seed the new workspace

Set `SEED_USERS_JSON` in your private `api/.env` to a JSON array of user objects with `name`, `pin` (four digits), and `role` (`admin`, `operator`, or `guest`). Use distinct PINs reserved for your deployment. Keep `SEED_SAMPLE_DATA=false` for an empty operational workspace; true creates fictional trips for a portfolio installation.

```sh
npm run seed
npm run dev
```

Seeding is idempotent at workspace level. When users already exist it exits without resetting PINs or adding sample records. Changing `SEED_USERS_JSON` afterwards does not change existing accounts. User administration/reset tooling is a future extension; use a new separate database for a new demo installation.

## 5. Inspect in SSMS

```sql
USE BoatCore;
SELECT * FROM dbo.Trips;
SELECT * FROM dbo.Crew ORDER BY Serial;
SELECT * FROM dbo.Products;
SELECT * FROM dbo.Sales;
SELECT * FROM dbo.Expenses;
SELECT * FROM dbo.Settlements;
SELECT * FROM dbo.TeamMessages;
SELECT * FROM dbo.AuditEvents ORDER BY At DESC;
```

`Records.Amount` is `decimal(18,2)`. The projections retain `Payload` JSON for details such as crew IDs and partial payment history. Avoid editing reporting tables/views directly: the write model in `AppState` is authoritative and the API refreshes projections in its transaction.

## Troubleshooting

| Symptom                      | Check                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Login failed / error 18456   | Login enabled; SQL authentication enabled; exact password matches `.env`; restart API after `.env` changes |
| Connection refused / timeout | TCP/IP enabled; service running; actual port matches; private firewall access                              |
| Cannot open database         | Setup completed; database name correct; restricted database user created                                   |
| Service unavailable          | Read the API terminal error; never paste database credentials into chat or client code                     |
| Guest login unavailable      | Seed finished; `Guest` is active and has role `guest`                                                      |
| Mobile saves rejected        | Set `APP_ORIGIN` to the exact origin used on the phone, including scheme/port                              |

SQL Server execution was not available in the build environment. Run this setup on your SQL Server and verify one complete flow before using real records.
