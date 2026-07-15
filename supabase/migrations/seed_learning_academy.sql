-- Migration: seed_learning_academy.sql
-- Purpose: 4A.5 + 4A.6 from ROADMAP.md — seed the Learning Academy with
--          4 pillars and 14 lessons (the roadmap lists 12 but includes
--          4 financial-literacy ones; we ship all of them).
--
-- Re-runnable: every INSERT uses fixed UUIDs + ON CONFLICT (slug)
-- DO NOTHING. Running this twice is a no-op.
--
-- Stable UUIDs make lesson_resources seedable in the same file and
-- let future authors reference these rows in code without joins by id.

-- ─────────────────────────────────────────────────────────────────────
-- SELF-HEAL: fix typos in previously-seeded lesson UUIDs.
--
-- The first version of this seed shipped with three rows that had
-- the wrong trailing digit in the lesson id (e.g. the AR-aging lesson
-- got id ...0001 instead of ...0004). The lessons themselves were
-- inserted fine; the typo only surfaced when lesson_resources tried
-- to reference them by id and failed the FK check.
--
-- On a fresh DB none of the UPDATEs below will match any rows, so
-- this block is a no-op. On a DB that was seeded by the buggy
-- version, it migrates the rows to the correct UUIDs so the FK
-- constraints downstream resolve cleanly.
-- ─────────────────────────────────────────────────────────────────────

-- AR aging lesson: was inserted as ...1004.../0001, should be ...0004
UPDATE lessons
  SET id = 'a1b2c3d4-1004-4000-a000-000000000004'::uuid
  WHERE id = 'a1b2c3d4-1004-4000-a000-000000000001'::uuid
    AND slug = 'accounts-receivable-aging';

-- Hiring lesson: was inserted as ...3004.../0003, should be ...0004
UPDATE lessons
  SET id = 'a1b2c3d4-3004-4000-a000-000000000004'::uuid
  WHERE id = 'a1b2c3d4-3004-4000-a000-000000000003'::uuid
    AND slug = 'hiring-trigger-formula';

-- Cash-flow lesson: was inserted correctly as ...1002/0002. The
-- lesson_resources row for it, however, had a typo (...1002/0001)
-- that didn't match any lesson. There's no row to migrate here
-- because the resources INSERT never committed; the seed will
-- re-insert it with the correct UUID on this run.

-- ─────────────────────────────────────────────────────────────────────
-- PILLARS
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO pillars (id, slug, name, description, icon, color, display_order) VALUES
  (
    'a1b2c3d4-0001-4000-a000-000000000001',
    'financial-literacy',
    'Financial Literacy',
    'Numbers-first lessons for understanding margins, cash flow, working capital, and receivables — the language every owner should speak.',
    'BookOpen',
    'tactical-blue',
    1
  ),
  (
    'a1b2c3d4-0002-4000-a000-000000000002',
    'diversification',
    'Diversification',
    'Reduce single-point-of-failure risk in your product mix, your suppliers, and your revenue streams.',
    'Layers',
    'tactical-neon',
    2
  ),
  (
    'a1b2c3d4-0003-4000-a000-000000000003',
    'business-management',
    'Business Management',
    'Pricing, inventory turnover, unit economics, and the hiring trigger — practical heuristics for a small retail business.',
    'Briefcase',
    'tactical-orange',
    3
  ),
  (
    'a1b2c3d4-0004-4000-a000-000000000004',
    'operations-scaling',
    'Operations & Scaling',
    'SOPs, fraud prevention, daily reconciliation — the boring work that compounds into a business that runs without you.',
    'Settings',
    'tactical-purple',
    4
  )
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- LESSONS
--
-- Each lesson body is plain markdown. The reader renders it with a
-- small renderer that supports headings, paragraphs, lists, **bold**,
-- *italic*, and [text](url) links. Nothing fancier.
-- ─────────────────────────────────────────────────────────────────────

-- ── Financial Literacy ──────────────────────────────────────────────

INSERT INTO lessons (id, pillar_id, slug, title, body_md, est_minutes, display_order, requires_data) VALUES
  (
    'a1b2c3d4-1001-4000-a000-000000000001',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'what-is-gross-margin',
    'What is Gross Margin?',
    E'# What is Gross Margin?\n\n**Gross margin** is the percentage of each sale that survives after paying for the product itself, before rent, salaries, or any other expense.\n\n## The formula\n\n```\ngross_margin = (selling_price − cost_price) ÷ selling_price × 100\n```\n\nA product you buy for K60 and sell for K100 has a 40% gross margin.\n\n## What''s a healthy margin?\n\nIt depends on what you sell, but rough rules:\n\n- **Grocery / fast-moving retail**: 15–25%\n- **Specialty retail** (electronics, beauty): 25–40%\n- **Fashion / branded**: 40–60%\n- **Services**: 50%+\n\nIf your blended margin is under 15%, the business is fragile — one bad month of expenses and you''re in the red.\n\n## Apply to your business\n\nOpen the **Profitability** page. Your *blended margin* is the overall number to watch. Any product whose margin is *red* is a candidate for either:\n\n- A price increase (the lowest-risk move — try K5 more, see if volume holds)\n- A different supplier (cheaper cost basis)\n- Stopping (if both fail, the product is costing you money to keep on the shelf)\n\n> **One number to remember:** gross margin tells you whether your prices are right. It does not tell you whether your business is profitable. Operating expenses come off the top — that''s the *net* margin.',
    5,
    1,
    ARRAY['sales','profitability']
  ),
  (
    'a1b2c3d4-1002-4000-a000-000000000002',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'cash-flow-vs-profit',
    'Cash Flow vs Profit',
    E'# Cash Flow vs Profit\n\nA profitable business can run out of cash. A cash-rich business can be unprofitable. The two are not the same thing.\n\n## The distinction\n\n- **Profit** = revenue − expenses (accrual accounting; counts what you *owe*, not what''s hit your account)\n- **Cash flow** = money actually moving in and out (what''s in your till and bank account right now)\n\nA pay-slow sale is *profitable* the moment you make it (you''ve earned the revenue) but it''s not *cash* until the client pays. That gap is where most small businesses die.\n\n## Why this matters for you\n\nThe dashboard''s **Ground Truth** number is your real cash flow: *paid sales − expenses*. It ignores unpaid installments on purpose.\n\nThe **In Pipeline** number is profit you''ve earned but haven''t received yet. It''s an *asset* on paper but it''s not in your pocket until it''s collected.\n\n## Apply to your business\n\n1. If **In Pipeline** keeps growing while **Ground Truth** stays flat, your collection is too slow. Push the Debts page hard.\n2. If **Ground Truth** is positive but your till feels empty at the end of the month, your *timing* of expenses is the problem (you pay big bills before slow installments come in). Stagger supplier payments where you can.\n3. Never spend money you haven''t received. Sounds obvious — but a sales spike can trick you into over-ordering inventory, leaving you short when the next slow month hits.\n\n> **Rule of thumb:** if your In Pipeline is more than 3× your monthly revenue, your cash flow is at risk regardless of how profitable the business looks on paper.',
    6,
    2,
    ARRAY['sales','journal']
  ),
  (
    'a1b2c3d4-1003-4000-a000-000000000003',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'working-capital-cash-buffer',
    'Working Capital & Cash Buffer',
    E'# Working Capital & Cash Buffer\n\n**Working capital** is the money you have available to *run* the business day-to-day — cash in the till, money in the bank, minus what you owe suppliers soon.\n\n## The two numbers to track\n\n1. **Cash on hand** = Cash + Mobile Money + Bank (the AI CFO shows you this directly)\n2. **Monthly operating expenses** = what you pay out in a normal month (rent, salaries, transport, utilities, etc.)\n\nThe ratio tells you your **runway** — how many months you could keep operating if revenue dropped to zero.\n\n## Healthy benchmarks\n\n- **< 1 month runway**: danger zone. One bad week and you can''t make payroll.\n- **1–3 months**: functional for most small retail businesses.\n- **3–6 months**: comfortable.\n- **> 6 months**: probably too much idle cash — consider investing in stock or paying down supplier debt early.\n\nFor a small business in Zambia, **2–3 months is a realistic target**. Anything less is risky; anything more might mean you''re under-investing in growth.\n\n## Apply to your business\n\nAsk the AI CFO: *"How much cash do I have and what''s my runway?"*\n\nThen divide by your typical monthly expenses. If the answer is under 1 month, your first priority is *not* growth — it''s collecting receivables and cutting discretionary spend until the buffer is back above 2 months.\n\n> **One number to remember:** runway in months = cash on hand ÷ monthly operating expenses. Keep it above 2.',
    5,
    3,
    ARRAY['journal','expenses']
  ),
  (
    'a1b2c3d4-1004-4000-a000-000000000004',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'accounts-receivable-aging',
    'Accounts Receivable Aging',
    E'# Accounts Receivable Aging\n\n**Aging** is how late an unpaid invoice is. It''s the single most useful lens on your *In Pipeline* number.\n\n## The five buckets\n\nAging reports split unpaid installments into:\n\n1. **Current** — not yet due. These are fine; ignore them for now.\n2. **0–30 days overdue** — your polite follow-up window. WhatsApp a friendly reminder.\n3. **31–60 days overdue** — second reminder, firmer tone. Suggest a payment plan if cash is tight for them.\n4. **61–90 days overdue** — escalation. Call them. Stop future pay-slow sales to this client until they clear the balance.\n5. **90+ days overdue** — write-off territory. The probability of collecting drops sharply past 90 days. Decide: keep chasing, or accept it as a loss and tighten your terms going forward.\n\n## The math behind it\n\nMoney that''s 90+ days late is usually worth 50 cents on the Kwacha in your pocket. Money 30 days late is worth 90 cents. The longer you wait, the more it costs you in real economic terms.\n\n## Apply to your business\n\nOpen the **Debts** page. The aging breakdown is already there. Sort the list by oldest first.\n\n- If your **90+ bucket is more than 20%** of total overdue, your terms are too loose. Require a 50% deposit on future pay-slow sales for any client who has been in the 90+ bucket.\n- If your **current bucket is more than 70%**, you''re doing fine. Keep it up.\n- If your **31–60 bucket** is the largest, your reminders are landing but not converting to payment. The message is wrong — try a phone call instead of WhatsApp.\n\n> **Rule of thumb:** if 1 in 4 overdue installments is more than 60 days late, your collection process has a gap. Find it and fix it before you grow the business further.',
    7,
    4,
    ARRAY['debts']
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Diversification ─────────────────────────────────────────────────

INSERT INTO lessons (id, pillar_id, slug, title, body_md, est_minutes, display_order, requires_data) VALUES
  (
    'a1b2c3d4-2001-4000-a000-000000000001',
    'a1b2c3d4-0002-4000-a000-000000000002',
    'product-mix-concentration',
    'Product Mix Concentration Risk',
    E'# Product Mix Concentration Risk\n\nIf half your revenue comes from three products, you don''t have a business — you have three bets.\n\n## Why concentration is dangerous\n\nA single supply chain disruption (supplier raises price, shipping delay, currency shock) can wipe out your best month. The more concentrated your revenue, the more exposed you are.\n\n## The threshold\n\n- **< 30% from top 3 products**: healthy, diversified\n- **30–50% from top 3 products**: watch closely, plan to broaden\n- **> 50% from top 3 products**: fragile. One bad week can sink a month.\n\n## Apply to your business\n\nAsk the AI CFO: *"Which products are my top sellers and what % of revenue do they represent?"*\n\nIf the answer is over 50%, you need a **deliberate broadening plan**:\n\n1. Identify 5–10 *adjacent* products you could stock with minimal new investment (similar suppliers, similar shelf space).\n2. Give them prime placement for 4 weeks. Measure which ones start to move.\n3. Double down on the winners. Drop the ones that didn''t.\n\nThe goal isn''t to abandon your top sellers — they''re top sellers for a reason. The goal is to make sure a *single* product''s failure can''t take down the whole business.\n\n> **One number to remember:** top-3 revenue share. Aim to keep it under 50%.',
    5,
    1,
    ARRAY['sales']
  ),
  (
    'a1b2c3d4-2002-4000-a000-000000000002',
    'a1b2c3d4-0002-4000-a000-000000000002',
    'supplier-concentration',
    'Supplier Concentration Risk',
    E'# Supplier Concentration Risk\n\nConcentration risk on the *sell* side is well-known. Concentration on the *buy* side is just as dangerous and less discussed.\n\n## What it looks like\n\nIf more than half your inventory comes from one supplier, you''re exposed to:\n\n- A price hike you can''t avoid\n- A stock-out that empties your shelves\n- A quality problem that ruins your reputation\n- A relationship breakdown (the owner moves on, the terms change)\n\n## The rule of three\n\nFor any product category, try to have at least **three** viable suppliers. You don''t have to use all three — you just have to be able to.\n\n- **Three real suppliers** = you can switch in 2 weeks if needed\n- **Two suppliers** = workable, but keep an eye on the relationship\n- **One supplier** = single point of failure. Don''t let this be true for any category that''s more than 20% of your revenue.\n\n## Apply to your business\n\nOpen the **Import Simulator** page. Sort your recent import records by supplier and count the percentage of volume each one represents.\n\nFor any category above 50% from one supplier:\n\n1. Identify one alternative supplier (even if you haven''t used them yet). Get a price quote and a lead time.\n2. Place a small trial order. Confirm they can actually deliver.\n3. From then on, keep them in your rotation at maybe 10–20% of volume — enough to keep the relationship warm.\n\nDiversification isn''t about splitting evenly. It''s about having options when things go wrong.\n\n> **One number to remember:** the largest supplier''s share of any critical category. Aim to keep it under 60%.',
    6,
    2,
    ARRAY['inventory']
  ),
  (
    'a1b2c3d4-2003-4000-a000-000000000003',
    'a1b2c3d4-0002-4000-a000-000000000002',
    'revenue-stream-diversification',
    'Revenue Stream Diversification',
    E'# Revenue Stream Diversification\n\nYou probably sell in two places: at the counter (POS) and online (catalog). Adding even one more channel can dramatically reduce your risk.\n\n## What counts as a revenue stream\n\nA "stream" is a distinct *way* of getting paid, not just a *place* to sell. Two stores selling the same product on the same terms is one stream. Counter sales + wholesale orders to other shops is two streams.\n\n## Common streams for a small retail business in Zambia\n\n- **Direct retail** (POS) — your default\n- **Online catalog** (WhatsApp orders) — what you already have\n- **Wholesale / B2B** — selling to other retailers in bulk at a discount\n- **Custom orders / services** — special orders, gift wrapping, delivery\n- **Subscription / repeat** — e.g. office supplies delivered weekly to a corporate client\n- **Consignment** — placing your stock in someone else''s shop, splitting the margin\n\nYou don''t need all of these. You need **two** of them, working, so that if one slows down, the other can carry you.\n\n## Apply to your business\n\nLook at your sales this month. What % came from your POS versus the catalog? If one is above 80%, you''re one channel away from trouble.\n\nThe cheapest second channel to add is usually **wholesale**:\n\n1. Pick your best-moving product with the highest margin.\n2. Approach 2–3 small shops in nearby areas. Offer them a 15–20% wholesale discount if they buy 5+ units upfront.\n3. Track the orders. If it sticks, it''s a real new stream.\n\n> **One number to remember:** % of revenue from your largest single stream. Aim to keep it under 70%.',
    6,
    3,
    ARRAY['sales']
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Business Management ─────────────────────────────────────────────

INSERT INTO lessons (id, pillar_id, slug, title, body_md, est_minutes, display_order, requires_data) VALUES
  (
    'a1b2c3d4-3001-4000-a000-000000000001',
    'a1b2c3d4-0003-4000-a000-000000000003',
    'pricing-psychology-margin-tiers',
    'Pricing Psychology & Margin Tiers',
    E'# Pricing Psychology & Margin Tiers\n\nMost customers don''t pick the cheapest option. They pick the option that *feels right* — and pricing is one of the strongest signals you send.\n\n## The Goldilocks effect\n\nIf you show three options — a high anchor, a mid-value, and a low-budget — most people will pick the middle. Not because it''s the best, but because it feels safe.\n\nThis is why every restaurant menu, phone plan, and SaaS pricing page has three tiers. Two tiers forces a binary choice; three or more lets the customer *sort themselves*.\n\n## Practical implications for a retail business\n\n- **Don''t compete on price at the bottom.** The race to the bottom has no winners — there''s always someone cheaper.\n- **Anchor high.** A few premium products in each category make the mid-tier look reasonable.\n- **Round numbers, sometimes.** K99 looks cheaper than K100 to the eye (yes, really), but K1,200 looks more "premium" than K1,195. Use the right one for the tier.\n- **Bundle for value perception.** "Two for K180" feels like a deal even if the unit price is the same as K95 each.\n\n## Apply to your business\n\nLook at your product grid. In each category, do you have:\n\n1. A **budget** option (cheapest, lower margin, attracts foot traffic)\n2. A **value** option (your sweet spot — best margin, most sales)\n3. A **premium** option (highest absolute margin, signals quality)\n\nIf a category only has one or two options, you''re missing the anchor and the price psychology breaks down. Adding a third option is often the cheapest margin improvement you can make.\n\n> **Rule of thumb:** never let a category have fewer than three price points if you can help it.',
    5,
    1,
    ARRAY['inventory','sales']
  ),
  (
    'a1b2c3d4-3002-4000-a000-000000000002',
    'a1b2c3d4-0003-4000-a000-000000000003',
    'inventory-turnover-dead-stock',
    'Inventory Turnover & Dead Stock',
    E'# Inventory Turnover & Dead Stock\n\nEvery Kwacha tied up in stock is a Kwacha you can''t spend on something else. The faster you turn inventory, the healthier your business — even if the per-unit margin is lower.\n\n## Inventory turnover\n\nThe metric is simple:\n\n```\nturnover = cost of goods sold (last 12 months) ÷ average inventory value\n```\n\nIf you sold K1,200,000 of product in a year and your average inventory was worth K300,000, your turnover is 4×. That means you sold through your entire stock 4 times in the year — every 3 months on average.\n\n## Healthy benchmarks\n\n- **< 2×**: cash is locked up. You''re carrying too much.\n- **2–4×**: functional for general retail.\n- **4–6×**: healthy for fast-moving goods.\n- **> 6×**: either you''re under-stocked (lost sales) or you''re in a very high-velocity category.\n\n## Dead stock\n\nDead stock = items that haven''t sold in 90+ days. It''s expensive in three ways:\n\n1. The cash is locked up and earning nothing\n2. The shelf space could be used for something that does sell\n3. The longer it sits, the more outdated it gets\n\n## Apply to your business\n\nAsk the AI CFO: *"Which products are dead stock I should discount?"*\n\nFor each item in the result, pick one of three actions:\n\n- **Discount** — clear it out at 20–40% off. Better to recover half than carry it forever.\n- **Bundle** — pair it with a fast-mover at a small bundle discount.\n- **Drop** — return to supplier if possible, donate, or write off.\n\n> **One number to remember:** % of inventory value that hasn''t sold in 90+ days. Aim to keep it under 10%.',
    6,
    2,
    ARRAY['inventory','sales']
  ),
  (
    'a1b2c3d4-3003-4000-a000-000000000003',
    'a1b2c3d4-0003-4000-a000-000000000003',
    'unit-economics-per-product',
    'Unit Economics per Product',
    E'# Unit Economics per Product\n\nA product with 60% margin can still be unprofitable if it eats staff time, requires special handling, or comes back as returns. **Unit economics** is the full per-unit picture, not just the markup.\n\n## The basic per-unit math\n\nFor one unit sold:\n\n```\nrevenue          = selling_price\ncost of goods    = cost_price\nfulfilment cost  = packaging + delivery + time\nallocation       = (rent + salaries) ÷ units sold (rough)\nreturn reserve   = historical return rate × selling_price\n─────────────────────────────────────────\nunit profit      = revenue − all of the above\n```\n\nThe hard part is the middle rows — fulfilment and allocation. Most small businesses skip them and then wonder why their "profitable" product doesn''t generate cash.\n\n## Why this matters\n\nTwo products with the same margin can have very different unit economics:\n\n- A K100 product with 40% margin and zero returns: profitable, simple.\n- A K100 product with 40% margin that requires 30 minutes of staff time, special packaging, and has 15% returns: not profitable once you account for the time and the return rate.\n\n## Apply to your business\n\nOpen the **Profitability** page. Sort by *profit* (not margin). Products that look great on margin but rank low on profit are the ones with hidden unit-economics costs.\n\nFor your top 5 products, ask yourself:\n\n1. How long does it take to sell + fulfil one unit?\n2. What''s the return rate? (If you don''t track this, start.)\n3. Does it require any special handling?\n\nYou don''t need perfect numbers — even rough estimates will move the needle. The point is to make pricing decisions based on the *full* picture, not just the headline margin.\n\n> **One number to remember:** profit per unit, not margin per unit. The two diverge as soon as you factor in time and returns.',
    7,
    3,
    ARRAY['sales','profitability']
  ),
  (
    'a1b2c3d4-3004-4000-a000-000000000004',
    'a1b2c3d4-0003-4000-a000-000000000003',
    'hiring-trigger-formula',
    'The Hiring Trigger Formula',
    E'# The Hiring Trigger Formula\n\nHiring too early burns cash. Hiring too late loses sales and burns out your team. The right answer isn''t a feeling — it''s a formula.\n\n## When NOT to hire\n\n- "I''m busy" alone is not a reason. You''re supposed to be busy.\n- "I need help" is also not a reason. Most businesses can stretch a bit further.\n\n## The real trigger\n\nA new hire makes sense when **revenue per existing employee is dropping** while **revenue per customer is holding steady or growing**. That means your team is overloaded, not that you''re growing.\n\nConcretely:\n\n1. Track monthly revenue and team headcount.\n2. Compute `revenue_per_employee = monthly_revenue ÷ headcount`.\n3. If it''s been falling for 3+ months, and customers are complaining about wait time or quality — *then* hire.\n\n## What to hire for\n\nDon''t hire a generic "helper". Hire for a specific bottleneck:\n\n- The person who handles supplier negotiations (so the owner can stop)\n- The cashier (so the cashier can take a day off)\n- The person who manages online orders (so the catalog can grow)\n\nEach hire should free the *next-most-expensive constraint* in your business. The owner is usually the most expensive constraint — every hour the owner spends on a low-leverage task is an hour not spent on growth.\n\n## Apply to your business\n\nCompute your own `revenue_per_employee` for the last 3 months. If it''s falling, identify the single bottleneck a new hire would relieve. That''s the role to fill.\n\n> **Rule of thumb:** hire to *remove* the next constraint, not to feel less busy.',
    5,
    4,
    ARRAY['sales']
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Operations & Scaling ────────────────────────────────────────────

INSERT INTO lessons (id, pillar_id, slug, title, body_md, est_minutes, display_order, requires_data) VALUES
  (
    'a1b2c3d4-4001-4000-a000-000000000001',
    'a1b2c3d4-0004-4000-a000-000000000004',
    'one-page-sop',
    'Writing a One-Page SOP',
    E'# Writing a One-Page SOP\n\nA **Standard Operating Procedure (SOP)** is a one-page document that explains how to do a recurring task well enough that someone who has never done it before can do it correctly.\n\n## The test\n\nIf a stranger can read your SOP and execute the task without asking you a single question, it''s good. If they have to call you for clarification, it''s not finished.\n\n## What to include\n\n1. **Trigger** — when does this task happen? Daily? On every sale? When X happens?\n2. **Inputs** — what do you need before you start? (Tool, account, password, form)\n3. **Steps** — 3 to 10 numbered steps, plain English, one verb per step\n4. **Outputs** — what should exist when you''re done? (A receipt, a logged entry, a sent message)\n5. **What to do if it goes wrong** — common failure modes + the right response\n\n## The one-page constraint\n\nIf your SOP is longer than one page, you''re explaining too much. Break it into smaller SOPs, or trust the person doing the task to use judgment on the edges.\n\n## Apply to your business\n\nPick the task that''s caused you the most pain this month. Write the SOP for it. Hand it to a friend or family member who knows nothing about your business. If they can do the task from the SOP alone, ship it.\n\nThe best candidates for first SOPs:\n\n- Opening the till in the morning\n- Closing the till + reconciliation at night\n- Receiving a delivery (count, inspect, log, shelve)\n- Responding to a pay-slow overdue (the WhatsApp message template + follow-up cadence)\n\n> **One sentence to remember:** if it''s worth doing twice, it''s worth a one-page SOP.',
    5,
    1,
    ARRAY[]::TEXT[]
  ),
  (
    'a1b2c3d4-4002-4000-a000-000000000002',
    'a1b2c3d4-0004-4000-a000-000000000004',
    'fraud-prevention-basics',
    'Fraud Prevention Basics',
    E'# Fraud Prevention Basics\n\nFraud in a small business is rarely a stranger breaking in. It''s a *small* discrepancy repeated over time, by someone who has access and trust. Prevention is mostly about making those small discrepancies visible.\n\n## The four most common fraud types\n\n1. **Cash skimming** — sales recorded as voided or no-sale, money pocketed. The till reconciles to the system but the actual cash is short.\n2. **Inventory shrinkage** — items walk out. Could be staff, could be customers, could be damage that wasn''t logged.\n3. **Supplier kickbacks** — the buyer picks the supplier who pays them a personal commission, not the one with the best price.\n4. **Fake expenses** — receipts for things that didn''t happen. Common in businesses where the owner doesn''t look at every expense line.\n\n## The defenses\n\n- **Cash handling**: no single person counts the till alone at end of day. Two-person rule, every day. Discrepancies logged even when small.\n- **Inventory**: monthly physical count compared to system. Variance of more than 2% is a red flag worth investigating.\n- **Suppliers**: rotate who does the buying if you can. Always get two quotes for any purchase over a threshold. The 2-quote rule alone kills most kickback schemes.\n- **Expenses**: review the expense list weekly. Even a 30-second scan catches obvious fakes.\n\n## Apply to your business\n\nPick the highest-risk area based on where the *most money* or *most cash* flows. That''s where to start your defenses.\n\nFor most small retail businesses, the answer is **cash handling** — that''s where the largest single fraud usually happens.\n\n> **Rule of thumb:** if you can''t reconcile something in 5 minutes, the system is broken. Fix the system, not the person.',
    7,
    2,
    ARRAY[]::TEXT[]
  ),
  (
    'a1b2c3d4-4003-4000-a000-000000000003',
    'a1b2c3d4-0004-4000-a000-000000000004',
    'cash-drawer-reconciliation',
    'Cash Drawer Reconciliation',
    E'# Cash Drawer Reconciliation\n\nCash drawer reconciliation is the 5-minute habit that prevents the 5-figure surprise. Do it every day, no exceptions.\n\n## The daily routine\n\nAt end of day (or shift):\n\n1. **Count the cash** in the drawer. Note the breakdown by denomination — don''t just count the total.\n2. **Get the system total** — the sum of cash sales recorded by the POS for the day.\n3. **Subtract the float** — the starting cash you put in the drawer at the beginning of the day.\n4. **Compare**: counted cash vs system cash. The difference is the *variance*.\n\n## What the variance tells you\n\n- **K0–K20 variance**: normal. Rounding errors, give/take, customers paying with small change that gets handed back. No investigation needed.\n- **K20–K100 variance**: investigate before the next shift. Common causes: miscounted change, missed sales, voided transactions. Talk to the person who closed.\n- **> K100 variance**: stop, investigate now. Look at the void log, the no-sale log, and the transaction history for the day. If the explanation doesn''t add up, escalate.\n\n## The point of doing it daily\n\nIf you reconcile weekly or monthly, you can''t pinpoint when the variance happened. Daily reconciliation makes the variance *attributable* — you know it happened on Tuesday, not "sometime this month".\n\nAttributability is what makes the conversation with your staff possible. Without it, "we''re K500 short this month" is a mystery. With it, "we''re K120 short on Tuesday, here''s the void log" is a fact.\n\n## Apply to your business\n\nIf you''re not reconciling daily, start tomorrow. The first week will be slightly painful as you find old discrepancies — that''s normal. By week three it''s a 5-minute habit and the variance is usually under K20.\n\n> **One number to remember:** daily variance. Aim for under K20. Anything over K100, investigate same day.',
    5,
    3,
    ARRAY['sales']
  )
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- LESSON RESOURCES
--
-- A few hand-picked "Apply to your business" links for the most
-- actionable lessons. The 4C.3 lesson reader will render these as
-- a button list at the bottom of the lesson body.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO lesson_resources (id, lesson_id, label, href, kind, display_order) VALUES
  -- Gross margin → Profitability page
  ('a1b2c3d4-9001-4000-a000-000000000001', 'a1b2c3d4-1001-4000-a000-000000000001',
   'Open the Profitability page', '/profitability', 'internal', 1),
  -- Cash flow vs profit → AI CFO
  ('a1b2c3d4-9002-4000-a000-000000000002', 'a1b2c3d4-1002-4000-a000-000000000002',
   'Ask the AI CFO about runway', '/cfo?prefill=How%20much%20cash%20do%20I%20have%20right%20now%2C%20and%20what%20is%20my%20runway%20in%20months%3F', 'internal', 1),
  -- Working capital → AI CFO
  ('a1b2c3d4-9003-4000-a000-000000000003', 'a1b2c3d4-1003-4000-a000-000000000003',
   'Ask the AI CFO about cash + runway', '/cfo?prefill=How%20much%20cash%20do%20I%20have%20right%20now%2C%20and%20what%20is%20my%20runway%20in%20months%3F', 'internal', 1),
  -- AR aging → Debts page
  ('a1b2c3d4-9004-4000-a000-000000000004', 'a1b2c3d4-1004-4000-a000-000000000004',
   'Open the Debts page', '/debts', 'internal', 1),
  -- Product mix → AI CFO
  ('a1b2c3d4-9005-4000-a000-000000000005', 'a1b2c3d4-2001-4000-a000-000000000001',
   'Ask the AI CFO about top sellers', '/cfo?prefill=Which%20products%20are%20my%20top%20sellers%20this%20month%2C%20and%20what%20%25%20of%20my%20revenue%20do%20they%20represent%3F', 'internal', 1),
  -- Dead stock → AI CFO
  ('a1b2c3d4-9006-4000-a000-000000000006', 'a1b2c3d4-3002-4000-a000-000000000002',
   'Ask the AI CFO about dead stock', '/cfo?prefill=Which%20products%20are%20dead%20stock%20I%20should%20discount%3F', 'internal', 1),
  -- Unit economics → Profitability
  ('a1b2c3d4-9007-4000-a000-000000000007', 'a1b2c3d4-3003-4000-a000-000000000003',
   'Open the Profitability page', '/profitability', 'internal', 1),
  -- Hiring → AI CFO
  ('a1b2c3d4-9008-4000-a000-000000000008', 'a1b2c3d4-3004-4000-a000-000000000004',
   'Ask the AI CFO about revenue trends', '/cfo?prefill=What%20is%20my%20revenue%20trend%20over%20the%20last%203%20months%2C%20and%20is%20revenue-per-employee%20dropping%3F', 'internal', 1)
ON CONFLICT (id) DO NOTHING;
