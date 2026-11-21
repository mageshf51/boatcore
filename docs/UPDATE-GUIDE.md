# Crew, wages and dues update — 19 November 2026

This update retains the existing app/API separation, theme, trips, sales, expenses, chat, chart, authentication and audit history. It adds only the requested crew and dues workflows plus the entry/permission changes they need.

## Existing installation: keep your data

1. Stop both processes. Back up the SQL Server database and `api/uploads`. In demo mode also back up `api/data` after stopping the API.
2. Extract the new ZIP to a new folder. Copy your existing `api/.env` into the new `api` folder. Keep uploads on the configured persistent location (this version uses the API's `uploads` folder). If retaining the local demo, copy its `api/data` folder too.
3. Check `node -v` is 22.13 or later. If Windows selects NVM's older Node first, use `where.exe node` and select the installed version with `nvm use`.
4. From the new project root run `npm ci`.
5. For SQL Server run `npm run db:setup` using your setup administrator credentials. This reruns the additive base setup and installs `003-crew-dues-payables.sql`; existing data is preserved. Then rerun `database/002-application-permissions.sql` in SSMS for the restricted application login. No DROP DATABASE or data reset is needed. Keep the SQL database name consistent with `api/.env`.
6. Run `npm run dev`. For a production build run `npm run build`, then start API and app with your existing process manager. `npm run demo` is optional and uses SQLite; it is not the SQL Server startup command.
7. Existing workspaces do not need reseeding. On a new database, run `npm run seed` after provisioning permissions; keep `SEED_SAMPLE_DATA=false` for real records.

Alternative SSMS fresh install: run `database/INSTALL-ALL.sql` as administrator, choose/create a restricted login and run `002-application-permissions.sql`, then `npm run seed`. INSTALL-ALL uses database name BoatCore; adjust it if your `.env` uses another name. The environment-driven `npm run db:setup` handles a custom name automatically.

## 1. Captain-only half share

Masters & Settings → Crew members → Add/Edit → tick **Eligible as captain** when appropriate. Trip entry includes a captain dropdown restricted to selected eligible crew. If left on Auto-select it uses the first eligible selected captain by serial number. The API validates this assignment. Only that trip's captain sees the +0.5 switch; regular crew always have 1 share. A forged regular-crew half share is rejected on the server.

On upgrade, an old crew name containing the English word Captain is classified once as eligible; verify these roles in masters. Previously completed trip summaries remain historical snapshots. The change does not silently rewrite archived paid or settled amounts.

## 2. Crew advances and salary settlement

Open Crew → Add advance → choose person, date, amount and notes. Advances are a crew-wide balance carried across trips; they are not a second business expense.

Pending salaries lists a separate row for each trip/person and each land-work wage/person. For example, if Operator Three has two unpaid trip shares, both trip rows remain visible. A saved active trip's shares are marked Draft. Complete the trip settlement to make its final shares payable. This prevents paying provisional shares whose sales or deductions can still change.

Rows are ordered by salary date and source ID. Pay the oldest ready salary first for that crew member. The advance column shows the projected balance before that row; later rows show the projected remainder. These are allocations of one outstanding balance, not additional loans. Summary cards show the actual outstanding advance only once.

Example: Operator Three has two salaries of ₹2,100 and an advance of ₹3,000. The first row shows ₹900 excess and ₹0 cash due; the second projects ₹900 advance and ₹1,200 cash due.

- Normal confirmation settles the salary using available advance and pays the net balance.
- When advance exceeds salary, a warning gives two explicit options: **Settle against advance**, or **Pay full salary anyway**.
- Settling against advance recovers up to that salary and carries the excess forward.
- Paying full salary anyway pays the whole salary in cash and leaves the advance outstanding. The history records this override and acting user.
- A paid row leaves Pending salaries and appears in Payment history. Trip crew lists and Trip Details → Crew shares show a green Paid badge. Historical records are retained.
- If the advance or salary changes while a confirmation is open, the API returns a conflict and requires a new confirmation. Repeated recent submissions use idempotency keys and cannot pay the same source/person twice.

The salary payment date uses today's India date. It cannot be before the earning date or the person's latest advance date. Advances are append-only in this update; correcting a mistaken advance requires a controlled future reversal feature, not deletion of financial history.

## 3. Land-work wages

Crew → Add wages → date → select crew (search, Select all or Add crew member). Enter a common wage and click Apply to selected crew, or edit each amount individually. Total amount updates immediately. Save notes and then pay individual people from Pending salaries.

Land wages can be edited. Once a person's wage is paid, their amount and membership are locked; unpaid people may still be changed. The work date is locked after the first payment. Wages are subtracted from owner-level profit once when earned/recorded. Paying wages or offsetting an advance does not subtract profit again.

Land wages are separate from the pre-existing trip wage-total field. Do not enter the same land-work amount in both places. They are not assigned to an arbitrary fishing trip, so the trip revenue chart and archived trip profit do not change. The dashboard's owner profit includes the separate land-wage deduction.

## 4. Expense product field

Expense entry now uses one searchable product combobox. Type to filter, choose a result with touch/mouse or arrow keys + Enter, or use Add product in its dropdown. The quick-add asks for name and unit and selects the saved product. A typed name without a selected/saved product is not accepted.

An optional Supplier field identifies who must be paid (diesel supplier, ice vendor, etc.). Older expenses without a supplier show their product name as the counterparty label.

## 5. Dues & Payables

- Buyer dues: quick sale entry now has **Fully received** and **Received amount** controls. Turn Fully received off for unpaid or partially paid bills. This tab lists the outstanding buyer balance and accepts partial/full receipts with date and notes.
- Supplier payables: uses the existing expense amounts/payments, with partial/full payment entry and history. It is the same expense ledger as Expenses, not a duplicated cost.
- Include paid records shows cleared entries. Each payment remains in history. Receipts/payments on completed trips are allowed because they change cash balances, not the original revenue/expense accrual.
- Old buyer sales without payment history are treated as already fully received, preserving the old behavior. The upgrade does not invent unpaid historical dues. New unpaid sales must explicitly record received amount zero.

## SQL files and stored procedures

`003-crew-dues-payables.sql` creates CrewAdvances, WageBatches, WageEntries, CrewSalaryAccounts, CrewSalaryPayments, BuyerReceipts and ExpensePayments, plus BuyerDues/SupplierPayables views. `RefreshCrewPayableTables` refreshes these projections within the API's existing SQL transaction. `GetCrewPendingSalaries`, `GetCrewStatement` and `GetDuesPayables` support SSMS reports. `REPORT-QUERIES.sql` contains examples. `INSTALL-ALL.sql` contains the base and upgrade setup in one runnable SSMS file.

The aggregate write model remains authoritative. Decimal calculations and advance allocation are computed by the shared API rules and projected into SQL tables atomically. Do not enter a payment directly into a reporting table: use the authenticated API, which handles permissions, version checks, history and idempotency. The new SQL tables/procedures are used in SQL Server mode; they are not demo-only placeholders.

## Verification and limits

Run `npm test`, `npm run typecheck`, `npm run build`. Browser test files include the new modules and mobile form scenarios. Actual results are in VERIFICATION.md. SQL Server is not installed in the build workspace; setup and SQL runtime acceptance must be checked on your SQL Server 2019 instance before real financial use. Chromium launch is blocked in this workspace, so mobile/desktop visual tests are included but not marked passed. Guest write restrictions apply to every new endpoint.
