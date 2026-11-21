# BoatCore

BoatCore is a fishing boat management app that follows a trip from departure to settlement. It brings together fish sales, expenses, buyer dues, supplier bills, and crew payments so the boat owner can see how much a trip earned, what’s still unpaid, and how much each crew member should receive.

## From departure to settlement

1. **Start a trip.** Enter the departure date, select the crew, and assign a captain. The crew count updates as people are added or removed.
2. **Record sales and expenses.** Link fish sales, cash entries, and operating costs to the trip. Expenses can include quantities, unit prices, initial payments, and bill attachments.
3. **End the trip.** Enter the return date. The trip stays editable at this point, so the team can review figures and make corrections before settlement.
4. **Review the settlement.** Check sales, expenses, wages, and deductions. The app calculates crew shares and trip profit, including the captain’s extra half share when enabled.
5. **Complete the trip.** The trip disappears from active entry screens and its operational records are locked. You can still open the trip history to review the sales, expenses, crew shares, and settlement.

## Payments and outstanding balances

One of the main problems I wanted BoatCore to handle was keeping track of payments that happen after the original transaction. A buyer might pay part of a fish bill today and clear the rest next week. A supplier bill might still be unpaid after the trip has been settled.

| Situation | What BoatCore tracks |
| --- | --- |
| A buyer buys fish on credit | The sale amount, payments received, and the remaining balance |
| A supplier bill is partially paid | The original expense, each payment, and what the boat still owes |
| A crew member receives an advance | The advance, how much is recovered from earnings, and any balance carried forward |
| Someone works on land between trips | Their wages and payment history |

For example, if a buyer owes ₹20,000 and pays ₹8,000 later, the outstanding balance drops to ₹12,000. The original sale stays at ₹20,000 and the collection is recorded separately. The same approach applies to supplier payments, so paying a fuel bill after a trip closes keeps the original expense and settled profit intact.

## Crew shares and advances

The settlement calculates each crew member’s payout from their share. For example, if 12 people share a pool of ₹82,740 and the captain receives 1.5 shares, the pool is divided across **12.5 shares**. The calculation reconciles rounded payouts to the original pool so the totals match down to the paisa.

Crew shares from completed trips become payable. If a crew member has an outstanding advance, the app can recover it from their earnings and carry forward any remaining amount. The payment history shows how much was recovered and how much was actually paid in cash.

## Dashboard and team access

- **Dashboard** shows revenue, expenses, and profit or loss, with a chart of revenue by trip date.
- **Trip history** keeps completed trips available for review, including sales, expenses, crew shares, and settlement details.
- **Dues & Payables** shows outstanding buyer dues and supplier balances.
- **Roles** control who can update records. Guests have read-only access, and the API enforces write permissions.
- **Audit history** records who made a change, when it happened, and the before-and-after values for audited operations.
- **English and Tamil** are available across the main screens on mobile and desktop.

## How it’s built

| Part | Technology and responsibility |
| --- | --- |
| Frontend | Next.js, React, and TypeScript for the dashboard, forms, and responsive workspace |
| API | Express and TypeScript for authentication, validation, permissions, and business rules |
| Storage | SQL Server for operational data and reporting. The demo uses SQLite with fictional records. |
| Settlement logic | Shared TypeScript code for decimal arithmetic, crew share allocation, and rounding |

The **[settlement calculator](shared/settlement-calculator.ts)** shows how the financial rules work. The **[architecture notes](docs/ARCHITECTURE.md)** explain how the UI, API, and database fit together.

This version is designed for a small boat team. Multi-boat management and offline sync are outside the current scope.
