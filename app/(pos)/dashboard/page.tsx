import Link from 'next/link';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import type { Sale, Product, Installment, Client } from '@/lib/supabase-types';

type SaleWithProductAndClient = Sale & { product?: Product; client?: Client };
type InstallmentWithSaleAndClient = Installment & { sale?: Sale & { client?: Client } };

export default async function DashboardPage() {
  const result = await getDashboardStats();
  const stats = result.data;

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-white/60">Failed to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl text-tactical text-tactical">GLOBAL ESSENTIALS</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">
          Ground Truth Overview
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Ground Truth Card */}
        <div className="card-tactical col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-tactical-blue/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                Ground Truth
              </span>
              <TrendingUp className="w-5 h-5 text-tactical-neon" />
            </div>
            <p className="text-4xl font-black tracking-tighter text-tactical-neon animate-count">
              {formatCurrency(stats.groundTruth)}
            </p>
            <p className="text-xs text-white/40 mt-2 uppercase tracking-wide">
              Paid Sales − Expenses
            </p>
          </div>
        </div>

        {/* In Pipeline Card */}
        <div className="card-tactical relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-tactical-orange/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-tactical-orange" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                In Pipeline
              </span>
            </div>
            <p className="text-2xl font-black tracking-tighter text-tactical-orange">
              {formatCurrency(stats.inPipeline)}
            </p>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
              Unpaid Installments
            </p>
          </div>
        </div>

        {/* Low Stock Alert Card */}
        <Link href="/inventory" className="card-tactical relative overflow-hidden hover:bg-white/5 transition-colors">
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-tactical-red/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-tactical-red" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                Low Stock
              </span>
            </div>
            <p className="text-2xl font-black tracking-tighter text-tactical-red">
              {stats.lowStockProducts.length}
            </p>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
              Items Need Restock
            </p>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/new-sale"
            className="btn-tactical flex items-center justify-center gap-2"
          >
            <DollarSign className="w-5 h-5" />
            New Sale
          </Link>
          <Link
            href="/debts"
            className="btn-tactical-secondary flex items-center justify-center gap-2"
          >
            <Clock className="w-5 h-5" />
            Collect
          </Link>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Recent Sales
          </h2>
          <Link
            href="/ledger"
            className="text-xs font-semibold text-tactical-blue uppercase tracking-wide flex items-center gap-1"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="card-tactical divide-y divide-white/5">
          {stats.recentSales.length === 0 ? (
            <p className="text-center text-white/40 py-8 text-sm uppercase tracking-wide">
              No sales yet
            </p>
          ) : (
            stats.recentSales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-tactical-blue/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-tactical-blue" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{sale.product?.name}</p>
                    <p className="text-xs text-white/40">
                      {sale.client?.full_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm">
                    {formatCurrency(sale.total_amount)}
                  </p>
                  <span
                    className={`text-xs uppercase tracking-wide ${
                      sale.payment_status === 'paid'
                        ? 'text-tactical-neon'
                        : 'text-tactical-orange'
                    }`}
                  >
                    {sale.payment_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upcoming Installments */}
      {stats.upcomingInstallments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Upcoming Dues
          </h2>
          <div className="card-tactical divide-y divide-white/5">
            {stats.upcomingInstallments.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-tactical-orange/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-tactical-orange" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {inst.sale?.client?.full_name}
                    </p>
                    <p className="text-xs text-white/40">
                      Due: {new Date(inst.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="font-black text-sm text-tactical-orange">
                  {formatCurrency(inst.amount_due)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
