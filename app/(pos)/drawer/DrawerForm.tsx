'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Banknote,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitDrawerLog } from '@/lib/actions/cash-drawer';
import type { CashDrawerLog } from '@/lib/supabase-types';

interface ExpectedCashBreakdown {
  opening: number;
  cashSales: number;
  cashExpenses: number;
  preOrderDeposits: number;
  expected: number;
}

const fmt = (n: number) =>
  `K${Math.round(n).toLocaleString('en-US')}`;

/**
 * Cash drawer form (Phase 12 / E).
 *
 * Two fields the user fills in:
 *   - opening_cash (what was in the drawer at open)
 *   - closing_cash (what's in the drawer now)
 *
 * The system computes `expected` from the day's transactions.
 * Variance = closing - expected. Saved on submit.
 */
export function DrawerForm({
  today,
  expected,
  existing,
}: {
  today: string;
  expected: ExpectedCashBreakdown;
  existing: CashDrawerLog | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Initial opening comes from either the existing log (re-edit)
  // or the previous day's closing (per computeExpectedCash).
  const [opening, setOpening] = useState(
    existing?.opening_cash.toString() ?? expected.opening.toString()
  );
  const [closing, setClosing] = useState(existing?.closing_cash.toString() ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Live variance preview
  const openN = parseFloat(opening) || 0;
  const closeN = parseFloat(closing) || 0;
  // If the user typed an opening different from what we expected,
  // honour their number. Otherwise use the system expected.
  const liveExpected = expected.expected;
  const liveVariance = closeN - liveExpected;
  const varianceClass =
    Math.abs(liveVariance) < 10
      ? 'text-white/70'
      : liveVariance < 0
        ? 'text-tactical-red'
        : 'text-tactical-neon';

  function submit() {
    if (closeN <= 0 && openN <= 0) {
      toast.error('Enter the opening and closing amounts');
      return;
    }
    startTransition(async () => {
      const res = await submitDrawerLog({
        log_date: today,
        opening_cash: openN,
        closing_cash: closeN,
        notes: notes.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(existing ? 'Drawer log updated' : 'Drawer log saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Expected breakdown */}
      <div className="card-tactical border-tactical-blue/30 bg-tactical-blue/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-tactical-blue" />
          <p className="text-xs font-black uppercase tracking-widest text-tactical-blue">
            What the system thinks is in the drawer
          </p>
        </div>
        <Row label="Opening (from yesterday's close)" value={fmt(expected.opening)} />
        <Row label="+ Today's paid sales" value={`+${fmt(expected.cashSales)}`} positive />
        <Row label="− Today's expenses" value={`−${fmt(expected.cashExpenses)}`} negative />
        <Row label="+ Pre-order deposits received" value={`+${fmt(expected.preOrderDeposits)}`} positive />
        <div className="h-px bg-white/10 my-1" />
        <Row label="Expected" value={fmt(expected.expected)} highlight />
        <p className="text-[10px] text-white/40 leading-relaxed">
          v1 assumes all sales and expenses are cash. When you start accepting mobile
          money / bank transfers, edit the expected number manually below.
        </p>
      </div>

      {/* User inputs */}
      <div className="card-tactical p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-tactical-neon" />
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Count the drawer
          </p>
        </div>

        <Field label="Opening cash (K)">
          <input
            type="number"
            step="1"
            min="0"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className="input-tactical w-full text-sm"
            placeholder="0"
          />
        </Field>

        <Field label="Closing cash — what you actually counted (K)">
          <input
            type="number"
            step="1"
            min="0"
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            className="input-tactical w-full text-sm"
            placeholder="0"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Banked K500 at lunch. Mobile money sale K1,200 not in drawer."
            rows={2}
            maxLength={500}
            className="input-tactical w-full text-sm resize-none"
          />
        </Field>

        {/* Live variance */}
        {closeN > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
                Variance
              </p>
              <p className="text-[10px] text-white/40 leading-tight">
                closing {fmt(closeN)} − expected {fmt(liveExpected)}
              </p>
            </div>
            <p className={cn('text-2xl font-black', varianceClass)}>
              {liveVariance >= 0 ? '+' : ''}
              {fmt(liveVariance)}
            </p>
          </div>
        )}

        {existing && (
          <p className="text-[10px] text-tactical-neon inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            You already submitted today — submitting again will overwrite.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className={cn(
            'btn-tactical w-full flex items-center justify-center gap-2',
            isPending && 'opacity-50'
          )}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {existing ? 'Update log' : 'Save log'}
        </button>
      </div>

      {existing && (
        <p className="text-[10px] text-white/40 inline-flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          v1 is best-effort. Anything that doesn&apos;t match a sales / expense row
          (bank deposits, change you gave that wasn&apos;t tracked) goes in the
          notes — we use it for the variance trend over time.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
  positive = false,
  negative = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p
        className={cn(
          'text-xs',
          highlight ? 'text-white font-bold' : 'text-white/60'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-sm',
          highlight && 'text-tactical-neon font-black',
          !highlight && positive && 'text-tactical-neon',
          !highlight && negative && 'text-tactical-red'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}
