'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  User as UserIcon,
  Activity,
  Inbox,
} from 'lucide-react';
import {
  getAuditLogs,
  getAuditLogFacets,
  getAuditLogStats,
  type AuditLogFilters,
} from '@/lib/actions/audit';
import type { AuditLogWithActor } from '@/lib/supabase-types';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

export default function AuditPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [rows, setRows] = useState<AuditLogWithActor[]>([]);
  const [facets, setFacets] = useState<{ actions: string[]; entityTypes: string[] }>({
    actions: [],
    entityTypes: [],
  });
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Detail expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search input so we don't re-query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when any filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, action, entityType, dateFrom, dateTo]);

  // Load facets + stats once.
  useEffect(() => {
    if (!isAdmin) return;
    getAuditLogFacets()
      .then((f) => setFacets({ actions: f.actions, entityTypes: f.entityTypes }))
      .catch(() => {
        // Facets are best-effort; the page still works without them.
      });
    getAuditLogStats()
      .then((s) => setStats({ total: s.total, today: s.today, thisWeek: s.thisWeek }))
      .catch(() => {
        // Same.
      });
  }, [isAdmin]);

  // Load rows whenever filters or page change.
  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, debouncedSearch, action, entityType, dateFrom, dateTo, page]);

  const load = async () => {
    setIsLoading(true);
    const filters: AuditLogFilters = {
      search: debouncedSearch || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    const offset = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await getAuditLogs(filters, { limit: PAGE_SIZE, offset });
    if (error) {
      toast.error(error);
    }
    setRows(data);
    setTotalCount(count);
    setIsLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const hasActiveFilters = Boolean(action || entityType || dateFrom || dateTo || search);

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <ShieldCheck className="w-12 h-12 text-tactical-red" />
        <h1 className="text-xl font-black">Admin Only</h1>
        <p className="text-white/50 text-sm max-w-xs">
          The audit log is restricted to admin accounts. Ask the owner for access
          if you need to review activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tighter">Audit Log</h1>
        <p className="text-white/50 text-xs uppercase tracking-wider">
          Every journal post, action, and write that hit the database.
        </p>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip label="Total" value={stats.total} accent="text-white" />
        <StatChip label="This Week" value={stats.thisWeek} accent="text-tactical-blue" />
        <StatChip label="Today" value={stats.today} accent="text-tactical-neon" />
      </div>

      {/* Search + filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action or entity id…"
              className="w-full h-11 pl-9 pr-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2 transition-all',
              showFilters || hasActiveFilters
                ? 'bg-tactical-blue/20 text-tactical-blue border border-tactical-blue/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            )}
            aria-expanded={showFilters}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-tactical-neon" />
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="card-tactical space-y-3 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FilterSelect
                    label="Action"
                    value={action}
                    onChange={setAction}
                    options={facets.actions}
                    placeholder="All actions"
                  />
                  <FilterSelect
                    label="Entity"
                    value={entityType}
                    onChange={setEntityType}
                    options={facets.entityTypes}
                    placeholder="All entities"
                  />
                  <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
                  <DateInput label="To" value={dateTo} onChange={setDateTo} />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-white/40 hover:text-white/70 uppercase tracking-wide font-bold flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-16 text-white/40 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <AuditRow
              key={row.id}
              row={row}
              isExpanded={expandedId === row.id}
              onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 text-xs text-white/50">
          <span>
            Page {page} of {totalPages} · {totalCount} total
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-3 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 font-bold"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 px-3 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10 font-bold"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function StatChip({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card-tactical text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className={cn('text-2xl font-black tracking-tighter mt-1', accent)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-tactical-neon"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-tactical-neon [color-scheme:dark]"
      />
    </label>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="card-tactical text-center py-16 space-y-3">
      <Inbox className="w-12 h-12 text-white/10 mx-auto" />
      <p className="text-white/40 text-sm uppercase tracking-widest">
        No audit entries match
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="text-xs text-tactical-blue hover:underline uppercase tracking-wide font-bold"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function AuditRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: AuditLogWithActor;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const actorName = row.actor?.full_name || 'System';
  const actionColor = useMemo(() => actionToColor(row.action), [row.action]);

  return (
    <div className="card-tactical overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left active:scale-[0.998] transition-transform"
      >
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/40" />
          )}
        </div>

        <div className="shrink-0 w-9 h-9 rounded-full bg-tactical-blue/15 flex items-center justify-center">
          <Activity className="w-4 h-4 text-tactical-blue" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded', actionColor)}>
              {row.action}
            </span>
            {row.entity_type && (
              <span className="text-[10px] text-white/40 font-mono">
                {row.entity_type}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold truncate mt-0.5">
            {summarizeMetadata(row)}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
            <span className="flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {actorName}
            </span>
            <span>·</span>
            <span>{formatTimestamp(row.created_at)}</span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-white/10 space-y-2 text-xs">
              <DetailRow label="Action" value={row.action} mono />
              <DetailRow label="Entity Type" value={row.entity_type || '—'} mono />
              <DetailRow label="Entity ID" value={row.entity_id || '—'} mono />
              <DetailRow label="Actor" value={`${actorName}${row.actor?.role ? ` (${row.actor.role})` : ''}`} />
              <DetailRow label="Created" value={formatTimestamp(row.created_at)} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                  Metadata
                </p>
                <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-[11px] text-white/80 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {row.metadata && Object.keys(row.metadata).length > 0
                    ? JSON.stringify(row.metadata, null, 2)
                    : '(empty)'}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 w-20 shrink-0 pt-0.5">
        {label}
      </span>
      <span className={cn('text-white/80 break-all', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function actionToColor(action: string): string {
  if (action.startsWith('journal.')) return 'bg-tactical-blue/20 text-tactical-blue';
  if (action.startsWith('sale.')) return 'bg-tactical-neon/20 text-tactical-neon';
  if (action.startsWith('expense.')) return 'bg-tactical-orange/20 text-tactical-orange';
  if (action.startsWith('installment.')) return 'bg-tactical-purple/20 text-tactical-purple';
  if (action.startsWith('auth.')) return 'bg-tactical-red/20 text-tactical-red';
  return 'bg-white/10 text-white/70';
}

function summarizeMetadata(row: AuditLogWithActor): string {
  const meta = row.metadata;
  if (!meta || typeof meta !== 'object') return '—';
  // Try common shapes so the collapsed row is informative.
  if (typeof meta.description === 'string') return meta.description;
  if (typeof meta.summary === 'string') return meta.summary;
  if (typeof meta.amount !== 'undefined' && meta.amount !== null) {
    return `amount: ${meta.amount}`;
  }
  return Object.keys(meta).length > 0
    ? `${Object.keys(meta).length} field${Object.keys(meta).length === 1 ? '' : 's'}`
    : '—';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-ZM', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
