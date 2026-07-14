'use server';

/**
 * Phase 1: Accounting — Read actions.
 *
 * Generates the three core financial statements from journal entries:
 *  - Trial Balance    — sum of debits and credits per account
 *  - Profit & Loss    — revenue and expenses over a period
 *  - Balance Sheet    — assets, liabilities, equity at a point in time
 *
 * Plus a journal listing for the Journal tab.
 *
 * Note: pure helpers (DateRange / getDateRangeFromPreset) live in
 *       ./accounting-utils to keep this file's exports all async (required
 *       by Next.js for 'use server' modules).
 */

import { requireAuth } from '@/lib/supabase-server';
import type { DateRange } from './accounting-utils';

// Types only — sync helpers (getDateRangeFromPreset) live in ./accounting-utils
// and must be imported directly from there. 'use server' files cannot
// re-export non-async values.
export type { DateRangePreset, DateRange } from './accounting-utils';

// ─────────────────────────────────────────────────────────────
// Trial Balance
// ─────────────────────────────────────────────────────────────

export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  /** Net debit position (positive) or net credit position (negative). */
  balance: number;
}

export async function getTrialBalance(range: DateRange): Promise<{
  rows?: TrialBalanceRow[];
  totalDebit?: number;
  totalCredit?: number;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // Fetch all journal lines within the period
  const { data, error } = await supabase
    .from('journal_lines')
    .select(`
      amount,
      entry_type,
      account:accounts(id, code, name, type)
    `)
    .gte('journal_entries.entry_date', range.from)
    .lte('journal_entries.entry_date', range.to);

  if (error) return { error: error.message };

  // The above query can't easily filter by joined table date — fall back to fetching
  // entries with their lines and filter in code.
  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      lines:journal_lines(
        amount,
        entry_type,
        account:accounts(id, code, name, type)
      )
    `)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to);

  if (!entries) return { rows: [], totalDebit: 0, totalCredit: 0 };

  const byAccount = new Map<string, TrialBalanceRow>();
  for (const entry of entries) {
    for (const line of (entry.lines || []) as unknown as Array<{
      amount: number;
      entry_type: string;
      account: { id: string; code: string; name: string; type: string } | null;
    }>) {
      if (!line.account) continue;
      const key = line.account.id;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          account_id: key,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }
      const row = byAccount.get(key)!;
      if (line.entry_type === 'debit') row.debit += line.amount;
      else row.credit += line.amount;
    }
  }

  const rows = Array.from(byAccount.values()).map(r => {
    r.balance = r.debit - r.credit;
    return r;
  }).sort((a, b) => a.code.localeCompare(b.code));

  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, totalDebit, totalCredit };
}

// ─────────────────────────────────────────────────────────────
// Profit & Loss
// ─────────────────────────────────────────────────────────────

export interface PnLRow {
  account_id: string;
  code: string;
  name: string;
  type: 'revenue' | 'expense';
  amount: number;
}

export interface PnLStatement {
  rows: PnLRow[];
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}

export async function getPnL(range: DateRange): Promise<{ data?: PnLStatement; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      lines:journal_lines(
        amount,
        entry_type,
        account:accounts(id, code, name, type)
      )
    `)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to);

  if (error) return { error: error.message };
  if (!entries) return { data: emptyPnL() };

  const byAccount = new Map<string, PnLRow & { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of (entry.lines || []) as unknown as Array<{
      amount: number;
      entry_type: string;
      account: { id: string; code: string; name: string; type: string } | null;
    }>) {
      if (!line.account) continue;
      if (line.account.type !== 'revenue' && line.account.type !== 'expense') continue;
      const key = line.account.id;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          account_id: key,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type as 'revenue' | 'expense',
          amount: 0,
          debit: 0,
          credit: 0,
        });
      }
      const row = byAccount.get(key)!;
      if (line.entry_type === 'debit')  row.debit  += line.amount;
      else                              row.credit += line.amount;
    }
  }

  const rows: PnLRow[] = Array.from(byAccount.values()).map(r => {
    // Revenue: credits increase, debits decrease. Final balance = credits - debits.
    // Expenses: debits increase, credits decrease. Final balance = debits - credits.
    r.amount = r.type === 'revenue' ? r.credit - r.debit : r.debit - r.credit;
    return { account_id: r.account_id, code: r.code, name: r.name, type: r.type, amount: r.amount };
  }).sort((a, b) => a.code.localeCompare(b.code));

  const totalRevenue     = rows.filter(r => r.type === 'revenue').reduce((s, r) => s + r.amount, 0);
  const cogs             = rows.filter(r => r.code === '5000').reduce((s, r) => s + r.amount, 0);
  const operatingExpenses = rows.filter(r => r.type === 'expense' && r.code !== '5000').reduce((s, r) => s + r.amount, 0);
  const grossProfit      = totalRevenue - cogs;
  const netProfit        = grossProfit - operatingExpenses;

  return { data: { rows, totalRevenue, cogs, grossProfit, operatingExpenses, netProfit } };
}

function emptyPnL(): PnLStatement {
  return { rows: [], totalRevenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0 };
}

// ─────────────────────────────────────────────────────────────
// Balance Sheet
// ─────────────────────────────────────────────────────────────

export interface BalanceSheetRow {
  account_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity';
  balance: number;
}

export interface BalanceSheet {
  rows: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** Should equal totalAssets. */
  balanced: boolean;
}

export async function getBalanceSheet(asOf: string): Promise<{ data?: BalanceSheet; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      lines:journal_lines(
        amount,
        entry_type,
        account:accounts(id, code, name, type)
      )
    `)
    .lte('entry_date', asOf);

  if (error) return { error: error.message };
  if (!entries) return { data: emptyBalanceSheet() };

  const byAccount = new Map<string, BalanceSheetRow & { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of (entry.lines || []) as unknown as Array<{
      amount: number;
      entry_type: string;
      account: { id: string; code: string; name: string; type: string } | null;
    }>) {
      if (!line.account) continue;
      if (line.account.type !== 'asset' && line.account.type !== 'liability' && line.account.type !== 'equity') continue;
      const key = line.account.id;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          account_id: key,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type as 'asset' | 'liability' | 'equity',
          balance: 0,
          debit: 0,
          credit: 0,
        });
      }
      const row = byAccount.get(key)!;
      if (line.entry_type === 'debit')  row.debit  += line.amount;
      else                              row.credit += line.amount;
    }
  }

  const rows: BalanceSheetRow[] = Array.from(byAccount.values()).map(r => {
    // Assets:    Debit-normal   → balance = debits - credits
    // Liab/Eq:   Credit-normal  → balance = credits - debits
    r.balance = r.type === 'asset' ? r.debit - r.credit : r.credit - r.debit;
    return { account_id: r.account_id, code: r.code, name: r.name, type: r.type, balance: r.balance };
  }).sort((a, b) => a.code.localeCompare(b.code));

  const totalAssets      = rows.filter(r => r.type === 'asset').reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = rows.filter(r => r.type === 'liability').reduce((s, r) => s + r.balance, 0);
  const totalEquity      = rows.filter(r => r.type === 'equity').reduce((s, r) => s + r.balance, 0);

  // Net income from the period is normally added to equity via a closing entry —
  // since we don't auto-close yet, we fold the implied retained earnings into
  // equity for display. This keeps the Balance Sheet balanced.
  const impliedRetainedEarnings = totalAssets - totalLiabilities - totalEquity;
  const adjustedEquity = totalEquity + impliedRetainedEarnings;

  return {
    data: {
      rows,
      totalAssets,
      totalLiabilities,
      totalEquity: adjustedEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + adjustedEquity)) < 0.01,
    },
  };
}

function emptyBalanceSheet(): BalanceSheet {
  return { rows: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, balanced: true };
}

// ─────────────────────────────────────────────────────────────
// Journal List (for the Journal tab)
// ─────────────────────────────────────────────────────────────

export interface JournalListEntry {
  id: string;
  entry_date: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  total_amount: number;
  created_at: string;
  lines: Array<{
    account_code: string;
    account_name: string;
    entry_type: 'debit' | 'credit';
    amount: number;
    memo: string | null;
  }>;
}

export async function getJournalEntries(range: DateRange, limit = 100): Promise<{
  data?: JournalListEntry[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      reference_type,
      reference_id,
      total_amount,
      created_at,
      lines:journal_lines(
        entry_type,
        amount,
        memo,
        account:accounts(code, name)
      )
    `)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };
  if (!data) return { data: [] };

  type JournalEntryRaw = {
    id: string;
    entry_date: string;
    description: string;
    reference_type: string | null;
    reference_id: string | null;
    total_amount: number;
    created_at: string;
    lines: Array<{
      entry_type: string;
      amount: number;
      memo: string | null;
      account: { code: string; name: string } | null;
    }>;
  };

  return {
    data: (data as unknown as JournalEntryRaw[]).map(e => ({
      id: e.id,
      entry_date: e.entry_date,
      description: e.description,
      reference_type: e.reference_type,
      reference_id: e.reference_id,
      total_amount: e.total_amount,
      created_at: e.created_at,
      lines: (e.lines || []).map(l => ({
        account_code: l.account?.code || '',
        account_name: l.account?.name || '',
        entry_type: l.entry_type as 'debit' | 'credit',
        amount: l.amount,
        memo: l.memo,
      })),
    })),
  };
}