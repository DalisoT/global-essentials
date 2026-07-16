import Link from 'next/link';
import { ChevronLeft, Banknote, History, AlertCircle } from 'lucide-react';
import {
  computeExpectedCash,
  getDrawerLog,
  listDrawerLogs,
} from '@/lib/actions/cash-drawer';
import { DrawerForm } from './DrawerForm';

/**
 * Cash drawer reconciliation (Phase 12 / E).
 *
 * Server component. Loads today's expected cash + the
 * existing log (if any) + the last 30 days of history,
 * then hands it to the client form.
 */
export default async function DrawerPage() {
  const today = todayLusaka();
  const [expectedRes, todayRes, historyRes] = await Promise.all([
    computeExpectedCash(today),
    getDrawerLog(today),
    listDrawerLogs({ lookback_days: 60, limit: 30 }),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-3 h-3" />
        Dashboard
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl text-tactical text-tactical">Cash drawer</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">
          End-of-day reconciliation
        </p>
      </div>

      {expectedRes.error ? (
        <div className="card-tactical border-tactical-red/30 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-tactical-red mt-0.5 shrink-0" />
          <p className="text-sm text-white/70">{expectedRes.error}</p>
        </div>
      ) : (
        <DrawerForm
          today={today}
          expected={expectedRes.data}
          existing={todayRes.data ?? null}
        />
      )}

      {historyRes.data && historyRes.data.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-tactical-blue" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white/60">
              History (last {historyRes.data.length} days)
            </h2>
          </div>
          <div className="card-tactical p-3 space-y-1.5">
            {historyRes.data.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-white/60">{log.log_date}</span>
                <span className="text-white/40">
                  open {formatK(log.opening_cash)} · expected {formatK(log.expected_cash)} · closed {formatK(log.closing_cash)}
                </span>
                <span
                  className={
                    log.variance < -10
                      ? 'text-tactical-red font-black'
                      : log.variance > 10
                        ? 'text-tactical-neon font-black'
                        : 'text-white/40'
                  }
                >
                  {log.variance >= 0 ? '+' : ''}
                  {formatK(log.variance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function todayLusaka(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatK(n: number): string {
  return `K${Math.round(n).toLocaleString('en-US')}`;
}
