'use server';

/**
 * Phase 1: Accounting — Journal posting engine.
 *
 * Implements double-entry bookkeeping. Every sale, expense, and installment
 * payment posts one or more journal entries so that reports (P&L, Balance
 * Sheet, Trial Balance) can be generated directly from the ledger.
 *
 * Design notes
 * ------------
 * - A journal entry has 2+ lines; sum(debits) === sum(credits).
 * - Account codes are looked up via a tiny in-memory cache (one fetch per
 *   process) so we don't hit the DB on every sale.
 * - Posting is best-effort. If the journal write fails we log + continue,
 *   because the originating business operation (sale, expense) has already
 *   committed. Reports will simply be slightly stale until repaired.
 *   Phase 2 will add reconciliation tooling.
 */

import { requireAuth } from '@/lib/supabase-server';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
}

export interface JournalLineInput {
  /** Account code from the Chart of Accounts — e.g. '1000', '4000'. */
  accountCode: string;
  /** 'debit' or 'credit'. */
  entryType: 'debit' | 'credit';
  /** Always positive. */
  amount: number;
  memo?: string;
}

export interface PostJournalParams {
  description: string;
  /** Defaults to today. */
  entryDate?: string;
  /** Free-form reference — e.g. { type: 'sale', id: '...' }. */
  reference?: { type: string; id: string };
  lines: JournalLineInput[];
}

// ─────────────────────────────────────────────────────────────
// Account cache (per-request, in-memory)
// ─────────────────────────────────────────────────────────────

let _accountCache: Map<string, Account> | null = null;

async function getAccountByCode(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  code: string
): Promise<Account | null> {
  if (_accountCache && _accountCache.has(code)) return _accountCache.get(code)!;

  if (!_accountCache) {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name, type, subtype')
      .eq('is_active', true);
    _accountCache = new Map((data || []).map((a: Account) => [a.code, a]));
  }

  return _accountCache.get(code) || null;
}

/**
 * Clear the in-memory account cache. Exposed via journals-cache helper
 * (not from this 'use server' module directly — Next.js requires every
 * export to be async).
 */
export async function clearAccountCache() {
  _accountCache = null;
}

// ─────────────────────────────────────────────────────────────
// Core posting
// ─────────────────────────────────────────────────────────────

/**
 * Post a balanced journal entry. Returns the entry id, or an error.
 * Validates that total debits === total credits before writing.
 */
export async function postJournal({
  description,
  entryDate,
  reference,
  lines,
}: PostJournalParams): Promise<{ id?: string; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (!lines || lines.length < 2) {
    return { error: 'Journal entry must have at least 2 lines' };
  }

  // Resolve account codes → ids
  const resolved: Array<{
    account_id: string;
    entry_type: 'debit' | 'credit';
    amount: number;
    memo: string | null;
  }> = [];

  for (const line of lines) {
    const acct = await getAccountByCode(supabase, line.accountCode);
    if (!acct) return { error: `Unknown account code: ${line.accountCode}` };
    if (line.amount <= 0) return { error: `Line amount must be > 0 (account ${line.accountCode})` };
    resolved.push({
      account_id: acct.id,
      entry_type: line.entryType,
      amount: line.amount,
      memo: line.memo ?? null,
    });
  }

  // Validate debits === credits (within 1 cent rounding)
  const totalDebit  = resolved.filter(l => l.entry_type === 'debit').reduce((s, l) => s + l.amount, 0);
  const totalCredit = resolved.filter(l => l.entry_type === 'credit').reduce((s, l) => s + l.amount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Unbalanced entry: debits=${totalDebit}, credits=${totalCredit}` };
  }

  // Insert header
  const { data: header, error: headerError } = await supabase
    .from('journal_entries')
    .insert([{
      description,
      entry_date: entryDate || new Date().toISOString().split('T')[0],
      reference_type: reference?.type ?? null,
      reference_id: reference?.id ?? null,
      total_amount: totalDebit,
      created_by: userId,
    }])
    .select('id')
    .single();

  if (headerError || !header) {
    return { error: headerError?.message || 'Failed to create journal entry' };
  }

  // Insert lines
  const linesWithEntry = resolved.map(l => ({ ...l, journal_entry_id: header.id }));
  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert(linesWithEntry);

  if (linesError) {
    // Best-effort cleanup of the header
    await supabase.from('journal_entries').delete().eq('id', header.id);
    return { error: linesError.message };
  }

  // Audit log (best-effort)
  await supabase.from('audit_log').insert([{
    user_id: userId,
    action: 'journal.post',
    entity_type: 'journal_entry',
    entity_id: header.id,
    metadata: {
      description,
      total_amount: totalDebit,
      reference: reference ?? null,
      line_count: lines.length,
    },
  }]).then(() => {});

  return { id: header.id };
}

// ─────────────────────────────────────────────────────────────
// High-level posting helpers (domain-aware)
// ─────────────────────────────────────────────────────────────

/**
 * Posting for a sale.
 *
 * Cash sale:
 *   Dr. Cash on Hand (1000)         [payment amount]
 *   Cr. Sales Revenue (4000)        [payment amount]
 *
 * Pay-slow sale (full credit):
 *   Dr. Accounts Receivable (1200)   [total sale amount]
 *   Cr. Sales Revenue (4000)        [total sale amount]
 *
 * Hybrid (pay-slow with upfront):
 *   Dr. Cash on Hand (1000)         [upfront portion]
 *   Dr. Accounts Receivable (1200)  [remaining]
 *   Cr. Sales Revenue (4000)        [total]
 *
 * COGS side (always):
 *   Dr. Cost of Goods Sold (5000)   [sum(cost_price * qty)]
 *   Cr. Inventory (1300)            [sum(cost_price * qty)]
 */
export interface SalePostingInput {
  saleId: string;
  items: Array<{ productName: string; quantity: number; sellingPrice: number; costPrice: number }>;
  /** 0 means full pay-slow (credit sale). */
  upfrontPaid: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'pay-slow' | 'mobile_money' | 'bank' | 'card';
  clientName: string;
}

export async function postSaleJournal(input: SalePostingInput): Promise<{ id?: string; error?: string }> {
  // Map payment method to cash account code
  const cashAccountCode: Record<string, string> = {
    cash: '1000',
    mobile_money: '1010',
    bank: '1020',
    card: '1020',
  };
  const cashCode = cashAccountCode[input.paymentMethod] || '1000';

  const lines: JournalLineInput[] = [];

  // Receivable side
  const receivable = Math.max(0, input.totalAmount - input.upfrontPaid);
  if (input.upfrontPaid > 0) {
    lines.push({ accountCode: cashCode, entryType: 'debit', amount: input.upfrontPaid, memo: `Upfront from ${input.clientName}` });
  }
  if (receivable > 0) {
    lines.push({ accountCode: '1200', entryType: 'debit', amount: receivable, memo: `Pay-slow balance: ${input.clientName}` });
  }
  // Sales revenue (credit)
  lines.push({ accountCode: '4000', entryType: 'credit', amount: input.totalAmount, memo: 'Sales revenue' });

  // COGS side (debit COGS, credit inventory)
  const cogs = input.items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
  if (cogs > 0) {
    lines.push({ accountCode: '5000', entryType: 'debit',  amount: cogs, memo: 'Cost of goods sold' });
    lines.push({ accountCode: '1300', entryType: 'credit', amount: cogs, memo: 'Inventory reduction' });
  }

  return postJournal({
    description: `Sale to ${input.clientName}`,
    reference: { type: 'sale', id: input.saleId },
    lines,
  });
}

/**
 * Posting for an expense.
 *   Dr. <expense account based on category>   [amount]
 *   Cr. Cash on Hand (1000)                  [amount]
 *
 * Unknown categories fall back to 6090 General Expenses.
 */
export async function postExpenseJournal(input: {
  expenseId: string;
  amount: number;
  description: string;
  category: string;
}): Promise<{ id?: string; error?: string }> {
  const categoryToAccount: Record<string, string> = {
    rent:          '6000',
    utilities:     '6010',
    transport:     '6020',
    marketing:     '6030',
    salaries:      '6040',
    wages:         '6040',
    packaging:     '6050',
    airtime:       '6060',
    data:          '6060',
    shipping:      '7000',
    customs:       '7000',
    duties:        '7000',
    returns:       '7010',
    refunds:       '7010',
  };
  const key = input.category.toLowerCase().trim();
  const expenseAccount = categoryToAccount[key] || '6090';

  return postJournal({
    description: `Expense: ${input.description}`,
    reference: { type: 'expense', id: input.expenseId },
    lines: [
      { accountCode: expenseAccount, entryType: 'debit',  amount: input.amount, memo: input.description },
      { accountCode: '1000',          entryType: 'credit', amount: input.amount, memo: 'Paid from cash' },
    ],
  });
}

/**
 * Posting for an installment payment.
 *   Dr. Cash on Hand (1000)               [amount]
 *   Cr. Accounts Receivable (1200)        [amount]
 */
export async function postInstallmentPaymentJournal(input: {
  installmentId: string;
  amount: number;
  clientName: string;
  paymentMethod: 'cash' | 'mobile_money' | 'bank' | 'card';
}): Promise<{ id?: string; error?: string }> {
  const cashCode =
    input.paymentMethod === 'mobile_money' ? '1010' :
    input.paymentMethod === 'bank'         ? '1020' :
    input.paymentMethod === 'card'         ? '1020' : '1000';

  return postJournal({
    description: `Installment payment from ${input.clientName}`,
    reference: { type: 'installment_payment', id: input.installmentId },
    lines: [
      { accountCode: cashCode, entryType: 'debit',  amount: input.amount, memo: `Received from ${input.clientName}` },
      { accountCode: '1200',   entryType: 'credit', amount: input.amount, memo: 'Receivable reduction' },
    ],
  });
}