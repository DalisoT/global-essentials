# Global Essentials - Claude Code Continuation Guide

## Project Overview
A mobile-first POS (Point of Sale) and Debt Management system for a physical goods business. Staff sell products (cash or pay-slow installments), track outstanding payments, manage inventory, and analyze performance. Includes a public product catalog with WhatsApp ordering.

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with tactical dark theme
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Animations**: Framer Motion
- **AI**: Groq (llama-3.3-70b-versatile) for payment reminders, risk analysis, import advisor

## Quick Start (New Device)

```bash
git clone <your-repo-url> global-essentials
cd global-essentials
pnpm install
cp .env.local.example .env.local
# Edit .env.local with:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# GROQ_API_KEY=your-groq-api-key
pnpm dev
```

## Supabase Setup Required

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the following in order:

### Step 1: Base schema
Run `supabase-schema.sql` (creates tables: products, clients, sales, installments, expenses, profiles, shipping_rates, exchange_rates_custom, product_variants, orders)

### Step 2: Additional migrations (run in order)
```
supabase/migrations/add_installment_amount_paid.sql
supabase/migrations/add_rls_policies_and_indexes.sql
supabase/migrations/full_shipping_rates_may2026.sql  (TODAY CARGO rates)
```

3. Create storage bucket:
   - **Storage** → "Create bucket"
   - Name: `product-images`
   - Set to **public read**

4. Get credentials from **Settings → API**

### Migrations Summary

| File | Purpose |
|------|---------|
| `add_installment_amount_paid.sql` | Adds `amount_paid` and `note` columns to `installments` |
| `add_rls_policies_and_indexes.sql` | RLS policies for all tables, performance indexes, `UNIQUE` on `clients.phone_number` |
| `full_shipping_rates_may2026.sql` | TODAY CARGO shipping rates (air + sea) |

### Database Schema

| Table | Key Columns |
|-------|-------------|
| `products` | id, name, cost_price, selling_price, stock_level, image_url, image_urls, barcode, deleted_at |
| `clients` | id, full_name, phone_number, deleted_at |
| `sales` | id, product_id, client_id, total_amount, payment_status, payment_method, order_number, deleted_at |
| `installments` | id, sale_id, amount_due, **amount_paid**, due_date, is_paid, paid_at, **note** |
| `expenses` | id, description, amount, category, deleted_at |
| `profiles` | id (FK → auth.users), full_name, role, preferences |
| `shipping_rates` | id, shipping_type, carrier, transit_days, rate_type, rate, tier_min_kg, volume_min_cbm |
| `orders` | id, order_number, client_name, client_phone, product_id, shipping_type, total |
| `product_variants` | id, product_id, size, color, sku, barcode, stock_level, price_modifier |

## File Structure

```
global-essentials/
├── app/
│   ├── (pos)/                    # Staff POS routes (auth-gated via middleware)
│   │   ├── dashboard/            # Ground Truth, Pipeline, Low Stock
│   │   ├── new-sale/             # Product grid → bottom cart bar → slide-in sidebar → receipt
│   │   ├── ledger/               # Sales history
│   │   ├── debts/               # Installments list, payment modal, client history, WhatsApp reminders
│   │   ├── orders/              # Order management
│   │   ├── inventory/           # Product CRUD
│   │   ├── expenses/           # Expense CRUD + category breakdown
│   │   ├── analytics/           # Revenue charts, expense pie, AI queries
│   │   ├── export/             # CSV download for sales/expenses/debts
│   │   ├── import-simulator/   # Import calculator with debounced AI advisor
│   │   ├── settings/           # Configuration
│   │   └── layout.tsx         # Header with sync status, bottom nav (5 items), drawer
│   ├── catalog/                # Public product catalog (no auth)
│   │   ├── page.tsx           # Product grid
│   │   └── [productId]/page.tsx
│   ├── layout.tsx              # Root layout + Toaster
│   └── page.tsx               # Redirects to /dashboard
├── components/
│   ├── pos/
│   │   ├── POSCart.tsx        # Slide-in cart: client search, phonebook import, payment options
│   │   └── ProductGrid.tsx    # Product grid with search, image rendering, SOLD OUT badge
│   └── ...
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── supabase-server.ts     # Server-side Supabase with auth
│   ├── supabase-types.ts      # TypeScript types (Product, Client, Sale, Installment, Expense)
│   ├── utils.ts               # formatCurrency, formatDate, isOverdue, getWhatsAppLink, cn
│   └── actions/
│       ├── sales.ts           # createSale (atomic w/ optimistic lock), getProducts, getClients, createClient, markSaleFullyPaid, deleteSale, editSale
│       ├── ledger.ts          # getSalesHistory, searchDebts, recordInstallmentPayment, markInstallmentPaid, getClientPaymentHistory
│       ├── receipts.ts        # getSaleReceipt, getMultiItemReceipt (multi-item receipts)
│       ├── inventory.ts       # getInventory, createProduct, updateProduct, deleteProduct, uploadProductImages
│       ├── expenses.ts        # getExpenses, createExpense, updateExpense, deleteExpense
│       ├── dashboard.ts       # getDashboardStats
│       ├── analytics.ts       # getAnalyticsData
│       ├── ai.ts             # generatePaymentReminder, analyzePaymentRisk (Groq)
│       ├── import-advisor.ts  # getImportAdvisor (Groq-powered shipping/profitability advice)
│       ├── import-simulator.ts # getShippingRates, getCustomExchangeRate, saveCustomExchangeRate
│       └── export.ts         # CSV generation
├── lib/receipts/
│   └── template.ts           # generateReceiptHTML — renders items array, installments, partial payment support
├── lib/import/
│   ├── calculator.ts         # calculateLandedCost — landed cost calculations
│   ├── shipping-types.ts     # SHIPPING_TYPES config
│   └── advisor-types.ts     # ImportAdvisorOutput type
├── lib/currency/
│   └── rates.ts              # fetchLiveUSDToZMW
├── lib/offline/
│   ├── sync.ts              # queueSale (IndexedDB), syncPendingSales (with retry)
│   └── db.ts                # IndexedDB helpers
├── stores/
│   ├── auth-store.ts        # Zustand auth store
│   └── import-simulator-store.ts
├── hooks/
│   ├── useOffline.ts        # isOnline detection
│   ├── useSyncStatus.ts     # pendingCount, isSyncing, syncError, triggerSync, lastSyncedAt
│   └── usePushNotifications.ts
├── api/
│   └── ai-analytics/       # POST — natural language analytics queries
├── types/
│   ├── index.ts
│   └── contacts.d.ts        # Web Contacts API (navigator.contacts.select) type declarations
└── supabase/
    └── migrations/         # SQL migrations (run in order — see Supabase Setup above)
```

## Key Features Logic

### New Sale Flow
1. Products displayed in grid — tap to add to cart. Products with `stock_level=0` show a red "SOLD OUT" badge and are disabled.
2. Bottom cart bar appears when items are added (shows item count + total).
3. Tap cart bar → animated slide-in sidebar from right.
4. Select or create client (manual or via **From Phonebook** button using Web Contacts API).
5. Choose payment: **Cash** or **Pay-Slow** (with preset monthly durations or custom plan).
6. Complete Sale → multi-item receipt modal (Print, Share, PDF).
7. If offline, sale is queued to IndexedDB and syncs when back online.

### Phonebook Import
`navigator.contacts.select(['name', 'tel'], { multiple: false })` — only works on Chrome 86+ (Android) and Safari 16+ (iOS). Falls back to manual entry on unsupported browsers.

### Pay-Slow Installment Logic
When `payment_method: 'pay-slow'`:
1. **Preset plan**: First installment = ceil(total / duration) → `is_paid = true` immediately. Remaining (n-1) installments = floor(total / duration) → unpaid. Due dates monthly.
2. **Custom plan**: User defines each installment amount and due date. Sum must equal total ±0.01.
3. Installment `amount_due` can be partially paid multiple times. `is_paid = true` only when `amount_paid >= amount_due`.

### Payment Recording (Partial & Backdated)
On Debts page, tap the **$ button** on any installment:
- **Amount**: defaults to full `amount_due`. Enter smaller value for partial payment.
- **Date**: defaults to today. Set a past date for late payments.
- **Note**: optional memo.
- Multiple partial payments accumulate (`amount_paid` column tracks running total).
- When all installments for a sale are `is_paid = true`, `sale.payment_status → 'paid'`.

### Mark Entire Sale Fully Paid
The **wallet icon** on debts rows calls `markSaleFullyPaid(saleId)` — marks ALL unpaid installments as paid in one action.

### Client History View
Tap the **user icon** on any debt row → client history panel shows:
- Total paid / total due / overdue summary
- All purchases with expandable installment timelines
- Back button returns to debts list

### Receipt Printing
Full content capture (no truncation):
- `pageStyle: '@page { size: auto; margin: 0; }'` in `useReactToPrint`
- html2canvas receives `windowHeight` and `height` = `scrollHeight`
- `generateReceiptHTML` renders `items[]` array with quantity for multi-item sales
- `getMultiItemReceipt` fetches all sales in a cart and renders one combined receipt

### Sync Status UI (Header)
Header shows sync status in real time:
- **Orange badge** with pending count when offline sales are queued
- **Blue pulsing badge** with "Syncing..." when actively syncing
- **Red badge** "Sync failed" when errors occur

### createSale Atomicity
`lib/actions/sales.ts` uses a two-phase approach:
1. **Stock decremented first** with optimistic lock: `.eq('stock_level', previousStockLevel)` — fails atomically if concurrent purchase depleted stock.
2. **Then sales + installments created**. If either fails, stock is rolled back.
3. Future: `atomic_create_sale` RPC for true PostgreSQL transaction.

### Ground Truth
```
groundTruth = sum(paid sales total_amount) - sum(all expenses)
inPipeline = sum(unpaid installment amounts)
lowStock = count(products where stock_level < reorder_threshold)
```

### WhatsApp Reminders
- Manual: pre-formatted message via WhatsApp link
- AI: Groq generates tailored reminder message per client

## AI Features (Groq)

### Payment Reminders (`lib/actions/ai.ts`)
`generatePaymentReminder({ clientName, amount, dueDate, productName })` — uses Groq with 0.7 temperature. Falls back to template if API fails.

### Payment Risk Analysis (`analyzePaymentRisk`)
Calculates on-time vs late payment ratio from client's installment history.

### Import Advisor (`lib/actions/import-advisor.ts`)
Groq-powered advice on shipping method, pricing, break-even, cash flow, demand. Calls are **debounced 500ms** after last input keystroke to avoid API spam.

### Natural Language Analytics (`/api/ai-analytics`)
POST endpoint accepts natural language queries and returns Groq-powered insights from sales/expense data.

## Design System

- **Theme**: Deep Dark Mode (black #0a0a0a, slate #1e293b)
- **Accents**: Electric Blue (#3b82f6), Neon Green (#22ff66), Orange (#f97316), Red (#ef4444)
- **Buttons**: `btn-tactical` — h-14, rounded-xl, font-black
- **Cards**: `card-tactical` — bg-tactical-slate, rounded-2xl, border-white/10
- **Typography**: font-black, uppercase, tracking-tighter for headers
- **Nav**: Bottom bar (5 primary items) + slide-out drawer for secondary

## Key Server Actions

```typescript
// lib/actions/sales.ts
createSale({ items, client_id, payment_method, installment_duration?, installments? })
// items: Array<{ product_id, quantity }>
// Stock decremented first with optimistic lock
// Custom installments must sum to total ±0.01

// lib/actions/ledger.ts
searchDebts(search?) // searches client.name, sale.id, product.name
recordInstallmentPayment({ installmentId, amount?, paidAt?, note? })
// amount defaults to full amount_due. paidAt defaults to now.
getClientPaymentHistory(clientId)
// Returns all sales + installments for client + summary totals

// lib/actions/receipts.ts
getSaleReceipt(saleId)         // single item
getMultiItemReceipt(saleIds)  // multi-item cart
```

## Adding New Features

1. Server actions in `lib/actions/` using `requireAuth()` + Supabase client
2. Import types from `@/lib/supabase-types`
3. `sonner` toasts: `import { toast } from 'sonner'`
4. Icons from `lucide-react`
5. Animations: `import { motion, AnimatePresence } from 'framer-motion'`
6. Always type-check: `npx tsc --noEmit --skipLibCheck`

## Useful Commands

```bash
pnpm dev      # Dev server
pnpm build    # Production build
pnpm lint     # Lint
npx tsc --noEmit --skipLibCheck  # Type-check
```

## Pending / Uncommitted

**You must run these migrations in Supabase SQL editor:**
1. `add_installment_amount_paid.sql` (amount_paid + note on installments)
2. `add_rls_policies_and_indexes.sql` (RLS policies, indexes, unique phone)

**Push commits to remote** — you are 7 commits ahead of origin/main:
```
e8dcd7a Fix debts search, add SOLD OUT badge, import advisor debounce, client history view, overdue title
6311e87 Fix remaining priority issues: atomicity, receipts, sync UI, RLS
4fe0460 Fix top 5 priority issues across the app
8c5e750 Fix phonebook contact import
6c60540 Fix product image display
0e4cb34 Update README
49b2e13 Update CONTINUATION_GUIDE.md
```

## Still To Consider

1. **Barcode scanner** — quick product lookup by scan
2. **Refund/return system** — process returns
3. **Cash drawer reconciliation** — shift balancing
4. **SMS notifications** — only WhatsApp currently
5. **Audit trail** — who changed what and when
6. **Multi-currency** — display in other currencies
7. **Dark/light mode toggle**
8. **Product variants UI** — sizes/colors (schema exists, no UI)
9. **Order status workflow** — pending → confirmed → shipped → delivered
10. **PDF financial reports** — beyond CSV export

## Questions for When You Return

- "Add a dark/light mode toggle"
- "Add a refund/return flow"
- "Add barcode scanner support"
- "Implement Supabase Auth for staff login"
- "Add push notifications for due date reminders"
- "Add a new expense category"
- "Add product variant management UI"
- "Improve the AI reminder messages"