'use client';

import { cn } from '@/lib/utils';
import type { ShippingRecommendation } from '@/lib/import/advisor-types';
import type { ShippingTypeId } from '@/lib/import/shipping-types';
import { TrendingUp, Zap, Shield } from 'lucide-react';

interface ShippingRecommenderProps {
  recommendation: ShippingRecommendation;
  onSelectMethod: (methodId: ShippingTypeId) => void;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="text-white/70 font-mono">{score}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-tactical-neon rounded-full transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function MethodCard({
  label,
  score,
  method,
  onSelect,
}: {
  label: string;
  score: ShippingRecommendation['rankings']['bestValue'];
  method: 'bestValue' | 'fastest' | 'marginSafest';
  onSelect: () => void;
}) {
  const icons = {
    bestValue: <TrendingUp className="w-4 h-4" />,
    fastest: <Zap className="w-4 h-4" />,
    marginSafest: <Shield className="w-4 h-4" />,
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all hover:border-tactical-neon/50',
        'bg-white/5 border-white/10 hover:bg-white/5'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icons[method]}
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <div className="font-bold text-tactical-neon">{score.methodName}</div>
      <div className="text-xs text-white/50 mb-3">{score.transitDays} day transit</div>
      <div className="space-y-1.5">
        <ScoreBar label="Cost" score={score.costEfficiency} />
        <ScoreBar label="Cash Flow" score={score.cashFlowTiming} />
        <ScoreBar label="Margin" score={score.marginSensitivity} />
        <ScoreBar label="Lead Time" score={score.leadTimeUrgency} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-white/40">Overall</span>
        <span className="font-bold text-tactical-neon text-sm">{score.overallScore}</span>
      </div>
    </button>
  );
}

export function ShippingRecommender({ recommendation, onSelectMethod }: ShippingRecommenderProps) {
  const { rankings, aiSummary } = recommendation;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">
          Shipping Recommender
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <MethodCard
            label="Best Value"
            score={rankings.bestValue}
            method="bestValue"
            onSelect={() => onSelectMethod(rankings.bestValue.methodId)}
          />
          <MethodCard
            label="Fastest"
            score={rankings.fastest}
            method="fastest"
            onSelect={() => onSelectMethod(rankings.fastest.methodId)}
          />
          <MethodCard
            label="Margin Safest"
            score={rankings.marginSafest}
            method="marginSafest"
            onSelect={() => onSelectMethod(rankings.marginSafest.methodId)}
          />
        </div>
      </div>
      {aiSummary && (
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <p className="text-xs text-white/60 italic">{aiSummary}</p>
        </div>
      )}
    </div>
  );
}
