# Global Essentials - Claude Code Continuation Guide

## Project Overview
A mobile-first POS (Point of Sale) and Debt Management system called "Global Essentials" built with:
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with tactical dark theme
- **Backend**: Supabase (PostgreSQL + Storage)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Toasts**: Sonner

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
2. Go to **SQL Editor** and run the schema from `supabase-schema.sql`
3. Create storage bucket:
   - Go to **Storage** → "Create bucket"
   - Name: `product-images`
   - Set to **public read**
4. Get your credentials from **Settings → API**:
   - Project URL
   - `anon` public key

### Database Schema (already created via SQL)

| Table | Key Columns |
|-------|-------------|
| **products** | id, name, cost_price, selling_price, stock_level, image_url |
| **clients** | id, full_name, phone_number |
| **sales** | id, product_id, client_id, total_amount, payment_status, payment_method |
| **installments** | id, sale_id, amount_due, due_date, is_paid, paid_at |
| **expenses** | id, description, amount, category |

## File Structure

```
global-essentials/
├── app/
│   ├── (pos)/                    # Staff POS routes
│   │   ├── dashboard/           # Ground Truth, Pipeline, Low Stock
│   │   ├── new-sale/            # 3-step checkout (Product → Client → Payment)
│   │   ├── ledger/              # Transaction history
│   │   ├── debts/               # Overdue + upcoming installments
│   │   ├── inventory/           # Product CRUD
│   │   ├── expenses/            # Expense CRUD + category breakdown
│   │   ├── analytics/           # Revenue charts, expense pie, top products
│   │   ├── export/              # CSV download for sales/expenses/debts
│   │   └── layout.tsx           # Bottom nav (8 items, scrollable)
│   ├── catalog/                 # Public product catalog (no auth)
│   │   ├── page.tsx             # Product grid
│   │   └── [productId]/page.tsx # Product detail + WhatsApp order
│   ├── layout.tsx               # Root layout + Toaster
│   └── page.tsx                 # Redirects to /dashboard
├── lib/
│   ├── supabase.ts              # Supabase client
│   ├── supabase-types.ts        # TypeScript types
│   ├── appwrite-types.ts        # Shared types (DashboardStats, CatalogProduct)
│   ├── utils.ts                 # formatCurrency, formatDate, isOverdue, etc.
│   └── actions/                 # Server actions (async DB operations)
│       ├── dashboard.ts         # getDashboardStats()
│       ├── sales.ts            # createSale(), getProducts(), getClients()
│       ├── ledger.ts           # getSalesHistory(), searchDebts(), markInstallmentPaid()
│       ├── inventory.ts        # CRUD + uploadProductImage()
│       ├── expenses.ts         # CRUD + getExpenseStats()
│       ├── analytics.ts        # getAnalyticsData()
│       ├── catalog.ts         # getCatalogProducts(), getProductById()
│       ├── ai.ts              # AI functions (generatePaymentReminder, analyzePaymentRisk)
│       └── export.ts           # CSV generation helpers
├── api/
│   └── ai-analytics/          # API route for natural language analytics queries
│       └── route.ts           # POST endpoint for AI-powered analytics
├── types/
│   └── index.ts                # Re-exports types
└── supabase-schema.sql         # Full SQL schema for reference
```

## Key Features Logic

### Pay-Slow Installment Logic
When a sale is created with `payment_method: 'pay-slow'`:
1. First installment = ceil(total / duration) → marked as paid
2. Remaining (n-1) installments = floor(total / duration) → unpaid
3. Due dates are monthly from sale date

### Ground Truth Calculation
```
groundTruth = (sum of paid sales total_amount) - (sum of all expenses)
inPipeline = sum of unpaid installment amounts
```

### WhatsApp Reminder Format
```
Hi {clientName}, this is a reminder that payment of {amount} is due on {date}.
Please arrange payment at your earliest convenience. - Global Essentials
```

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

### Changing AI Model
In `lib/groq.ts`, modify the model parameter:
```typescript
model: 'llama-3.3-70b-versatile', // Default - fast and capable
// Or use: 'mixtral-8x7b-32768' for longer context
```

## Design System

- **Theme**: Deep Dark Mode (black #0a0a0a, slate #1e293b)
- **Accents**: Electric Blue (#3b82f6), Neon Green (#22ff66), Orange (#f97316), Red (#ef4444)
- **Buttons**: `btn-tactical` class - h-14, rounded-xl, shadow-tactical, font-black
- **Cards**: `card-tactical` class - bg-tactical-slate, rounded-2xl, border-white/10
- **Typography**: font-black, uppercase, tracking-tighter for headers

## Adding New Features

1. Create server action in `lib/actions/` using Supabase client
2. Import types from `@/lib/supabase-types` or `@/lib/appwrite-types`
3. Export functions to call from client components
4. Use `sonner` toast for notifications: `import { toast } from 'sonner'`
5. Use `lucide-react` for icons

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

## Useful Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint check
```

## Next Steps to Consider

1. **Authentication** - Add Supabase Auth for staff login
2. **Push Notifications** - Browser notifications for upcoming due dates
3. **PDF Receipts** - Generate downloadable receipts
4. **Multi-currency** - Support for multiple currencies
5. **Dark/Light mode toggle**
6. **Offline mode** - Service worker + IndexedDB for offline sales
7. **Print receipts** - Thermal printer integration
8. **Storage bucket** - Ensure `product-images` bucket exists for image uploads

## Questions Claude Can Help With

- "Add a dark/light mode toggle"
- "Implement user authentication with Supabase Auth"
- "Add browser push notifications for due date reminders"
- "Create a PDF receipt generator"
- "Add offline support with service worker"
- "How do I set up RLS policies in Supabase?"
- "Help me add a new expense category"
- "Add a new table/column to the schema"
- "Improve the AI reminder messages"
- "Add more analytics questions"