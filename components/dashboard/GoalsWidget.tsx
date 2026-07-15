import Link from 'next/link';
import { Target, Plus, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { getAllGoalProgress } from '@/lib/actions/goals';
import { GoalsWidgetActions } from './GoalsWidgetActions';
import { formatCurrency } from '@/lib/utils';
import type { GoalProgress } from '@/lib/supabase-types';

/**
 * GoalsWidget (Phase 9 / 9.5).
 *
 * Server component. Lists every active goal with live
 * progress, and exposes a "+ New goal" button that opens
 * a client-side form.
 *
 * Renders nothing if there are no goals AND the form is
 * closed — we don't want a noisy empty card on the dashboard
 * before the user has opted in.
 */

const KIND_LABEL: Record<string, string> = {
  revenue: 'Revenue',
  profit: 'Profit',
  cash_buffer: 'Cash buffer',
};

export async function GoalsWidget() {
  const res = await getAllGoalProgress();
  if (res.error) return null;
  const goals = res.data ?? [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-tactical-neon" />
          <h2 className="text-sm font-black uppercase tracking-widest text-white/60">
            Goals
          </h2>
        </div>
        <GoalsWidgetActions mode="create" />
      </div>

      {goals.length === 0 ? (
        <div className="card-tactical border-white/10 bg-white/[0.03] p-3 text-center space-y-1.5">
          <p className="text-sm font-bold text-white/70">
            No goals set yet
          </p>
          <p className="text-[10px] text-white/40">
            Set a weekly or monthly revenue, profit, or cash-buffer target and we&apos;ll
            track your progress here and in your inbox.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: GoalProgress }) {
  const pct = Math.max(0, Math.min(100, goal.progress_pct));
  const isMet = goal.on_track;
  const barColor = isMet
    ? 'bg-tactical-neon'
    : goal.progress_pct < 50
      ? 'bg-tactical-red'
      : 'bg-tactical-orange';
  return (
    <div className="card-tactical p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-blue/20 text-tactical-blue">
              {KIND_LABEL[goal.kind] ?? goal.kind}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white/50">
              {goal.period}
            </span>
            <p className="font-bold text-sm leading-tight">{goal.title}</p>
          </div>

          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-sm font-black">
              {formatCurrency(goal.current_value)}
              <span className="text-white/40 font-medium">
                {' '}/ {formatCurrency(goal.target_amount)}
              </span>
            </p>
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${
                isMet ? 'text-tactical-neon' : 'text-white/40'
              }`}
            >
              {goal.progress_pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-[10px] text-white/40 mt-1.5">
            {isMet ? (
              <span className="inline-flex items-center gap-1 text-tactical-neon">
                <Check className="w-3 h-3" />
                Target hit
              </span>
            ) : goal.days_remaining > 0 ? (
              <span className="inline-flex items-center gap-1">
                {goal.progress_pct < 50 ? (
                  <TrendingDown className="w-3 h-3 text-tactical-orange" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-tactical-blue" />
                )}
                {goal.days_remaining} day{goal.days_remaining === 1 ? '' : 's'} left
                {' · '}
                need {formatCurrency(goal.needed_per_day)}/day
              </span>
            ) : (
              <span>Period ended</span>
            )}
          </p>
        </div>
        <GoalsWidgetActions mode="deactivate" goalId={goal.id} />
      </div>
    </div>
  );
}

// Keep the Link import alive for future "view all goals" link.
void Link;
