# CFO Copilot — Eval Set (3C.1)

A hand-crafted set of 10 test questions for the AI CFO Copilot. Each entry
records the question, which tools the model is *expected* to call, and what
a "good" answer looks like.

Use these as a regression suite when you change the system prompt, the
tool schemas, or the engine. They're also useful as a demo set: clicking
through all 10 in a fresh database exercises every tool at least twice.

## How to run an eval

1. Open the CFO chat (`/cfo`).
2. Paste the question verbatim.
3. Inspect the response and the "Based on N tool calls" disclosure.

There is no automated runner yet — these are designed for human review.
A scripted runner is the obvious next step (Phase 4 or later); until
then, treat this file as the spec for what the engine should be able to
answer.

## Conventions

- **Difficulty**: `easy` (single tool, unambiguous), `medium` (single tool,
  requires interpretation), `hard` (multi-tool or adversarial).
- **Required tools**: at least one. Order doesn't matter — Groq supports
  parallel tool calls.
- **Good answer**: a short, specific, numbers-first response that
  references the tool result directly.
- **Bad answer**: vague, hand-wavy, or refuses to call tools.

---

## E1 — Net profit this month

**Question:** "What's my net profit this month?"

**Difficulty:** easy
**Required tools:** `get_pnl(preset='month')`
**Good answer:** Includes revenue, cost of goods sold, gross profit,
  operating expenses, and net profit — at minimum the net profit
  number with the matching currency format (K…).
**Bad answer:** "Your business is doing well" with no numbers, or
  only one of the five components (e.g. just revenue).

---

## E2 — Top sellers this month

**Question:** "Which products are my top sellers this month?"

**Difficulty:** easy
**Required tools:** `get_top_products(preset='month', limit=5)`
**Good answer:** A list of up to 5 products with name, units sold,
  and at least one of {revenue, profit, margin}. Rank-ordered.
**Bad answer:** "Your top product is X" with no other context, or
  a list that ignores profit and only ranks by units.

---

## E3 — Cash on hand right now

**Question:** "How much cash do I have right now?"

**Difficulty:** easy
**Required tools:** `get_cash_position()`
**Good answer:** Total cash, broken down by account (Cash on Hand /
  Mobile Money / Bank). Optional: AR + AP for working-capital context.
**Bad answer:** Only the total, or only one account ("you have K5,000
  in the bank" when the question asked for everything).

---

## E4 — Who owes me the most

**Question:** "Who owes me the most, and how overdue is it?"

**Difficulty:** medium
**Required tools:** `get_aging_debts()`
**Good answer:** Aging buckets (current / 0-30 / 31-60 / 61-90 / 90+)
  with totals, plus the oldest-overdue-days number, plus a
  recommendation (e.g. "focus collection on the 90+ bucket").
**Bad answer:** Vague "some clients owe you money" without a
  breakdown, or no actionable next step.

---

## E5 — Biggest expenses this year

**Question:** "What are my biggest expense categories this year?"

**Difficulty:** medium
**Required tools:** `get_pnl(preset='year')`
**Good answer:** Top 3-5 expense accounts (by amount) with their
  category names (Rent, Utilities, Salaries, etc.) and amounts.
**Bad answer:** A generic "your biggest expense is rent" with no
  comparison to other categories, or the full P&L dumped verbatim
  without ranking.

---

## E6 — Dead stock

**Question:** "Which products are dead stock I should discount?"

**Difficulty:** medium
**Required tools:** `get_slow_moving_stock(limit=10)`
**Good answer:** A short list of products with `daysSinceLastSale` and
  `stockValueAtCost` so the owner can prioritize. Hint: discount the
  ones with the highest stock value AND longest stagnation first.
**Bad answer:** Listing all products sorted by some other metric, or
  using the word "dead" loosely (e.g. including 7-day-old stock).

---

## E7 — Are the books balanced?

**Question:** "Are my books balanced?"

**Difficulty:** easy
**Required tools:** `get_trial_balance(preset='all')`
**Good answer:** A yes/no with the totals: "Total debits = total
  credits = K… — books are balanced." Or: "Out of balance by K…
  — investigate the X account."
**Bad answer:** Just "yes" without showing the totals, or refusing
  to call the trial_balance tool.

---

## E8 — This month vs all time

**Question:** "How am I doing this month vs all time?"

**Difficulty:** hard
**Required tools:** `get_pnl(preset='month')` + `get_pnl(preset='all')`
  in parallel.
**Good answer:** A comparison: this month's net profit, the all-time
  average monthly net profit, and a qualitative read ("ahead" /
  "behind" / "on par"). Should reference both windows explicitly.
**Bad answer:** Returning only one of the two periods, or a single
  number that doesn't actually compare anything.

---

## E9 — Overdue amount

**Question:** "How much money is overdue right now?"

**Difficulty:** medium
**Required tools:** `get_aging_debts()`
**Good answer:** The sum of all *overdue* buckets (0-30, 31-60, 61-90,
  90+). Excludes the "current" bucket (not yet due). Should reference
  the bucket breakdown so the owner sees concentration in any single
  bucket (e.g. "K1,200 in the 90+ bucket — most of your overdue risk").
**Bad answer:** Including the "current" (not yet due) bucket and
  inflating the number, or returning only one bucket.

---

## E10 — Should I restock my best-seller?

**Question:** "Should I restock my best-selling product right now?"

**Difficulty:** hard
**Required tools:** `get_top_products(preset='month', limit=1)` +
  `get_slow_moving_stock(limit=5)` + `get_cash_position()`.
**Good answer:** Top product + current stock level + days-of-stock
  remaining (sales velocity) + current cash position + a clear
  recommendation ("yes, you can afford a restock of N units" or
  "no, cash is tight — defer"). Advisory only — must NOT recommend
  an irreversible action without flagging it.
**Bad answer:** Just naming the best-seller without stock or cash
  context, or skipping the recommendation entirely.

---

## Adding a new eval

Add a new section following the E## — Title format, with:

- **Question** (verbatim — no paraphrasing in tests)
- **Difficulty** (easy / medium / hard)
- **Required tools** (one or more)
- **Good answer** (what a successful response looks like)
- **Bad answer** (what a regression looks like)

Keep the total to 10-15 in this file. Anything bigger should move to a
dedicated `cfo-evals-extra.md` so the canonical set stays scannable.
