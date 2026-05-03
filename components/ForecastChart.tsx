'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayForecast {
  date: string;
  dayName: string;
  confirmed: number;
  predicted: number;
  upper_bound: number;
  lower_bound: number;
}

interface CashFlowForecast {
  days: DayForecast[];
  total_confirmed: number;
  total_predicted: number;
  ai_explanation: string;
}

interface ForecastChartProps {
  forecast: CashFlowForecast;
}

export function ForecastChart({ forecast }: ForecastChartProps) {
  const data = forecast.days.map((day) => ({
    ...day,
    displayDate: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-tactical-neon" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Confirmed
            </span>
          </div>
          <p className="text-2xl font-black text-tactical-neon">
            K{forecast.total_confirmed.toFixed(2)}
          </p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-tactical-blue" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Predicted
            </span>
          </div>
          <p className="text-2xl font-black text-tactical-blue">
            K{forecast.total_predicted.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card-tactical">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">
          30-Day Cash Flow Forecast
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="confirmedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22ff66" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22ff66" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="displayDate"
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `K${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
              <Area
                type="monotone"
                dataKey="confirmed"
                stroke="#22ff66"
                fill="url(#confirmedGradient)"
                strokeWidth={2}
                name="Confirmed"
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                fill="url(#predictedGradient)"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Predicted"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Explanation */}
      {forecast.ai_explanation && (
        <div className="card-tactical bg-tactical-blue/5 border-tactical-blue/20">
          <p className="text-sm text-white/80">{forecast.ai_explanation}</p>
        </div>
      )}
    </div>
  );
}

interface MiniForecastWidgetProps {
  totalConfirmed: number;
  totalPredicted: number;
}

export function MiniForecastWidget({ totalConfirmed, totalPredicted }: MiniForecastWidgetProps) {
  const trend = totalPredicted > totalConfirmed ? 'up' : 'down';

  return (
    <div className="card-tactical">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-white/60">
          30-Day Forecast
        </p>
        <div
          className={cn(
            'flex items-center gap-1 text-xs',
            trend === 'up' ? 'text-tactical-neon' : 'text-tactical-red'
          )}
        >
          {trend === 'up' ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{trend === 'up' ? 'Growing' : 'Declining'}</span>
        </div>
      </div>
      <p className="text-2xl font-black text-tactical-blue">
        K{totalPredicted.toFixed(0)}
      </p>
      <p className="text-xs text-white/40 mt-1">
        K{totalConfirmed.toFixed(0)} confirmed + K{(totalPredicted - totalConfirmed).toFixed(0)} predicted
      </p>
    </div>
  );
}