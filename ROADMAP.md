# Global Essentials — Strategic Roadmap

> Living document. Every checkbox is a discrete unit of work that can be picked up
> or resumed later. Each phase ships behind **frequent commits**, **local testing**
> (`pnpm dev`, `npx tsc --noEmit --skipLibCheck`, `pnpm lint`), and **Vercel preview
> deployments** before being marked complete.

---

## Guiding Principles (apply to every phase)

1. **AI-first, advisory by default** — every new AI capability is *advisory*; users
   opt in to auto-actions per category (e.g. auto-send reminder after 7 days late).
2. **Zambia-only for now** — base currency ZMW, no multi-currency UI in early
   phases. Multi-branch deferred until you have ≥2 physical locations.
3. **Real data only** — the AI reasons over your actual journal entries, sales,
   expenses, inventory. No mock data in production paths.
4. **Frequent, small commits** — one checkbox = one commit (or a small PR).
5. **Type-check + lint clean** before each commit.
6. **Vercel preview check** — every merged PR produces a preview URL you can tap
   on a phone before promoting to production.
7. **Audit everything** — every AI call + every automated action lands in
   `audit_log` (table already exists from Phase 1).

---

## Phase Status Legend

- [ ] = Not started
- [/] = In progress
- [x] = Complete (committed + tested on Vercel preview)

---

# FOUNDATION SPRINT — Fix the bedrock before AI scales

> Why first: profitability metrics are slightly wrong today (units_sold treated as
> 1 per sale), `recordInstallmentPayment` does 2-4 round-trips, and a Supabase
> anon key is committed to the repo. These bite us the moment AI starts to trust
> the numbers.

- [x] **F1.** Add `quantity INTEGER NOT NULL DEFAULT 1` column to `sales` table
      + migration `supabase/migrations/add_sales_quantity.sql`
- [x] **F2.** Update `createSale` to write `quantity` for each sale row
- [x] **F3.** Update `deleteSale` to restore stock by `quantity` (not always +1)
- [x] **F4.** Update `lib/actions/profitability.ts` `units_sold` aggregation to
      use `sales.quantity` instead of counting rows
- [x] **F5.** Rewrite `recordInstallmentPayment` as a single UPDATE (drop the
      chained `.then()` blocks that warn about missing columns)
- [x] **F6.** Fix `createSale` RPC fallback path — ensure stock is restored if the
      RPC call returns an error after stock decrement
- [x] **F7.** Rotate the Supabase anon key in `.env.local.example` (replace with
      a placeholder, document in README)
- [x] **F8.** Add CHECK constraint migration: `installments.amount_paid <= amount_due`
- [x] **F9.** Add CHECK constraint migration: `sales.quantity > 0`
- [x] **F10.** Add `audit_log` viewer page at `/(pos)/audit/` (admin/owner only)
- [x] **F11.** Remove unused `appwrite/` folder + drop `appwrite` from
      `package.json` (dead dependency from earlier backend swap)
- [x] **F12.** Add DB index migration on `journal_entries(entry_date, reference_type)`
      for Phase 3 CFO queries

---

# PHASE 3 — AI CFO Copilot *(highest ROI, builds on real books)*

> Conversational AI over your actual journal entries + sales + expenses +
> inventory. Advisory by default; no auto-actions in this phase.

## 3A — Plumbing

- [x] **3A.1.** Create `lib/ai/prompts/` directory; extract every Groq prompt
      out of `lib/actions/ai.ts` and `lib/actions/import-advisor.ts` into
      versioned prompt files
- [x] **3A.2.** Create `lib/ai/tools.ts` — declare Groq function-calling tool
      schemas: `getPnL`, `getTrialBalance`, `getTopProducts`,
      `getAgingDebts`, `getCashPosition`, `getSlowMovingStock`
- [x] **3A.3.** Create `lib/ai/cfo-engine.ts` — function-calling loop that lets
      the model call the tools and synthesize a final answer
- [x] **3A.4.** Add `ai_usage` table migration (user_id, route, prompt_tokens,
      completion_tokens, model, created_at) for cost tracking
- [x] **3A.5.** Add server action `askCFO(question)` in `lib/actions/cfo.ts`
- [x] **3A.6.** Add audit-log entry on every `askCFO` call (already wired by
      journals.ts pattern — replicate)

## 3B — UI

- [x] **3B.1.** Create route `/(pos)/cfo/` with chat layout
- [x] **3B.2.** Build `<CFOChatPanel>` — streaming-friendly message list,
      auto-scroll, suggestion chips ("What's my net profit this month?",
      "Which products are my profit engines?", "How much cash will I have in
      30 days?")
- [x] **3B.3.** Build `<CFOAnswerCard>` — renders AI text + a small "based on"
      disclosure showing which tool calls were used + the numbers
- [x] **3B.4.** Add "AI" entry to POS drawer + bottom nav (replace nothing,
      add as 6th item only on wide screens, or surface from dashboard widget
      on mobile)
- [x] **3B.5.** Add "Ask CFO" button on dashboard metric widgets — context-aware
      prefill ("Tell me more about Ground Truth")

## 3C — Quality

- [x] **3C.1.** Add 10 hand-crafted test questions to a `cfo-evals` file with
      expected answer shape (golden set)
- [x] **3C.2.** Add rate limiting: max 30 questions/user/day (configurable in
      `lib/config.ts`)
- [x] **3C.3.** Add fallback response when Groq is unavailable (template
      "I couldn't reach the AI right now, but here's the raw data: ...")

---

# PHASE 4 — Learning Academy *(financial literacy + business lessons)*

> A persistent learning module with lessons tied to *your* business data.
> Pillar: Financial Literacy, Diversification, Business Management.

## 4A — Schema + content model

- [x] **4A.1.** Create `pillars` table (id, slug, name, description, icon, color, order)
- [x] **4A.2.** Create `lessons` table (id, pillar_id, slug, title, body_md,
      audio_url, est_minutes, order, requires_data TEXT[] — flags like
      'sales','inventory','debts','expenses')
- [x] **4A.3.** Create `user_lesson_progress` table (user_id, lesson_id,
      started_at, completed_at, quiz_score)
- [x] **4A.4.** Create `lesson_resources` table (lesson_id, label, href, kind
      — internal route, external url, or app action)
- [x] **4A.5.** Seed `pillars`: Financial Literacy, Diversification, Business
      Management, Operations & Scaling
- [x] **4A.6.** Seed first 14 lessons (3-4 per pillar) — see content list below

### Seeded lesson content (reference only — not a task list)

Financial Literacy
- What is Gross Margin? *(tied to profitability data)*
- Cash Flow vs Profit *(tied to journal)*
- Working Capital & Cash Buffer *(tied to balance sheet)*
- Accounts Receivable Aging *(tied to debts)*

Diversification
- Product Mix Concentration Risk
- Supplier Concentration Risk
- Revenue Stream Diversification

Business Management
- Pricing Psychology & Margin Tiers
- Inventory Turnover & Dead Stock
- Unit Economics per Product
- The Hiring Trigger Formula

Operations & Scaling
- Writing a One-Page SOP
- Fraud Prevention Basics
- Cash Drawer Reconciliation

## 4B — Generation pipeline

- [x] **4B.1.** Server action `generatePersonalizedQuiz(lessonId)` — Groq reads
      lesson + your actual data (sales, profit, debt aging, inventory) and
      returns 3-5 multiple-choice questions with explanations
- [x] **4B.2.** Audio narration via Web Speech API (Groq has no TTS;
      pre-generated `audio_url` column on lessons is preserved as the
      upgrade path when the user later wants to invest in ElevenLabs
      / OpenAI TTS)
- [x] **4B.3.** Server action `generateLessonExamples(lessonId)` — fetches
      real numbers from your DB and injects them into the lesson body
      (uncached in v1; per-(lesson, data-hash) cache is a follow-up)

## 4C — UI

- [x] **4C.1.** Route `/(pos)/learn/` — pillar grid home
- [x] **4C.2.** Route `/(pos)/learn/[pillarSlug]/` — lesson list per pillar
- [x] **4C.3.** Route `/(pos)/learn/[pillarSlug]/[lessonSlug]/` — lesson reader
      with markdown render, optional audio player, "Apply to your business"
      CTA list, "Take quiz" button
- [x] **4C.4.** Add "Learn" tab to POS bottom nav (will require reshaping the
      5-icon bar to 4 primary + drawer, or scrollable strip)
- [x] **4C.5.** Add "Today's lesson" widget to dashboard
- [x] **4C.6.** Add lesson-completion celebration (sonner toast + small XP-style
      streak counter on learn home)

## 4D — Quality

- [x] **4D.1.** Track read-time per lesson (scroll depth); persist progress
- [x] **4D.2.** Add "Bookmarks" feature (save lessons to revisit)
- [x] **4D.3.** Add daily-streak reminder nudge (sonner toast, mounted in
      (pos) layout — fires once per day before noon for users with a
      2+ day streak who haven't completed anything today)

---

# PHASE 5 — Multi-Branch *(deferred; trigger when you open location #2)*

> Triggered only when you have ≥2 physical locations. Zambia-only, single
> currency (ZMW). Multi-currency stays out of scope.

- [ ] **5.1.** Migration: `branches` table (id, name, location, manager_id,
      opened_at, is_active)
- [ ] **5.2.** Migration: add nullable `branch_id` to `products`, `sales`,
      `expenses`, `journal_entries` (backward compatible)
- [ ] **5.3.** UI: Branches management page at `/(pos)/branches/`
- [ ] **5.4.** UI: Branch selector in POS header (sticky once branches > 1)
- [ ] **5.5.** Server action `transferStock(productId, fromBranchId, toBranchId, qty)`
      + audit log
- [ ] **5.6.** Update Dashboard "Ground Truth" to be branch-aware
- [ ] **5.7.** Update Profitability to be branch-aware
- [ ] **5.8.** Update AI CFO tools with `branchId` parameter
- [ ] **5.9.** CFO prompt addition: "Compare branches" question type

---

# PHASE 6 — Team & RBAC *(before you hire more than 2 staff)*

> Move from "single owner" to "owner + managers + cashiers". Extends existing
> `profiles.role` (already present).

- [ ] **6.1.** Migration: expand `profiles.role` CHECK to include
      `('owner','manager','cashier','accountant')`
- [ ] **6.2.** Migration: add `managed_branches UUID[]` to `profiles` for managers
- [ ] **6.3.** Server helper `requireRole(roles: Role[])` in `lib/supabase-server.ts`
- [ ] **6.4.** Apply `requireRole` guards across all `lib/actions/*.ts`
      (owner-only: AI CFO, Profitability, Accounting; manager+: most ops;
      cashier: POS only — no cost prices visible)
- [ ] **6.5.** UI: hide cost prices + P&L numbers when role = cashier
- [ ] **6.6.** UI: Staff management page at `/(pos)/settings/staff/` (owner only)
- [ ] **6.7.** UI: Invite flow (Supabase admin invite + role assignment)
- [ ] **6.8.** UI: "Acting as" mode (owner can impersonate a staff role for
      debugging)
- [ ] **6.9.** Audit log viewer (Phase F10) gains filters by user/action

---

# PHASE 7 — Predictive AI & Forecasting

> Forward-looking intelligence using historical journal + sales data.

- [x] **7.1.** Migration: `forecasts` table (id, kind, target_id, horizon_days,
      payload JSONB, generated_at, model_version)
- [x] **7.2.** Server action `forecastDemand(productId, days)` — simple
      moving-average baseline first; Prophet/ARIMA later if data depth allows
- [x] **7.3.** Server action `forecastCashFlow(days)` — based on installment
      schedule + sales velocity
- [x] **7.4.** Server action `predictDefaults(clientId)` — probability of
      next-installment default based on history
- [x] **7.5.** UI: Forecast widget on dashboard with "next 30 days cash"
      sparkline
- [x] **7.6.** UI: Per-product forecast card in inventory page
- [x] **7.7.** Smart reorder alert: combine forecast + supplier lead time +
      safety stock (existing `reorder.ts` action — wire UI to it)
- [x] **7.8.** Scheduled job (Vercel Cron) to regenerate forecasts nightly
- [x] **7.9.** CFO tool additions: `forecastCashFlow`, `forecastDemand`

---

# PHASE 8 — Customer-Facing Intelligence

> Make the public catalog smarter. Still Zambia-only.

- [x] **8.1.** Auto-generate product descriptions with Groq from
      name + category + price (review/edit before publish) — commit `db01288`
- [x] **8.2.** Visual search — Groq vision model matches uploaded photo to
      inventory — commit `20eb720`
- [x] **8.3.** "You may also like" — purchase-history co-occurrence —
      commit `f857c73`
- [x] **8.4.** AI chatbot on catalog with WhatsApp handoff — commit `ed0234a`
- [x] **8.5.** Order status workflow UI (pending → confirmed → packed →
      shipped → delivered) — commit `072768e`
- [x] **8.6.** Review summaries — Groq summarizes reviews per product —
      commit `e25e101`

---

# PHASE 9 — Intelligence Memory & Compounding

> Make the AI yours over time.

- [x] **9.1.** `ai_recommendations` table (id, kind, title, body, payload,
      priority, status, source_action, related_id, expires_at, updated_at
      trigger) — commit `0573a75`
- [x] **9.2.** Track accept/reject on every AI suggestion —
      `updateRecommendationStatus(dismissed/accepted/acted_on)` with
      optimistic UI, `getRecommendationHistory()` for the memory layer —
      commit `0573a75`
- [x] **9.3.** Weekly briefing (Vercel Cron, Sun 08:00 Lusaka) — Groq
      composes summary/highlight/3-5 sections from past 7 days snapshot,
      persisted as `kind='weekly_briefing'` row — commits `9cd4915`,
      `c7e36c5` (memory injection)
- [x] **9.4.** Anomaly detection (Vercel Cron, 02:15 Lusaka) — IQR
      boxplot on 30-day same-day-of-week baseline, flags revenue
      high/low and expense spikes — commits `d0c2781`, `c7e36c5`
      (priority blending with memory)
- [x] **9.5.** Goal tracking — `goals` table (revenue/profit/cash_buffer,
      weekly/monthly), live progress bars on dashboard, inline create/deactivate
      form, nightly sync cron (02:30 Lusaka) — commit `ccb0efc`
- [x] **9.6.** Memory layer — `getMemorySnapshot()` reads 60-day
      accept/reject history, computes per-kind engagement score, renders
      `USER PREFERENCES` prose block for all AI system prompts,
      blends priority hints into anomaly and goal-progress actions —
      commit `c7e36c5`

---

# PHASE 11 — Pre-orders & Waitlist *(done)*

> Walk-in or catalog, customer reserves a pair for a future import.
> Deposit covers cost + shipping; balance is the margin.

- [x] **11.1.** `pre_orders` + `pre_order_events` tables with RLS,
      partial indexes, `updated_at` trigger — commit `cb22d80`
- [x] **11.2.** Deposit calculation engine + CRUD actions
      (`createPreOrder`, `recordDepositPayment`, etc).
      Tracking code `PR-YYYY-NNNN` with race-safe generation —
      commit `7cee92d`
- [x] **11.3.** Lifecycle actions: `markArrived`, `convertToSale`,
      `cancelPreOrder` (with optional refund). State machine
      enforced before every transition — commit `beb7fc4`
- [x] **11.4.** POS UI: pre-order form with live pricing preview —
      commit `2322acf`
- [x] **11.5.** POS UI: pre-order detail page with deposit payment,
      mark arrived, complete sale, cancel — commit `b9a1e47`
- [x] **11.6.** Admin `/pre-orders` list with filter pills, search,
      stats row, and bulk mark-arrived — commit `10fc0b2`
- [x] **11.7.** Catalog: "Pre-order" CTA on product page (primary
      CTA when out of stock) + public form with rate-limited
      `createCatalogPreOrder` — commit `d81a702`
- [x] **11.8.** Public confirmation + tracking pages.
      Rate-limited 10/hour per IP. WhatsApp handoff for
      deposit payment — commit `5dd7886`
- [x] **11.9.** 10 WhatsApp message templates + "Send update"
      button on the detail page (auto-suggested by current
      status) — commit `992c07f`
- [x] **11.10.** Cadence cron (Day 14 in-transit, Day 30 customs,
      Day 45 almost-there, +3 days past expected apology).
      Idempotent per cadence_key. "X messages to send today"
      banner on the list — commit `09fae85`
- [x] **11.11.** Phase 9 link: pre-order stats in the weekly
      briefing snapshot + pre-order engagement signal in
      the memory layer (rolled into commit `484ec8b`)

---

# PHASE 12 — Operational Polish *(small wins, big day-to-day impact)*

> The app is solid. These are the small enhancements that turn it
> from "working" into "enjoyable to use every day".

- [x] **12.1.** Surface product `weight_kg`, `shipping_per_kg`, and
      `pre_order_enabled` in the inventory edit form. The pre-order
      deposit math was defaulting to 1.0 kg for every product,
      skewing the shipping cost — commit `78dfa8d`
- [x] **12.2.** "N people waiting" badge on catalog product cards.
      Free demand-signal that turns the catalog into a working
      pre-order funnel even for browsers who weren't looking
      for it — commit `9077a94`
- [x] **12.3.** Pre-orders into the weekly briefing snapshot
      (active count, this-week, converted, deposits held,
      top-pre-ordered product) — commit `484ec8b`
- [x] **12.4.** Pre-order engagement signal in the memory layer
      (high/medium/low based on 60-day conversion rate) — nudges
      the model to lean into pre-orders when they work, or
      investigate when they don't — commit `484ec8b`
- [x] **12.5.** End-of-day WhatsApp digest cron (19:00 Lusaka).
      3-line summary (summary + highlight + tomorrow) lands
      in the inbox as a `kind='custom'` recommendation —
      commit `24dae7f`
- [x] **12.6.** Cash drawer reconciliation tool at
      `/(pos)/drawer/`. One row per business day. System
      computes expected from yesterday's close + today's
      sales − expenses + pre-order deposits; user enters
      what they actually counted and the variance is
      shown live — commit `5cea40e`

---

# PHASE 10 — Opt-in Auto-Actions *(scoped, not yet implemented)*

> This is when advisory becomes automatic — per category, with audit log +
> easy rollback. The foundation is in place (Phase 9 intelligence + Phase 11
> pre-orders + Phase 12 daily digest). Estimated 1-2 weeks of focused work
> to ship v1. Best done as its own session.

- [ ] **10.1.** `automation_rules` table (id, category, enabled, condition JSON,
      action JSON, created_by, created_at, last_run_at)
- [ ] **10.2.** UI: Automations page at `/(pos)/settings/automations/`
- [ ] **10.3.** Categories (v1):
      - Auto-send WhatsApp reminder after N days overdue
      - Auto-create reorder PO when stock < safety stock
      - Auto-post expense journal when expense created
      - Auto-tag suspicious transactions (e.g., sale > 3σ above mean)
- [ ] **10.4.** Each rule has: dry-run mode (recommend only) vs live mode (act)
- [ ] **10.5.** Audit log entry on every auto-action with full input + output
- [ ] **10.6.** "Undo" button on the last 24h of auto-actions
- [ ] **10.7.** Daily digest of auto-actions taken (email + in-app)

---

> This is when advisory becomes automatic — per category, with audit log +
> easy rollback.

- [ ] **10.1.** `automation_rules` table (id, category, enabled, condition JSON,
      action JSON, created_by, created_at, last_run_at)
- [ ] **10.2.** UI: Automations page at `/(pos)/settings/automations/`
- [ ] **10.3.** Categories (v1):
      - Auto-send WhatsApp reminder after N days overdue
      - Auto-create reorder PO when stock < safety stock
      - Auto-post expense journal when expense created
      - Auto-tag suspicious transactions (e.g., sale > 3σ above mean)
- [ ] **10.4.** Each rule has: dry-run mode (recommend only) vs live mode (act)
- [ ] **10.5.** Audit log entry on every auto-action with full input + output
- [ ] **10.6.** "Undo" button on the last 24h of auto-actions
- [ ] **10.7.** Daily digest of auto-actions taken (email + in-app)

---

# Quick Wins (anytime, low risk)

> These can be done between phases without blocking anything else.

- [ ] **QW.1.** Dashboard "What should I do today?" widget — Groq summarizes
      dashboard stats into 3 actionable bullets
- [ ] **QW.2.** Daily Insights page at `/(pos)/insights/` — 3 auto-generated
      insights refreshed every 24h
- [ ] **QW.3.** Extend AI reminder engine to: post-purchase thank-you, win-back
      to dormant clients, restock notifications for catalog browsers
- [ ] **QW.4.** Suggestion chips everywhere — surface "ask the AI" buttons on
      every report (PnL, Trial Balance, Profitability, Debts aging)
- [ ] **QW.5.** Dark/light mode toggle (Tailwind dark variant + toggle in
      settings — `components/ThemeToggle.tsx` already exists, just wire it up)

---

# Testing Strategy (apply to every phase)

- [ ] **T.1.** `npx tsc --noEmit --skipLibCheck` clean before every commit
- [ ] **T.2.** `pnpm lint` clean before every commit
- [ ] **T.3.** `pnpm build` clean before every merge to main
- [ ] **T.4.** Vercel preview URL tested on real mobile (your phone) before
      promoting to production
- [ ] **T.5.** Per-phase golden test set (e.g. CFO evals, lesson quizzes)
- [ ] **T.6.** Manual smoke checklist per route (see CHECKLIST.md if created)

---

# Commit Discipline

- One checkbox = one commit. Example:
  ```
  feat(cfo): add getPnL Groq tool schema (3A.2)
  ```
- Use prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- Reference the checkbox ID in the commit body, e.g.
  `Refs: ROADMAP.md#3A.2`
- Keep commits < 300 lines diff where possible

---

# How to Resume

If you stop and come back later:
1. Open `ROADMAP.md`
2. Find the first unchecked `[ ]` under the phase you're returning to
3. The checkbox ID (e.g. `3B.3`) maps to exactly one piece of work
4. Check off + commit when done

---

_Last updated: Phase 12 (12.1–12.6) completed 2026-07-16, commits `78dfa8d` `9077a94` `484ec8b` `24dae7f` `5cea40e`. Phase 10 scoped for a future session._