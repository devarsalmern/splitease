---
name: SplitEase non-obvious API field names
description: Generated API response/request field names that differ from what you'd expect
---

These field names caused TypeScript errors when building the mobile app. Trust the generated types, not intuition.

## Dashboard (`GetDashboardResponse`)
- `totalOwe` — amount the current user owes others (NOT `totalOwing`)
- `totalOwed` — amount others owe the current user
- `totalBalance` — net balance (positive = owed to you)

## Group Balances (`GetGroupBalancesResponse`)
- `simplifiedDebts` — array of debt objects, NOT `balances`
  - Each: `{ fromUserId, fromUserName, toUserId, toUserName, amount }`
- `memberBalances` — per-member net balance summary

## Settlement creation (`CreateSettlementBody`)
- `paidTo` — recipient user ID (NOT `toUserId`)
- No `currency` field — just `paidTo`, `amount`, optional `note`

## Expense creation (`CreateExpenseBody`)
- `category` — required enum: `food | transport | accommodation | entertainment | utilities | other`
- `date` — optional, but Drizzle expects `string | null` not `Date | null` — use `String(data.date)`
