'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getAnalyticsData } from '@/lib/actions/analytics';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { formatCurrency } from '@/lib/utils';
import { Sparkles, Send, Loader2, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

const COLORS = ['#3b82f6', '#22ff66', '#f97316', '#ef4444', '#a855f7', '#ec4899'];

import type { DashboardStats } from '@/lib/supabase-types';
import { Skeleton, EmptyState } from '@/components/ui/Skeleton';

interface AnalyticsData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueByDay: { date: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  topProducts: { id: string; name: string; count: number; revenue: number }[];
  monthlyData: { month: string; revenue: number; expenses: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [analyticsResult, dashboardStats] = await Promise.all([
      getAnalyticsData(),
      getDashboardStats(),
    ]);
    // getAnalyticsData returns AnalyticsData on success, or { data: null, error: string } on failure
    if ('totalRevenue' in analyticsResult) {
      setData(analyticsResult);
    } else {
      setData(null);
    }
    // getDashboardStats returns { data?: DashboardStats; error?: string }
    if (dashboardStats.data) {
      setStats(dashboardStats.data);
    }
    setIsLoading(false);
  };

  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    setAiResponse(null);

    try {
      const response = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery,
          data: {
            totalRevenue: data?.totalRevenue || 0,
            totalExpenses: data?.totalExpenses || 0,
            netProfit: data?.netProfit || 0,
            topProducts: data?.topProducts || [],
            revenueByDay: data?.revenueByDay || [],
            groundTruth: stats?.groundTruth || 0,
            inPipeline: stats?.inPipeline || 0,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAiResponse(result.response);
      } else {
        toast.error(result.error || 'AI query failed');
      }
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setIsAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState icon={TrendingUp} title="No data available" description="Make some sales to see analytics" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-tactical text-tactical">ANALYTICS</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">Revenue & Performance</p>
      </div>

      {/* AI Natural Language Query */}
      <div className="card-tactical border-tactical-blue/30">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-tactical-blue" />
          <h3 className="text-sm font-bold uppercase tracking-wider">AI Analytics</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
            placeholder="Ask: 'Which product made the most money?' or 'What was our profit this month?'"
            className="flex-1 h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 text-sm"
          />
          <button
            onClick={handleAiQuery}
            disabled={isAiLoading || !aiQuery.trim()}
            className="btn-tactical px-4 disabled:opacity-50"
          >
            {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {aiResponse && (
          <div className="mt-4 p-4 bg-white/5 rounded-xl">
            <p className="text-sm text-white/90 whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Revenue</span>
          </div>
          <p className="text-xl font-black text-tactical-neon">{formatCurrency(data.totalRevenue)}</p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Expenses</span>
          </div>
          <p className="text-xl font-black text-tactical-red">{formatCurrency(data.totalExpenses)}</p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Net Profit</span>
          </div>
          <p className={`text-xl font-black ${data.netProfit >= 0 ? 'text-tactical-neon' : 'text-tactical-red'}`}>
            {formatCurrency(data.netProfit)}
          </p>
        </div>
      </div>

      {/* Revenue Chart - Last 7 Days */}
      <div className="card-tactical">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">Revenue (Last 7 Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/10" />
              <XAxis dataKey="date" stroke="#ffffff/40" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} />
              <YAxis stroke="#ffffff/40" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Line type="monotone" dataKey="amount" stroke="#22ff66" strokeWidth={3} dot={{ fill: '#22ff66', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Expenses by Category */}
        <div className="card-tactical">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">Expenses by Category</h3>
          {data.expensesByCategory.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {data.expensesByCategory.map((entry: any, index: number) => (
                        <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {data.expensesByCategory.map((entry: any, index: number) => (
                  <div key={entry.category} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-white/60">{entry.category}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-white/40 py-8">No expense data</p>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="card-tactical">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">Top Selling Products</h3>
          {data.topProducts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/10" horizontal={false} />
                  <XAxis type="number" stroke="#ffffff/40" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#ffffff/40" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    formatter={(value: number) => [value, 'Units Sold']}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-white/40 py-8">No sales data</p>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="card-tactical">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">Monthly Revenue vs Expenses</h3>
        {data.monthlyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/10" />
                <XAxis dataKey="month" stroke="#ffffff/40" fontSize={12} tickFormatter={(v) => v} />
                <YAxis stroke="#ffffff/40" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Expenses']}
                />
                <Bar dataKey="revenue" fill="#22ff66" name="revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-white/40 py-8">No monthly data</p>
        )}
      </div>
    </div>
  );
}