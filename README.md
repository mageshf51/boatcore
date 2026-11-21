# BoatCore

BoatCore is a full-stack fishing boat management app for recording trips, fish sales, expenses, and crew payments. It tracks outstanding balances and calculates crew shares and trip profit in one workflow.

**Stack:** Next.js, React, TypeScript, Express, SQL Server 2019 Express, and SQLite for the local demo.

Start with **Review as Guest** to explore sample trips and settlement history. Use a local demo operator account to try entering a sale or settling a trip. See [Architecture](docs/ARCHITECTURE.md) for the API and storage design, and the [settlement calculator](shared/settlement-calculator.ts) for the financial rules.

## Start the demo first

Install Node.js **22.13+** (24 LTS recommended), open a terminal in the project root, then:

```sh
npm ci
npm run demo
```

Open **http://localhost:3000**. The API runs on port 4000. Demo mode persists fictional data in `api/data/boatcore-demo.sqlite`. It never connects to your SQL Server. Do not use the demo database for real financial records. Stop with Ctrl+C.

| PIN  | User    | Access                       |
| ---- | ------- | ---------------------------- |
| 2601 | Operator One  | Operational editing          |
| 2602 | Operator Two | Operational editing          |
| 2603 | Operator Three   | Operational editing          |
| 2604 | Admin   | Operations and configuration |
| 2605 | Guest   | Read only                    |

The login also provides **Review as Guest**. PINs are verified only by the API; salted hashes are stored in the database. PIN values stay out of client source. The table above lists fictional accounts for the local SQLite demo. Configure separate credentials in `api/.env` for a SQL Server installation. For public portfolio hosting, use `PUBLIC_REVIEW_ONLY=true` to disable PIN sign-in and permit the guest shortcut only.

## Set up a completely new SQL Server database

Follow [docs/SQL-SERVER-SETUP.md](docs/SQL-SERVER-SETUP.md). Setup creates a new `BoatCore` database if absent and never drops existing databases. No old FishingBoatManager schema or credentials are reused.

```sh
# Windows
copy api\.env.example api\.env
# macOS / Linux
cp api/.env.example api/.env
```

Edit `api/.env` with your SQL Server credentials and TCP port. Then run setup, provision the restricted login in SSMS, and seed:

```sh
npm run db:setup
# Run database/002-application-permissions.sql in SSMS after choosing a login password.
npm run seed
npm run dev
```

For the real workspace keep `SEED_SAMPLE_DATA=false`. Products, user roles, settings, crew, trips and financial data are loaded from the API/database. Add actual crew and products through Masters & Settings. The sample-data flag applies only to the initial seed; it does not modify an already-seeded workspace.

## Project map

| Folder                  | Responsibility                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `app/src/app/`          | Thin Next.js routes, layout and responsive theme                  |
| `app/src/components/`   | Reusable shell, controls, upload input, providers and feedback    |
| `app/src/features/`     | Dashboard, trips, records, settlement, chat, history and settings |
| `app/src/stores/`       | Zustand UI preferences (language and drawer); no financial state  |
| `app/src/lib/`          | API client, formatting and translations                           |
| `api/src/config/`       | Environment configuration                                         |
| `api/src/security/`     | PIN hashing and token handling                                    |
| `api/src/validation/`   | Authoritative Zod request schemas                                 |
| `api/src/services/`     | Business rules, permissions, auditing and seeding                 |
| `api/src/repositories/` | SQL Server storage and isolated SQLite demo adapter               |
| `api/src/scripts/`      | Database setup and seed entry points                              |
| `shared/`               | Types and exact decimal settlement calculations                   |
| `database/`             | SQL schema, reporting projections and restricted permissions      |
| `tests/`                | Accounting, API workflow and browser test suites                  |
| `docs/`                 | Setup, architecture, deployment and verification                  |

## Main flows

1. Sign in → Masters & Settings → create crew and products.
2. Trips → Add New Trip → searchable crew checklist → crew count updates immediately.
3. Quick Sales → Add New Sale or Add Cash → link to an active trip. Cash has no commission.
4. Expenses → record quantities, prices, initial payment and bills. Pending view lists outstanding balances; switch it off to see expense history.
5. End Trip → confirm a valid return date. Returned trips remain editable until settlement is completed.
6. Trip Settlement → choose the trip, deductions, wage total and +0.5 share switches → save.
7. Complete trip → operation records lock and the trip disappears from entry selectors. Open its archive in Trip Details using the overview, crew shares, sales, expenses, settlement and history tabs.
8. Subsequent payments on outstanding expenses remain possible and audited even after completion. They change payment balances, not the original expense amount or archived profit.
9. Team Chat stores team messages with author and time; clients refresh every 15 seconds. Guests can read and cannot post.

## Verification commands

```sh
npm run typecheck
npm test
npm run build
# Start demo in a separate terminal, then:
npx playwright install chromium
npm run test:e2e
```

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for actual results and remaining checks. Browser tests target mobile first (iPhone 13 viewport), then desktop. They require a machine that permits Chromium to launch. Real-device camera capture requires HTTPS and user permission.

## Publishing a link for your resume

A ZIP cannot itself provide a public URL. Deploy both processes plus persistent storage using [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Publish only fictional sample data in a separate guest-only portfolio workspace. Your developer can then place that HTTPS URL on your resume. No public deployment was made as part of this package.

## Scope and operating limits

- The SQL Server implementation uses a transactional aggregate document as the write model, plus typed SQL reporting projections. It is designed for a small boat team. See the architecture document before scaling to many businesses or thousands of chat messages.
- The audit projection is append-only; write operations store actor, timestamp and before/after data. This is application change tracking, not an external tamper-proof compliance ledger.
- English/Tamil covers the operational UI. User data, database error detail, technical validation detail and some decorative captions remain in the original language.
- Crew trip shares, land-work wages, advances and buyer receivables have individual payment histories. The earlier trip wage-total field remains available. Multi-boat tenancy, deletion, exports, offline sync and notifications are not part of this version.
- Commission/share settings are fixed after the first completed trip to protect historical calculations. A later version can use effective-dated rate schedules.
- Uploads are PNG/JPEG/WebP up to 5 MB. Files use authenticated routes and a persistent upload directory; deleted draft attachments can be removed by a scheduled maintenance job after checking they are unreferenced.
