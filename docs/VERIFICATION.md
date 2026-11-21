# Verification report — 19 November 2026

| Check                                                                          | Result                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| TypeScript app and API                                                         | Passed                                                                         |
| Next.js optimized production build                                             | Passed                                                                         |
| Automated accounting/business/API tests                                        | 17 tests passed                                                                |
| Captain-only +0.5 rule, including direct API tampering                         | Passed                                                                         |
| Two unpaid trips, FIFO advance allocation and carry-forward                    | Passed                                                                         |
| Advance exceeds salary: normal recovery and full-cash override                 | Passed                                                                         |
| Duplicate salary payment, stale balance and out-of-order payment guards        | Passed                                                                         |
| Uniform/individual wages, edits and locking of paid members                    | Passed                                                                         |
| Land wages deducted from owner profit once                                     | Passed                                                                         |
| Buyer partial/full receipts after trip completion without changing revenue     | Passed                                                                         |
| Guest denial across all new write endpoints                                    | Passed                                                                         |
| New HTTP endpoint persistence, retry deduplication and audit actor             | Passed                                                                         |
| Legacy normalization and historical summary preservation                       | Passed                                                                         |
| Persistent SQLite adapter restart, concurrent-write serialization and rollback | Passed                                                                         |
| Original arithmetic examples and 249 rounding cases                            | Passed                                                                         |
| Original login, permissions, trip/expense workflows                            | Passed                                                                         |
| SQL Server execution                                                           | Not available in this environment; scripts included for your instance          |
| Mobile/desktop browser execution                                               | Browser launch blocked by environment socket restrictions; test suite included |
| Physical phone/camera and public deployment                                    | Requires your device/hosting environment                                       |

Test commands: `npm test`, `npm run typecheck`, `npm run build`. The API tests use isolated transactional fixtures and real HTTP requests. They do not claim SQL Server runtime execution. Browser launch failed before a page opened, so there is no claim of a passed mobile visual test. Run `npx playwright install chromium` followed by `npm run test:e2e` with app/API running in demo mode on your developer machine. Never run write tests against real financial records.

Before real use, back up the existing database, apply the setup and permissions scripts, then verify advances, two pending salaries, both excess-advance choices, wage editing/payment, buyer receipts and supplier payments on SQL Server. Compare the UI with `REPORT-QUERIES.sql` and verify a guest cannot write through direct API calls.
