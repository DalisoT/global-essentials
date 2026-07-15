'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Trash2, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  createGoal,
  deactivateGoal,
} from '@/lib/actions/goals';

/**
 * GoalsWidgetActions (Phase 9 / 9.5).
 *
 * Two modes:
 *   - 'create'  → "+ New goal" button that opens an inline form
 *                 with kind / period / target_amount / title.
 *   - 'deactivate' → small trash button that soft-deletes the
 *                 goal (sets is_active=false). We keep history
 *                 for the briefing.
 */

interface BaseProps {
  mode: 'create' | 'deactivate';
}

interface CreateProps extends BaseProps {
  mode: 'create';
}

interface DeactivateProps extends BaseProps {
  mode: 'deactivate';
  goalId: string;
}

type Props = CreateProps | DeactivateProps;

export function GoalsWidgetActions(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (props.mode === 'deactivate') {
    const goalId = props.goalId;
    const remove = () => {
      if (isPending) return;
      startTransition(async () => {
        const res = await deactivateGoal(goalId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success('Goal removed');
        router.refresh();
      });
    };
    return (
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="shrink-0 p-1 rounded-md bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-50"
        title="Remove goal"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
      </button>
    );
  }

  // mode === 'create'
  return <CreateGoalForm isPending={isPending} onAfter={() => router.refresh()} />;
}

function CreateGoalForm({
  isPending,
  onAfter,
}: {
  isPending: boolean;
  onAfter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'revenue' | 'profit' | 'cash_buffer'>('revenue');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [localPending, startTransition] = useTransition();
  const pending = isPending || localPending;

  function submit() {
    const amount = Number(target);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a target amount greater than 0');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the goal a short name');
      return;
    }
    startTransition(async () => {
      const res = await createGoal({
        kind,
        period,
        target_amount: amount,
        title: title.trim(),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Goal saved');
      setOpen(false);
      setTarget('');
      setTitle('');
      onAfter();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-tactical-blue/15 border border-tactical-blue/30 text-[10px] font-black uppercase tracking-widest text-tactical-blue hover:bg-tactical-blue/25 transition-colors"
      >
        <Plus className="w-3 h-3" />
        New goal
      </button>
    );
  }

  return (
    <div className="card-tactical border-tactical-blue/30 p-3 space-y-2.5 w-full">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-tactical-blue" />
        <p className="text-xs font-black uppercase tracking-widest text-white/70">
          New goal
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto p-1 rounded text-white/40 hover:text-white/70"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FieldGroup label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="select-tactical w-full text-xs"
          >
            <option value="revenue">Revenue</option>
            <option value="profit">Profit</option>
            <option value="cash_buffer">Cash buffer</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Period">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="select-tactical w-full text-xs"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="Name (e.g. July revenue)">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="July revenue"
          className="input-tactical w-full text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Target amount (K)">
        <input
          type="number"
          min="0"
          step="100"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="5000"
          className="input-tactical w-full text-sm"
        />
      </FieldGroup>

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className={cn(
          'btn-tactical w-full flex items-center justify-center gap-2',
          isPending && 'opacity-50'
        )}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
        Save goal
      </button>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}
