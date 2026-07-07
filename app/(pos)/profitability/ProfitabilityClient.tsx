'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  Lightbulb,
  X,
  ChevronDown,
  AlertTriangle,
  Wallet,
  DollarSign,
  PiggyBank,
  Sparkles,
} from 'lucide-react';
import { getProductProfitability, type ProfitabilitySummary, type ProductProfitability, type MarginHealth } from '@/lib/actions/profitability';
import { getDateRangeFromPreset, type DateRangePreset } from '@/lib/actions/accounting';
import { formatCurrency, cn } from '@/lib/utils';

const PRESETS: Array<{ key: DateRangePreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'year',  label: 'This year' },
  { key: 'all',   label: 'All time' },
];

type SortKey = 'profit' | 'margin' | 'units' | 'potential';
type SortDir = 'asc' | 'desc';

export default function ProfitabilityClient() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [summary, setSummary] = useState<ProfitabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [healthFilter, setHealthFilter] = useState<MarginHealth | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProductProfitability(preset).then(res => {
      if (alive && res.data) setSummary(res.data);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [preset]);

  const filtered = useMemo(() => {
    if (!summary) return [];
    let rows = [...summary.products];
    if (healthFilter !== 'all') {
      rows = rows.filter(r => r.health === healthFilter);
    }
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'profit':    return (a.profit - b.profit) * dir;
        case 'margin':    return (a.gross_margin_pct - b.gross_margin_pct) * dir;
        case 'units':     return (a.units_sold - b.units_sold) * dir;
        case 'potential': return (a.potential_profit - b.potential_profit) * dir;
      }
    });
    return rows;
  }, [summary, sortKey, sortDir, healthFilter]);

  const range = useMemo(() => getDateRangeFromPreset(preset), [preset]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Profitability</h1>
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Margins & per-product profit
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white active:scale-95 transition"
          aria-label="Change period"
        >
          <Calendar className="w-4 h-4 text-tactical-neon" />
          <span className="uppercase tracking-wide text-xs">
            {PRESETS.find(p => p.key === preset)?.label || 'Custom'}
          </span>
        </button>
      </div>

      {/* Headline tiles */}
      {loading || !summary ? (
        <div className="grid grid-cols-2 gap-3">
          <SkeletonTile /><SkeletonTile /><SkeletonTile /><SkeletonTile />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <HeadlineTile
            label="Total Profit"
            value={summary.total_profit}
            tone={summary.total_profit >= 0 ? 'neon' : 'red'}
            icon={summary.total_profit >= 0 ? TrendingUp : TrendingDown}
          />
          <HeadlineTile
            label="Blended Margin"
            value={summary.blended_margin_pct}
            tone={summary.blended_margin_pct >= 30 ? 'neon' : summary.blended_margin_pct >= 15 ? 'orange' : 'red'}
            icon={DollarSign}
            suffix="%"
          />
          <HeadlineTile
            label="Inventory Capital"
            value={summary.inventory_capital}
            tone="blue"
            icon={PiggyBank}
          />
          <HeadlineTile
            label="Potential Profit"
            value={summary.potential_profit}
            tone="orange"
            icon={Wallet}
          />
        </div>
      )}

      {/* Health distribution */}
      {summary && (
        <HealthDistributionCard
          counts={summary.health_counts}
          active={healthFilter}
          onChange={setHealthFilter}
        />
      )}

      {/* Sort bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SortChip active={sortKey === 'profit'}    onClick={() => toggleSort(setSortKey, setSortDir, 'profit', sortKey, sortDir)}    label="Profit" />
        <SortChip active={sortKey === 'margin'}    onClick={() => toggleSort(setSortKey, setSortDir, 'margin', sortKey, sortDir)}    label="Margin %" />
        <SortChip active={sortKey === 'units'}     onClick={() => toggleSort(setSortKey, setSortDir, 'units', sortKey, sortDir)}     label="Units sold" />
        <SortChip active={sortKey === 'potential'} onClick={() => toggleSort(setSortKey, setSortDir, 'potential', sortKey, sortDir)} label="Potential" />
      </div>

      {/* Product list */}
      {loading || !summary ? (
        <div className="space-y-2">
          <SkeletonTile /><SkeletonTile /><SkeletonTile />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={healthFilter} />
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <ProductRow
              key={p.product_id}
              product={p}
              open={expandedId === p.product_id}
              onToggle={() => setExpandedId(expandedId === p.product_id ? null : p.product_id)}
            />
          ))}
        </div>
      )}

      {/* Educational footer */}
      {summary && (
        <ExplanationCard
          summary={summary}
          rangeLabel={PRESETS.find(p => p.key === preset)?.label || ''}
        />
      )}

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

function toggleSort(
  setKey: (k: SortKey) => void,
  setDir: (d: SortDir) => void,
  key: SortKey,
  currentKey: SortKey,
  currentDir: SortDir
) {
  if (currentKey === key) {
    setDir(currentDir === 'desc' ? 'asc' : 'desc');
  } else {
    setKey(key);
    setDir('desc');
  }
}

// ─────────────────────────────────────────────────────────────
// Headline tile
// ─────────────────────────────────────────────────────────────

function HeadlineTile({
  label, value, tone, icon: Icon, suffix,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'neon' | 'red' | 'orange';
  icon: typeof TrendingUp;
  suffix?: string;
}) {
  const toneClass = {
    blue:   'text-tactical-blue',
    neon:   'text-tactical-neon',
    orange: 'text-tactical-orange',
    red:    'text-tactical-red',
  }[tone];

  const display = suffix === '%' ? `${value.toFixed(1)}%` : formatCurrency(value);

  return (
    <div className="card-tactical relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30"
           style={{ background: 'currentColor' }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</span>
          <Icon className={cn('w-4 h-4', toneClass)} />
        </div>
        <p className={cn('text-xl font-black tracking-tighter', toneClass)}>
          {display}
        </p>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return <div className="card-tactical h-24 animate-pulse bg-white/5" />;
}

// ─────────────────────────────────────────────────────────────
// Health distribution filter
// ─────────────────────────────────────────────────────────────

function HealthDistributionCard({
  counts, active, onChange,
}: {
  counts: Record<MarginHealth, number>;
  active: MarginHealth | 'all';
  onChange: (h: MarginHealth | 'all') => void;
}) {
  const total = counts.green + counts.yellow + counts.red + counts.gray;

  return (
    <div className="card-tactical space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Margin Health</h3>
        <span className="text-[10px] text-white/40 uppercase tracking-wide">{total} products</span>
      </div>

      {/* Bar */}
      {total > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
          {counts.green  > 0 && <div style={{ width: `${(counts.green  / total) * 100}%` }} className="bg-tactical-neon" />}
          {counts.yellow > 0 && <div style={{ width: `${(counts.yellow / total) * 100}%` }} className="bg-tactical-orange" />}
          {counts.red    > 0 && <div style={{ width: `${(counts.red    / total) * 100}%` }} className="bg-tactical-red" />}
          {counts.gray   > 0 && <div style={{ width: `${(counts.gray   / total) * 100}%` }} className="bg-white/40" />}
        </div>
      )}

      {/* Filter chips */}
      <div className="grid grid-cols-5 gap-1.5">
        <HealthChip
          active={active === 'all'}
          onClick={() => onChange('all')}
          label="All"
          count={total}
          color="white"
        />
        <HealthChip
          active={active === 'green'}
          onClick={() => onChange('green')}
          label="≥40%"
          count={counts.green}
          color="neon"
        />
        <HealthChip
          active={active === 'yellow'}
          onClick={() => onChange('yellow')}
          label="20–40%"
          count={counts.yellow}
          color="orange"
        />
        <HealthChip
          active={active === 'red'}
          onClick={() => onChange('red')}
          label="<20%"
          count={counts.red}
          color="red"
        />
        <HealthChip
          active={active === 'gray'}
          onClick={() => onChange('gray')}
          label="<0%"
          count={counts.gray}
          color="gray"
        />
      </div>
    </div>
  );
}

function HealthChip({
  active, onClick, label, count, color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: 'neon' | 'orange' | 'red' | 'gray' | 'white';
}) {
  const colorClass = {
    neon:   'text-tactical-neon',
    orange: 'text-tactical-orange',
    red:    'text-tactical-red',
    gray:   'text-white/60',
    white:  'text-white',
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center py-2 rounded-xl transition active:scale-95',
        active
          ? 'bg-white/15 border border-white/30'
          : 'bg-white/5 border border-white/10'
      )}
    >
      <span className={cn('text-base font-black tabular-nums', colorClass)}>{count}</span>
      <span className="text-[9px] uppercase tracking-wider text-white/50 mt-0.5">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort chip
// ─────────────────────────────────────────────────────────────

function SortChip({
  active, onClick, label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition active:scale-95 shrink-0',
        active
          ? 'bg-tactical-neon text-black'
          : 'bg-white/5 border border-white/10 text-white/60'
      )}
    >
      {label}
      {active && <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Product row
// ─────────────────────────────────────────────────────────────

function ProductRow({
  product, open, onToggle,
}: {
  product: ProductProfitability;
  open: boolean;
  onToggle: () => void;
}) {
  const healthDot = {
    green:  'bg-tactical-neon',
    yellow: 'bg-tactical-orange',
    red:    'bg-tactical-red',
    gray:   'bg-white/40',
  }[product.health];

  const healthLabel = {
    green:  'HEALTHY',
    yellow: 'THIN',
    red:    'LOW',
    gray:   'LOSS',
  }[product.health];

  const healthText = {
    green:  'text-tactical-neon',
    yellow: 'text-tactical-orange',
    red:    'text-tactical-red',
    gray:   'text-white/60',
  }[product.health];

  return (
    <div className="card-tactical overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left active:scale-[0.99] transition"
      >
        {/* Traffic light */}
        <div className={cn('w-2 self-stretch rounded-full', healthDot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-white truncate">{product.name}</p>
            <span className={cn('text-[9px] font-black uppercase tracking-wider shrink-0', healthText)}>
              {healthLabel}
            </span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            {product.units_sold} sold · {product.gross_margin_pct.toFixed(1)}% margin
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className={cn(
            'text-sm font-black tabular-nums',
            product.profit >= 0 ? 'text-tactical-neon' : 'text-tactical-red'
          )}>
            {product.profit >= 0 ? '+' : ''}{formatCurrency(product.profit)}
          </p>
          <p className="text-[10px] text-white/40 tabular-nums">
            {formatCurrency(product.revenue)}
          </p>
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
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Cost"        value={formatCurrency(product.cost_price)} />
              <Stat label="Sell"        value={formatCurrency(product.selling_price)} />
              <Stat label="Per-unit margin" value={formatCurrency(product.margin_per_unit)} highlight={product.margin_per_unit > 0 ? 'neon' : 'red'} />
              <Stat label="Gross margin %"  value={`${product.gross_margin_pct.toFixed(1)}%`} highlight={productHealthHighlight(product.health)} />
              <Stat label="Units sold"   value={product.units_sold.toString()} />
              <Stat label="Revenue"      value={formatCurrency(product.revenue)} />
              <Stat label="COGS"         value={formatCurrency(product.cogs)} />
              <Stat label="Profit"       value={formatCurrency(product.profit)} highlight={product.profit >= 0 ? 'neon' : 'red'} />
              <Stat label="Stock"        value={`${product.stock_level} units`} />
              <Stat label="Capital tied" value={formatCurrency(product.stock_value_at_cost)} />
              <Stat label="Potential profit" value={formatCurrency(product.potential_profit)} highlight="orange" wide />
            </div>

            {product.health === 'gray' && (
              <div className="mt-3 p-2.5 rounded-lg bg-tactical-red/10 border border-tactical-red/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-tactical-red shrink-0 mt-0.5" />
                <p className="text-xs text-white/80">
                  You're selling this below cost. Raise the price to at least {formatCurrency(product.cost_price)} to break even.
                </p>
              </div>
            )}
            {product.health === 'red' && product.units_sold > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-tactical-orange/10 border border-tactical-orange/30 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-tactical-orange shrink-0 mt-0.5" />
                <p className="text-xs text-white/80">
                  Thin margin. Try a 5–10% price increase or negotiate supplier cost down.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function productHealthHighlight(h: MarginHealth): 'neon' | 'orange' | 'red' | 'gray' {
  return h;
}

function Stat({
  label, value, highlight, wide,
}: {
  label: string;
  value: string;
  highlight?: 'neon' | 'orange' | 'red' | 'gray';
  wide?: boolean;
}) {
  const cls = highlight === 'neon'   ? 'text-tactical-neon'
            : highlight === 'orange' ? 'text-tactical-orange'
            : highlight === 'red'    ? 'text-tactical-red'
            : highlight === 'gray'   ? 'text-white/60'
            :                          'text-white';
  return (
    <div className={cn('bg-white/5 rounded-lg p-2', wide && 'col-span-2')}>
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">{label}</p>
      <p className={cn('text-sm font-black tabular-nums mt-0.5', cls)}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: MarginHealth | 'all' }) {
  const labels: Record<MarginHealth | 'all', string> = {
    all:    'No products yet',
    green:  'No healthy-margin products',
    yellow: 'No thin-margin products',
    red:    'No low-margin products',
    gray:   'No loss-making products',
  };
  return (
    <div className="card-tactical text-center py-12">
      <Package className="w-12 h-12 mx-auto text-white/20 mb-2" />
      <p className="text-white/60 text-sm">{labels[filter]}</p>
      <p className="text-white/40 text-xs mt-1">
        {filter === 'all' ? 'Add products to see profitability' : 'Try a different filter'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Explanation card
// ─────────────────────────────────────────────────────────────

function ExplanationCard({
  summary, rangeLabel,
}: {
  summary: ProfitabilitySummary;
  rangeLabel: string;
}) {
  const body = explainSummary(summary, rangeLabel);
  return (
    <div className="card-tactical bg-tactical-neon/5 border-tactical-neon/20 mt-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-tactical-neon/20 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-tactical-neon" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tactical-neon">What this means</span>
            <Sparkles className="w-3 h-3 text-tactical-neon" />
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function explainSummary(s: ProfitabilitySummary, rangeLabel: string): string {
  const marginPct = s.blended_margin_pct;
  if (s.total_revenue === 0) {
    return `No sales in ${rangeLabel.toLowerCase()}. Once you record sales, you'll see per-product margin and profit here.`;
  }
  const parts: string[] = [];
  parts.push(
    `Your blended margin is ${marginPct.toFixed(1)}% — ${marginPct >= 30 ? 'healthy for retail.' : marginPct >= 15 ? 'thin — review pricing or supplier costs.' : 'critically low — urgent action needed.'}`
  );
  if (s.health_counts.gray > 0) {
    parts.push(`${s.health_counts.gray} product${s.health_counts.gray > 1 ? 's are' : ' is'} selling below cost — bleeding money on every unit.`);
  }
  if (s.health_counts.red > 0 && s.health_counts.green > 0) {
    parts.push(`${s.health_counts.green} of your products are healthy-margin; ${s.health_counts.red} are below 20%.`);
  }
  parts.push(
    `You have ${formatCurrency(s.inventory_capital)} tied up in stock right now. If you sold it all at today's prices, you'd make ${formatCurrency(s.potential_profit)}.`
  );
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────
// Period picker
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
                  ? 'bg-tactical-neon/20 border border-tactical-neon text-white'
                  : 'bg-white/5 border border-white/10 text-white/70'
              )}
            >
              <span className="font-bold uppercase tracking-wide text-sm">{p.label}</span>
              {current === p.key && <span className="text-xs font-black uppercase text-tactical-neon">Active</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}