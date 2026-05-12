# Global Essentials — POS & Debt Management System

A mobile-first POS and debt management system for a physical goods business. Staff sell products (cash or pay-slow installments), track outstanding payments, manage inventory, and analyze performance. Includes a public product catalog with WhatsApp ordering.

## Features

- **Dashboard** — Ground Truth (paid sales minus expenses), Pipeline (unpaid installments), low stock alerts
- **New Sale** — Product grid → cart sidebar → client selection → payment → receipt
- **Pay-Slow Installments** — First installment taken upfront, remaining split monthly
  - Supports partial payments and backdated payment recording
  - Clients can pay early or late — any amount on any date
- **Debt Collection** — Overdue highlighting, one-click WhatsApp reminders, AI-generated messages
- **Phonebook Import** — Add clients directly from device contacts when making a sale
- **Inventory** — Product CRUD with image uploads
- **Expenses** — Full CRUD with category breakdown
- **Analytics** — Revenue charts, expense pie, top products, AI natural language queries
- **Orders** — Order tracking with status management
- **Public Catalog** — Product grid with WhatsApp order flow
- **Import Simulator** — Cost calculator with AI advisor
- **CSV Export** — Download sales, expenses, and debt reports
- **Offline Queue** — Sales queued when offline, syncs when back online

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with tactical dark theme
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Groq (llama-3.3-70b-versatile) for payment reminders and analytics queries
- **State**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Toasts**: Sonner

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url> global-essentials
cd global-essentials
pnpm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=your-groq-api-key
```

### 3. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-schema.sql`
3. In **Storage**, create bucket `product-images` (public read)
4. Get credentials from **Settings → API**

### 4. Run

```bash
pnpm dev
```

## Database Schema

| Table | Key Columns |
|---|---|
| `products` | id, name, cost_price, selling_price, stock_level, image_url |
| `clients` | id, full_name, phone_number |
| `sales` | id, product_id, client_id, total_amount, payment_status, payment_method, created_at |
| `installments` | id, sale_id, amount_due, amount_paid, due_date, is_paid, paid_at, note |
| `expenses` | id, description, amount, category |

## Pay-Slow Logic

When a sale uses pay-slow:
1. First installment = ceil(total / duration) — marked as paid immediately
2. Remaining (n-1) installments = floor(total / duration) — unpaid
3. Due dates are monthly from the sale date
4. Each installment can be paid partially, on any date, with optional notes

## Project Structure

```
app/
├── (pos)/                    # Staff POS (all routes under this layout)
│   ├── dashboard/            # Ground Truth, Pipeline, Low Stock
│   ├── new-sale/             # Product grid + cart sidebar + checkout
│   ├── ledger/               # Sales history
│   ├── debts/                # Installments, payment recording, WhatsApp reminders
│   ├── inventory/            # Product CRUD
│   ├── expenses/             # Expense CRUD
│   ├── analytics/            # Charts + AI queries
│   ├── orders/               # Order management
│   ├── export/                # CSV downloads
│   ├── import-simulator/     # Import cost calculator
│   └── settings/              # Configuration
├── catalog/                  # Public product catalog
│   └── [productId]/          # Product detail + WhatsApp order
lib/
├── actions/                  # Server actions (async DB operations)
│   ├── sales.ts              # createSale, getProducts, getClients, markSaleFullyPaid
│   ├── ledger.ts             # getSalesHistory, searchDebts, recordInstallmentPayment
│   ├── receipts.ts           # getSaleReceipt (HTML receipt generation)
│   ├── inventory.ts          # Product CRUD + image upload
│   ├── expenses.ts           # Expense CRUD
│   ├── dashboard.ts          # Dashboard stats
│   ├── analytics.ts          # Chart data
│   └── ai.ts                  # Groq AI (reminders, risk analysis, natural queries)
├── receipts/template.ts      # Receipt HTML template
└── supabase-types.ts         # TypeScript types for all tables
```

## Design System

- **Theme**: Deep Dark Mode (black #0a0a0a, slate #1e293b)
- **Accents**: Electric Blue (#3b82f6), Neon Green (#22ff66), Orange (#f97316), Red (#ef4444)
- **Buttons**: `btn-tactical` — h-14, rounded-xl, font-black
- **Cards**: `card-tactical` — bg-tactical-slate, rounded-2xl, border-white/10
- **Typography**: font-black, uppercase, tracking-tighter for headers

## Useful Commands

```bash
pnpm dev     # Start dev server
pnpm build   # Production build
pnpm lint    # ESLint check
```