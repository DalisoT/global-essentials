# Phase 1 — Accounting Foundation

## What was added

### Database (run `supabase-schema.sql` in your Supabase SQL editor)
- `accounts` — Chart of Accounts (Cash, AR, Inventory, Revenue, COGS, expenses)
- `journal_entries` + `journal_lines` — double-entry ledger
- `payment_methods` — typed cash/mobile_money/bank/card linked to cash accounts
- `audit_log` — who/what/when trail
- `account_balances` view — running balance per account

The SQL file is **append-only** — running it again on a fresh DB seeds accounts & payment methods.

### Server actions
- `lib/actions/journals.ts` — posting engine (`postJournal`, `postSaleJournal`, `postExpenseJournal`, `postInstallmentPaymentJournal`)
- `lib/actions/accounting.ts` — read actions (`getPnL`, `getBalanceSheet`, `getTrialBalance`, `getJournalEntries`)

### Wiring
- `createSale` posts: Dr Cash/AR, Cr Revenue, Dr COGS, Cr Inventory
- `createExpense` posts: Dr Expense-by-category, Cr Cash
- `recordInstallmentPayment` posts: Dr Cash, Cr AR

### UI
- New `/accounting` route — mobile-first with 3 tabs (P&L / Balance / Journal)
- Period picker (Today / 7 days / This month / This year / All time) — bottom sheet
- "What this means" explainer cards on each report (Phase 1 placeholder; Phase 3 wires AI)
- Linked from the POS drawer (`Calculator` icon)

## Deployment

```bash
# 1. Apply the new schema in Supabase SQL editor (just paste the new chunk at the bottom of supabase-schema.sql)
# 2. Deploy as usual
git add -A
git commit -m "Phase 1: double-entry accounting foundation"
git push
```

## What this unlocks (next phases)

- **Phase 2**: Margin % per product, profitability dashboard
- **Phase 3**: AI CFO chat (it can now answer "what's my net profit?" from real numbers)
- **Phase 4**: Predictive AI uses historical journal data
- **Phase 5**: Academy lessons are tied to your real P&L