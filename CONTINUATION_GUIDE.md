# Global Essentials - Claude Code Continuation Guide

## Project Overview
A mobile-first POS (Point of Sale) and Debt Management system called "Global Essentials" built with:
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with tactical dark theme
- **Backend**: Supabase (PostgreSQL + Storage)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Animations**: Framer Motion
- **AI**: Groq (llama-3.3-70b-versatile) for payment reminders and analytics

## Quick Start (New Device)

```bash
# 1. Clone the project
git clone <your-repo-url> global-essentials
cd global-essentials

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.local.example .env.local
# Edit .env.local with your credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# GROQ_API_KEY=your-groq-api-key

# 4. Run dev server
pnpm dev
```

## Supabase Setup Required

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-schema.sql`
3. Run additional migrations:
   - `supabase/migrations/add_installment_amount_paid.sql` — adds `amount_paid` and `note` columns
4. Create storage bucket:
   - Go to **Storage** → "Create bucket"
   - Name: `product-images`
   - Set to **public read**
5. Get credentials from **Settings → API**:
   - Project URL
   - `anon` public key

### Database Schema

| Table | Key Columns |
|-------|-------------|
| `products` | id, name, cost_price, selling_price, stock_level, image_url, image_urls |
| `clients` | id, full_name, phone_number |
| `sales` | id, product_id, client_id, total_amount, payment_status, payment_method, order_number |
| `installments` | id, sale_id, amount_due, amount_paid, due_date, is_paid, paid_at, note |
| `expenses` | id, description, amount, category |
| `shipping_rates` | id, shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm |
| `orders` | id, order_number, client_name, client_phone, product_id, shipping_type, total |

## File Structure

```
global-essentials/
├── app/
│   ├── (pos)/                    # Staff POS routes (auth-gated)
│   │   ├── dashboard/            # Ground Truth, Pipeline, Low Stock alerts
│   │   ├── new-sale/             # Product grid + bottom cart bar + slide-in cart sidebar
│   │   ├── ledger/               # Sales history
│   │   ├── debts/                # Installments list, payment modal, WhatsApp reminders
│   │   ├── orders/               # Order management
│   │   ├── inventory/            # Product CRUD
│   │   ├── expenses/             # Expense CRUD + category breakdown
│   │   ├── analytics/            # Revenue charts, expense pie, AI queries
│   │   ├── export/               # CSV download for sales/expenses/debts
│   │   ├── import-simulator/     # Import cost calculator with AI advisor
│   │   ├── settings/             # Configuration
│   │   └── layout.tsx            # Header + bottom nav (5 primary) + drawer (secondary)
│   ├── catalog/                   # Public product catalog (no auth)
│   │   ├── page.tsx              # Product grid
│   │   └── [productId]/page.tsx  # Product detail + WhatsApp order
│   ├── layout.tsx                # Root layout + Toaster
│   └── page.tsx                  # Redirects to /dashboard
├── components/
│   ├── pos/
│   │   ├── POSCart.tsx           # Cart sidebar with client search + phonebook import
│   │   └── ProductGrid.tsx       # Product grid with search
│   └── ...
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── supabase-types.ts         # TypeScript types (Installment has amount_paid, note)
│   ├── utils.ts                  # formatCurrency, formatDate, isOverdue, getWhatsAppLink
│   └── actions/                  # Server actions
│       ├── sales.ts              # createSale, getProducts, getClients, markSaleFullyPaid
│       ├── ledger.ts              # getSalesHistory, searchDebts, recordInstallmentPayment, markInstallmentPaid
│       ├── receipts.ts            # getSaleReceipt (HTML receipt generation)
│       ├── inventory.ts          # Product CRUD + uploadProductImage
│       ├── expenses.ts           # Expense CRUD + getExpenseStats
│       ├── dashboard.ts           # getDashboardStats
│       ├── analytics.ts          # getAnalyticsData
│       ├── ai.ts                  # generatePaymentReminder, analyzePaymentRisk, Groq AI
│       └── export.ts             # CSV generation helpers
├── lib/receipts/
│   └── template.ts               # generateReceiptHTML (receipt HTML template)
├── stores/
│   └── auth-store.ts             # Zustand auth store
├── hooks/
│   ├── useOffline.ts             # Online/offline detection
│   ├── useSyncStatus.ts         # Pending sync count
│   └── usePushNotifications.ts   # Push notification scheduling
├── lib/offline/
│   ├── sync.ts                   # queueSale, syncPendingSales
│   └── db.ts                     # IndexedDB helpers for offline queue
├── api/
│   └── ai-analytics/             # POST endpoint for AI-powered analytics queries
├── types/
│   ├── index.ts                  # Re-exports types
│   └── contacts.d.ts             # Web Contacts API type declarations
└── supabase/
    └── migrations/
        ├── add_installment_amount_paid.sql  # amount_paid + note columns
        └── ...                                # other migrations
```

## Key Features Logic

### New Sale Flow
1. Tap products in the grid → added to cart (bottom bar appears showing item count + total)
2. Tap the bottom cart bar → slides in from right with full cart sidebar
3. In cart: select/create client (manual or from phonebook), choose payment method
4. Complete Sale → receipt modal shown
5. Receipt has Print, Share, and Download PDF options

### Phonebook Import
When creating a new client, tap "From Phonebook" to import name + phone directly from device contacts via Web Contacts API (Chrome 86+, Safari 16+). Falls back to manual entry if unsupported.

### Pay-Slow Installment Logic
When a sale is created with `payment_method: 'pay-slow'`:
1. First installment = ceil(total / duration) → marked as paid immediately
2. Remaining (n-1) installments = floor(total / duration) → unpaid
3. Due dates are monthly from the sale date

### Payment Recording (Partial & Backdated)
On the Debts page, tap the **$ (DollarSign)** button on any installment to open the payment modal:
- **Amount** — defaults to full installment. Enter smaller value for partial payment.
- **Date** — defaults to today. Set to a past date for late payments.
- **Note** — optional memo (e.g. "Bank transfer")
- Multiple partial payments accumulate until installment is fully paid (`is_paid = true`)
- When all installments for a sale are `is_paid = true`, sale `payment_status` → `'paid'`

### Mark Entire Sale Fully Paid
The **wallet icon** on debts rows marks all unpaid installments for that sale as paid in one click (via `markSaleFullyPaid` action).

### Ground Truth Calculation
```
groundTruth = (sum of paid sales total_amount) - (sum of all expenses)
inPipeline = sum of unpaid installment amounts
lowStock = products where stock_level < reorder_threshold
```

### Receipt Printing
Receipts render full content (no truncation) by:
- `pageStyle: '@page { size: auto; margin: 0; }'` in useReactToPrint
- html2canvas receives `scrollHeight` to capture entire receipt
- Preview div has no height clip

### WhatsApp Reminder Format
```
Hi {clientName}, this is a reminder that payment of {amount} due on {date}.
Please arrange payment at your earliest convenience. - Global Essentials
```
Or use AI-generated tailored messages via the Sparkles button on the Debts page.

## AI Features (Groq Integration)

### Natural Language Analytics
On the Analytics page, users can ask questions like:
- "Which product made the most money?"
- "What was our profit this month?"
- "Show me expense insights"

### AI-Powered Payment Reminders
On the Debts page, click the Sparkles button to generate AI-tailored WhatsApp reminder messages for each client.

### API Setup
```bash
# Get a free Groq API key from https://console.groq.com
GROQ_API_KEY=your_groq_api_key
```

## Design System

- **Theme**: Deep Dark Mode (black #0a0a0a, slate #1e293b)
- **Accents**: Electric Blue (#3b82f6), Neon Green (#22ff66), Orange (#f97316), Red (#ef4444)
- **Buttons**: `btn-tactical` class — h-14, rounded-xl, shadow-tactical, font-black
- **Cards**: `card-tactical` class — bg-tactical-slate, rounded-2xl, border-white/10
- **Typography**: font-black, uppercase, tracking-tighter for headers
- **Layout**: Bottom nav (5 primary items: Dashboard, New Sale, Ledger, Debts, Orders) + slide-out drawer for secondary items (Inventory, Expenses, Analytics, Import, Settings, Export)

## Adding New Features

1. Create server action in `lib/actions/` using Supabase client
2. Import types from `@/lib/supabase-types`
3. Export functions to call from client components
4. Use `sonner` toast for notifications: `import { toast } from 'sonner'`
5. Use `lucide-react` for icons
6. For animations: `import { motion, AnimatePresence } from 'framer-motion'`

### Supabase SDK Pattern
```typescript
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase-types';

// Create
const { data, error } = await supabase.from('products').insert([data]).select().single();

// Read
const { data, error } = await supabase.from('products').select('*').order('name');

// Update
const { data, error } = await supabase.from('products').update(changes).eq('id', id);

// Delete
const { error } = await supabase.from('products').delete().eq('id', id);

// Relations (join)
const { data } = await supabase.from('sales').select('*, product:products(*), client:clients(*)');
```

### Server Action Pattern
```typescript
// lib/actions/sales.ts
'use server';

export async function doSomething(param: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  // ... do work
  return { data: result, error: null };
}
```

## Useful Commands

```bash
pnpm dev     # Start dev server
pnpm build   # Production build
pnpm lint    # ESLint check
npx tsc --noEmit --skipLibCheck  # Type-check without emitting files
```

## Next Steps to Consider

1. **Authentication** - Add Supabase Auth for staff login
2. **Push Notifications** - Browser notifications for upcoming due dates
3. **Multi-currency** - Support for multiple currencies
4. **Dark/Light mode toggle**
5. **Thermal printer integration** - Print receipts directly
6. **Order status workflow** - Formal states (pending, confirmed, shipped, delivered)
7. **Client history** - View all past purchases/installments for a client

## Questions Claude Can Help With

- "Add a dark/light mode toggle"
- "Implement user authentication with Supabase Auth"
- "Add browser push notifications for due date reminders"
- "Add a new expense category"
- "Add a new table/column to the schema"
- "Improve the AI reminder messages"
- "Add more analytics questions"
- "Add order status tracking with multiple states"