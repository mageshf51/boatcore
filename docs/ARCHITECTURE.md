# Architecture and maintenance

The web application owns presentation, input and temporary form drafts. The API owns authentication, permissions, validation, mutation, monetary rules and persistence. Zustand stores only language and drawer state. Shared calculations keep the settlement preview aligned with the API.

## Storage contract

`Repository.read()` returns a consistent snapshot. `Repository.transaction()` applies a mutation to a snapshot and commits related changes together. SQL Server uses serializable isolation and a transaction-owned `sp_getapplock` to prevent concurrent writes overwriting each other. It updates `AppState` and refreshes `Records`/`AuditEvents` in the same transaction. The demo adapter uses SQLite transactions and a process queue. SQL failure rolls back both the source and projections.

The aggregate contains users, sessions, failed-login buckets, operational entities, settings, upload metadata and recent idempotency responses. JSON is validated at the API boundary. SQL reporting data exposes `Id`, `TripId`, `Amount decimal(18,2)`, version and typed views. This is intentionally a small-team aggregate design, not a normalized high-throughput multi-tenant platform. An eventual relational repository can implement the same business-service contract; split chat, sessions and audit into bounded tables first. The current `/state` endpoint is unpaginated and chat/audit grow over time.

## Adding a field

1. Add its shape to the relevant Zod schema in `api/src/validation/entity-schemas.ts`.
2. Add cross-record rules in `business-service.ts`; enforce guest denial before writing.
3. Render it through a reusable `Field` in the feature form and detail screen.
4. Add translations and any necessary SQL reporting projection.
5. Add a regression test only for meaningful business behavior, then run typecheck, tests and build.

## Financial rules

Values are strings with two decimal places at persistence boundaries. Calculations use decimal.js. Only rendering to chart coordinates and currency display converts to JavaScript numbers. Revenue is cash + sales − sales commission − deduction. Profit subtracts expenses not included in deduction, crew share pool and crew wage total. Expense totals always use the bill amount, not its paid amount. Largest-remainder distribution allocates paisa exactly and breaks ties by crew serial number.

The settlement record retains the source totals at override save time, explicit overrides, reason, actor and time; the audit stores each revision. Source transaction records are not silently rewritten. Completing a trip freezes its calculated summary and crew snapshot. Financial entry selectors list only incomplete trips. Clearing a form means discarding local drafts; it never deletes historical records. Outstanding expense payments remain possible after completion and affect balances only.

A returned trip is not necessarily complete. `returnDate` records the return; `completed` locks operations after the settlement has been saved. The Complete button is unavailable while the local settlement has unsaved changes.

## Authentication and permissions

PINs are four-character strings, hashed with random salt and scrypt. Sessions use 32 random bytes and store only token hashes server-side; cookies are HttpOnly with SameSite=Lax and configurable Secure. Sessions expire in eight hours. Eight failed PIN attempts per source IP block login for 15 minutes. Do not trust arbitrary `X-Forwarded-For` from the internet. Behind a trusted proxy configure Express trust proxy carefully, or retain the default stricter server-wide shared source bucket.

All mutations require a session and reject guests server-side. Same-origin requests use a custom header and validate Origin when present; cross-origin CORS is not enabled. Update requests include the expected version; conflicts return 409. Mutation idempotency keys are scoped to actor + request and the last 2,000 committed mutation results are retained. This prevents repeated recent submissions, not indefinite financial deduplication.

Default roles: operator sees operations and finance; admin and guest see all fields; guest cannot write. `fieldVisibility` settings define groups, not per-HTML-input permissions. API settings updates require admin. No PINs or session hashes are returned through `/state`.

Images are authenticated and signature-checked for PNG/JPEG/WebP, capped at 5 MB. Draft uploads are stored separately from their transaction record; a failed financial save leaves an unreferenced image for later maintenance. Back up SQL data and upload files together.

## UI and browser behavior

Coal black navigation, `#D8D3C8` sand accents, warm paper surfaces and responsive breakpoints at 1200/1000/760/480 px. Tables scroll horizontally inside their container rather than squeezing all columns. The mobile sidebar uses an overlay; top navigation remains fixed. Form controls use touch-friendly heights; share/cash/active controls use switches. CSS seascape respects reduced motion. Camera input uses the device file picker and `capture=environment`; browsers may choose a standard picker.

The revenue chart groups by trip departure date and uses the effective settlement revenue. Hover/touch exploration does not change dashboard summary cards. It is a Google Finance-inspired chart using Recharts, not a pixel-identical licensed copy. Chart periods are relative to the latest recorded trip.

Team chat is database-backed polling every 15 seconds, not WebSocket push. Messages are append-only through the API. Change History exposes actor/time and expandable before/after records.
