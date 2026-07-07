'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BookOpen,
  ScrollText,
  ChevronRight,
  Calendar,
  Sparkles,
  Lightbulb,
  X,
} from 'lucide-react';
import {
  getPnL,
  getBalanceSheet,
  getJournalEntries,
  getDateRangeFromPreset,
  type DateRange,
  type DateRangePreset,
  type PnLStatement,
  type BalanceSheet,
  type JournalListEntry,
} from '@/lib/actions/accounting';
import { formatCurrency, cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Period presets
// ─────────────────────────────────────────────────────────────

const PRESETS: Array<{ key: DateRangePreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'year',  label: 'This year' },
  { key: 'all',   label: 'All time' },
];

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

type Tab = 'pnl' | 'balance' | 'journal';

export default function AccountingClient() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [tab, setTab] = useState<Tab>('pnl');
  const [showPicker, setShowPicker] = useState(false);

  const range = useMemo(() => getDateRangeFromPreset(preset), [preset]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Accounting</h1>
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Books, statements & journal
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white active:scale-95 transition"
          aria-label="Change period"
        >
          <Calendar className="w-4 h-4 text-tactical-blue" />
          <span className="uppercase tracking-wide text-xs">
            {PRESETS.find(p => p.key === preset)?.label || 'Custom'}
          </span>
        </button>
      </div>

      {/* Quick metric tiles — always visible regardless of tab */}
      <PnLHeadlineCards range={range} />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
        <TabButton active={tab === 'pnl'}     onClick={() => setTab('pnl')}     icon={TrendingUp} label="P&L" />
        <TabButton active={tab === 'balance'} onClick={() => setTab('balance')} icon={Wallet}     label="Balance" />
        <TabButton active={tab === 'journal'} onClick={() => setTab('journal')} icon={ScrollText} label="Journal" />
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === 'pnl'     && <motion.div key="pnl"     initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><PnLView range={range} /></motion.div>}
        {tab === 'balance' && <motion.div key="balance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><BalanceSheetView range={range} /></motion.div>}
        {tab === 'journal' && <motion.div key="journal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><JournalView range={range} /></motion.div>}
      </AnimatePresence>

      {/* Period picker bottom sheet */}
      <AnimatePresence>
        {showPicker && (
          <PeriodPicker
            current={preset}
            onClose={() => setShowPicker(false)}
            onSelect={(p) => { setPreset(p); setShowPicker(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab button
// ─────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof TrendingUp;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition',
        active
          ? 'bg-tactical-blue text-white shadow-tactical'
          : 'text-white/60 active:scale-95'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Headline cards (always visible)
// ─────────────────────────────────────────────────────────────

function PnLHeadlineCards({ range }: { range: DateRange }) {
  const [data, setData] = useState<PnLStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPnL(range).then(res => {
      if (alive && res.data) setData(res.data);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <SkeletonTile />
        <SkeletonTile />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <HeadlineTile
        label="Revenue"
        value={data.totalRevenue}
        tone="blue"
        icon={TrendingUp}
      />
      <HeadlineTile
        label="Net Profit"
        value={data.netProfit}
        tone={data.netProfit >= 0 ? 'neon' : 'red'}
        icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
      />
    </div>
  );
}

function HeadlineTile({
  label, value, tone, icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'neon' | 'red' | 'orange';
  icon: typeof TrendingUp;
}) {
  const toneClass = {
    blue:   'text-tactical-blue',
    neon:   'text-tactical-neon',
    orange: 'text-tactical-orange',
    red:    'text-tactical-red',
  }[tone];

  return (
    <div className="card-tactical relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30"
           style={{ background: 'currentColor' }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</span>
          <Icon className={cn('w-4 h-4', toneClass)} />
        </div>
        <p className={cn('text-2xl font-black tracking-tighter', toneClass)}>
          {formatCurrency(value)}
        </p>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return <div className="card-tactical h-24 animate-pulse bg-white/5" />;
}

// ─────────────────────────────────────────────────────────────
// P&L view
// ─────────────────────────────────────────────────────────────

function PnLView({ range }: { range: DateRange }) {
  const [data, setData] = useState<PnLStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPnL(range).then(res => {
      if (alive && res.data) setData(res.data);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  if (loading || !data) {
    return <div className="space-y-3"><SkeletonTile /><SkeletonTile /><SkeletonTile /></div>;
  }

  const revenues = data.rows.filter(r => r.type === 'revenue');
  const expenses = data.rows.filter(r => r.type === 'expense');

  const marginPct = data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-3">
      <Section title="Revenue">
        {revenues.length === 0 && <Empty label="No revenue posted yet" />}
        {revenues.map(r => <PLRow key={r.account_id} code={r.code} name={r.name} amount={r.amount} />)}
        <SubtotalRow label="Total Revenue" amount={data.totalRevenue} tone="blue" />
      </Section>

      <Section title="Cost of Goods Sold">
        <PLRow code="5000" name="Cost of Goods Sold" amount={data.cogs} />
        <SubtotalRow label="Gross Profit" amount={data.grossProfit} tone="neon" />
      </Section>

      <Section title="Operating Expenses">
        {expenses.filter(e => e.code !== '5000').map(e => <PLRow key={e.account_id} code={e.code} name={e.name} amount={e.amount} />)}
        <SubtotalRow label="Total Expenses" amount={data.operatingExpenses} tone="orange" />
      </Section>

      <Section title="Net Result">
        <div className="card-tactical bg-tactical-slate/60 border-tactical-blue/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Net Profit</span>
            <span className={cn('text-xs font-bold uppercase tracking-wide',
              data.netProfit >= 0 ? 'text-tactical-neon' : 'text-tactical-red')}>
              {marginPct.toFixed(1)}% margin
            </span>
          </div>
          <p className={cn('text-3xl font-black tracking-tighter',
            data.netProfit >= 0 ? 'text-tactical-neon' : 'text-tactical-red')}>
            {formatCurrency(data.netProfit)}
          </p>
        </div>
      </Section>

      {/* AI explanation card (Phase 1 placeholder; Phase 3 wires up the LLM) */}
      <ExplanationCard
        icon={Lightbulb}
        title="What this means"
        body={explainPnL(data)}
      />
    </div>
  );
}

function explainPnL(p: PnLStatement): string {
  const marginPct = p.totalRevenue > 0 ? (p.netProfit / p.totalRevenue) * 100 : 0;
  if (p.totalRevenue === 0) {
    return 'No revenue posted in this period yet. Record sales to see your P&L statement come to life.';
  }
  if (marginPct > 25) {
    return `Strong ${marginPct.toFixed(1)}% net margin. You're keeping ${formatCurrency(p.netProfit)} of every ${formatCurrency(p.totalRevenue)} sold. Consider reinvesting in inventory or marketing.`;
  }
  if (marginPct > 10) {
    return `Healthy ${marginPct.toFixed(1)}% margin. Your gross profit is ${formatCurrency(p.grossProfit)}; operating expenses are ${formatCurrency(p.operatingExpenses)}. Look at your top expense lines to find 5-10% savings.`;
  }
  if (marginPct > 0) {
    return `Thin ${marginPct.toFixed(1)}% margin — every kwacha matters. Either raise prices, cut costs, or grow volume. COGS is ${formatCurrency(p.cogs)}; review supplier costs.`;
  }
  return `Loss of ${formatCurrency(Math.abs(p.netProfit))}. Costs (${formatCurrency(p.cogs + p.operatingExpenses)}) exceed revenue (${formatCurrency(p.totalRevenue)}). Urgent: review pricing and expenses.`;
}

// ─────────────────────────────────────────────────────────────
// Balance Sheet view
// ─────────────────────────────────────────────────────────────

function BalanceSheetView({ range }: { range: DateRange }) {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // "As of" = end of range
    getBalanceSheet(range.to).then(res => {
      if (alive && res.data) setData(res.data);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  if (loading || !data) {
    return <div className="space-y-3"><SkeletonTile /><SkeletonTile /></div>;
  }

  const assets      = data.rows.filter(r => r.type === 'asset');
  const liabilities = data.rows.filter(r => r.type === 'liability');
  const equity      = data.rows.filter(r => r.type === 'equity');

  return (
    <div className="space-y-3">
      <Section title="Assets">
        {assets.length === 0 && <Empty label="No assets recorded" />}
        {assets.map(r => <PLRow key={r.account_id} code={r.code} name={r.name} amount={r.balance} />)}
        <SubtotalRow label="Total Assets" amount={data.totalAssets} tone="blue" />
      </Section>

      <Section title="Liabilities">
        {liabilities.length === 0 && <Empty label="No liabilities" />}
        {liabilities.map(r => <PLRow key={r.account_id} code={r.code} name={r.name} amount={r.balance} />)}
        <SubtotalRow label="Total Liabilities" amount={data.totalLiabilities} tone="orange" />
      </Section>

      <Section title="Equity">
        {equity.length === 0 && <Empty label="No equity posted" />}
        {equity.map(r => <PLRow key={r.account_id} code={r.code} name={r.name} amount={r.balance} />)}
        <SubtotalRow label="Total Equity" amount={data.totalEquity} tone="neon" />
      </Section>

      <div className={cn(
        'card-tactical flex items-center justify-between',
        data.balanced ? 'border-tactical-neon/30' : 'border-tactical-red/30'
      )}>
        <span className="text-xs font-bold uppercase tracking-wider text-white/60">Balance Check</span>
        <span className={cn('text-sm font-black',
          data.balanced ? 'text-tactical-neon' : 'text-tactical-red')}>
          {data.balanced ? 'BALANCED' : 'OUT OF BALANCE'}
        </span>
      </div>

      <ExplanationCard
        icon={Lightbulb}
        title="Reading the balance sheet"
        body={`Your business owns ${formatCurrency(data.totalAssets)} in assets, owes ${formatCurrency(data.totalLiabilities)}, and the owners' share is ${formatCurrency(data.totalEquity)}. Assets should always equal Liabilities + Equity — that's the fundamental accounting equation.`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Journal view
// ─────────────────────────────────────────────────────────────

function JournalView({ range }: { range: DateRange }) {
  const [entries, setEntries] = useState<JournalListEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getJournalEntries(range, 200).then(res => {
      if (alive) setEntries(res.data || []);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  if (loading || !entries) {
    return <div className="space-y-2"><SkeletonTile /><SkeletonTile /><SkeletonTile /></div>;
  }

  if (entries.length === 0) {
    return (
      <div className="card-tactical text-center py-12">
        <BookOpen className="w-12 h-12 mx-auto text-white/20 mb-2" />
        <p className="text-white/60 text-sm">No journal entries yet</p>
        <p className="text-white/40 text-xs mt-1">Sales and expenses post entries here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <JournalEntryCard
          key={entry.id}
          entry={entry}
          open={openId === entry.id}
          onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
        />
      ))}
    </div>
  );
}

function JournalEntryCard({
  entry, open, onToggle,
}: {
  entry: JournalListEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const refLabel =
    entry.reference_type === 'sale' ? 'Sale' :
    entry.reference_type === 'expense' ? 'Expense' :
    entry.reference_type === 'installment_payment' ? 'Payment' :
    entry.reference_type || 'Entry';

  return (
    <div className="card-tactical overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left active:scale-[0.99] transition"
      >
        <div className="w-10 h-10 rounded-full bg-tactical-blue/20 flex items-center justify-center shrink-0">
          <ScrollText className="w-5 h-5 text-tactical-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tactical-blue bg-tactical-blue/10 px-2 py-0.5 rounded">
              {refLabel}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wide">
              {new Date(entry.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-sm font-semibold text-white truncate mt-0.5">{entry.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-white">{formatCurrency(entry.total_amount)}</p>
          <ChevronRight className={cn(
            'w-4 h-4 text-white/40 ml-auto mt-0.5 transition-transform',
            open && 'rotate-90'
          )} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5 mt-3 pt-3"
          >
            <table className="w-full text-xs">
              <tbody>
                {entry.lines.map((line, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-2 text-white/40 font-mono">{line.account_code}</td>
                    <td className="py-1.5 pr-2 text-white/80">{line.account_name}</td>
                    <td className={cn(
                      'py-1.5 text-right font-mono font-semibold',
                      line.entry_type === 'debit' ? 'text-tactical-blue' : 'text-tactical-orange'
                    )}>
                      {line.entry_type === 'debit' ? 'Dr' : 'Cr'} {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entry.lines[0]?.memo && (
              <p className="text-xs text-white/40 italic mt-2">{entry.lines[0].memo}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Period picker bottom sheet
// ─────────────────────────────────────────────────────────────

function PeriodPicker({
  current, onClose, onSelect,
}: {
  current: DateRangePreset;
  onClose: () => void;
  onSelect: (p: DateRangePreset) => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-tactical-slate rounded-t-3xl border-t border-white/10 p-4 pb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-tighter text-white">Period</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => onSelect(p.key)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition active:scale-[0.98]',
                current === p.key
                  ? 'bg-tactical-blue/20 border border-tactical-blue text-white'
                  : 'bg-white/5 border border-white/10 text-white/70'
              )}
            >
              <span className="font-bold uppercase tracking-wide text-sm">{p.label}</span>
              {current === p.key && <span className="text-xs font-black uppercase text-tactical-blue">Active</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 px-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PLRow({ code, name, amount }: { code: string; name: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{name}</p>
        <p className="text-[10px] text-white/40 font-mono">{code}</p>
      </div>
      <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(amount)}</p>
    </div>
  );
}

function SubtotalRow({ label, amount, tone }: { label: string; amount: number; tone: 'blue' | 'neon' | 'orange' }) {
  const cls = tone === 'neon' ? 'text-tactical-neon' : tone === 'orange' ? 'text-tactical-orange' : 'text-tactical-blue';
  return (
    <div className="flex items-center justify-between py-3 px-3 mt-1 border-t border-white/10 bg-white/5 rounded-lg">
      <span className="text-xs font-bold uppercase tracking-wider text-white/80">{label}</span>
      <span className={cn('text-base font-black tabular-nums', cls)}>{formatCurrency(amount)}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-white/40 italic px-3 py-2">{label}</p>;
}

function ExplanationCard({ icon: Icon, title, body }: { icon: typeof Lightbulb; title: string; body: string }) {
  return (
    <div className="card-tactical bg-tactical-blue/5 border-tactical-blue/20 mt-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-tactical-blue/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-tactical-blue" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tactical-blue">{title}</span>
            <Sparkles className="w-3 h-3 text-tactical-blue" />
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}