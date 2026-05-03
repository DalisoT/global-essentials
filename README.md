# Global Essentials - POS & Debt Management System

A mobile-first POS and Debt Management system built with **Next.js 14**, **Tailwind CSS**, and **Appwrite**.

## Features

- **Dashboard** - Ground Truth (Paid - Expenses), Pipeline (Unpaid), Low Stock alerts
- **Pay-Slow Logic** - First installment upfront, remaining (n-1) monthly
- **Debt Collection** - Overdue highlighting, WhatsApp reminders with one-click mark paid
- **Public Catalog** - Stunning product grid, WhatsApp ordering
- **PWA Ready** - manifest.json configured with next-pwa
- **Expense Tracking** - Full CRUD with category breakdown
- **Analytics Dashboard** - Revenue charts, expense pie charts, top products, monthly trends
- **CSV Export** - Download sales, expenses, and debts reports

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with tactical dark theme
- **Backend**: Appwrite (Database, Storage)
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **State**: Zustand
- **Toasts**: Sonner

## Getting Started

### 1. Setup Appwrite

1. Create a project at [cloud.appwrite.io](https://cloud.appwrite.io)
2. Create a database named `global_essentials`
3. Create collections with these attributes:

**products**
- name: string (required)
- cost_price: float (required)
- selling_price: float (required)
- stock_level: integer (required)
- image_url: string (optional)

**clients**
- full_name: string (required)
- phone_number: string (required)

**sales**
- product_id: string (required)
- client_id: string (required)
- total_amount: float (required)
- payment_status: string (required, enum: paid/pending)
- payment_method: string (required, enum: cash/pay-slow)

**installments**
- sale_id: string (required)
- amount_due: float (required)
- due_date: string (required)
- is_paid: boolean (required)
- paid_at: string (optional)

**expenses**
- description: string (required)
- amount: float (required)
- category: string (required)

4. Create a storage bucket: `product-images` (public read, auth create)
5. Enable Read/Write permissions for authenticated users

### 2. Configure Environment

```bash
cd global-essentials
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
```

### 3. Install & Run

```bash
npm install
npm run dev
```

## Project Structure

```
global-essentials/
├── app/
│   ├── (pos)/                    # Protected POS routes
│   │   ├── dashboard/            # Ground Truth Dashboard
│   │   ├── new-sale/             # 3-step checkout flow
│   │   ├── ledger/               # Transaction history
│   │   ├── debts/                # Debt collection
│   │   └── inventory/            # Product CRUD
│   ├── catalog/                  # Public product catalog
│   │   └── [productId]/          # Product detail
│   └── layout.tsx                # Root layout
├── lib/
│   ├── appwrite.ts               # Appwrite client
│   ├── appwrite-types.ts         # TypeScript types
│   ├── utils.ts                  # Utility functions
│   └── actions/                  # Server actions
│       ├── dashboard.ts
│       ├── sales.ts
│       ├── ledger.ts
│       ├── inventory.ts
│       └── catalog.ts
└── public/
    └── manifest.json              # PWA manifest
```

## Design System

- **Theme**: Deep Dark Mode (Black/Gray/Slate)
- **Accents**: Electric Blue (#3b82f6), Neon Green (#22ff66), Warning Orange (#f97316)
- **Buttons**: Large (30px+), rounded corners, heavy shadows
- **Typography**: font-black, uppercase, tracking-tighter for headers
- **Navbar**: Glassmorphism with backdrop blur

## License

MIT
# global-essentials
