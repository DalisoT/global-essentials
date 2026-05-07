'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getSalesHistory } from '@/lib/actions/ledger';
import { deleteSale, editSale } from '@/lib/actions/sales';
import { getSaleReceipt } from '@/lib/actions/receipts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, DollarSign, BookOpen, Pencil, Trash2, X, ChevronLeft, ChevronRight, Receipt, Send, Phone } from 'lucide-react';
import type { Sale, Product, Client } from '@/lib/supabase-types';
import { Skeleton, SkeletonTable, EmptyState } from '@/components/ui/Skeleton';
import { ReceiptModal } from '@/components/ReceiptModal';
import { ClientQuickActions } from '@/components/ClientQuickActions';

export default function LedgerPage() {
  const [sales, setSales] = useState<(Sale & { product?: Product; client?: Client })[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingSale, setEditingSale] = useState<(Sale & { product?: Product; client?: Client }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [quickActionsClient, setQuickActionsClient] = useState<{ id: string; full_name: string; phone_number: string; saleId?: string; saleAmount?: number } | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadSales();
  }, [page]);

  const loadSales = async () => {
    setIsLoading(true);
    const offset = (page - 1) * PAGE_SIZE;
    const { data, count } = await getSalesHistory(search, { limit: PAGE_SIZE, offset });
    setSales(data || []);
    setTotalCount(count || 0);
    setIsLoading(false);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);

  const totalSales = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction? Stock will be restored.')) return;
    const { error } = await deleteSale(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Transaction deleted');
      loadSales();
    }
  };

  const handleEdit = async () => {
    if (!editingSale) return;
    setIsSubmitting(true);
    const { error } = await editSale(editingSale.id, {
      payment_status: editingSale.payment_status,
      payment_method: editingSale.payment_method,
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Transaction updated');
      setEditingSale(null);
      loadSales();
    }
  };

  const handleViewReceipt = async (saleId: string) => {
    const { data } = await getSaleReceipt(saleId);
    if (data) {
      setReceiptHtml(data);
      setViewingReceipt(saleId);
    } else {
      toast.error('Failed to load receipt');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-tactical text-tactical">LEDGER</h1>
        <p className="text-white/60 text-sm uppercase tracking-wider">
          Transaction History
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search by product or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-tactical-neon" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Total Sales
            </span>
          </div>
          <p className="text-xl font-black text-tactical-neon">
            {formatCurrency(totalSales)}
          </p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-tactical-blue" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Transactions
            </span>
          </div>
          <p className="text-xl font-black text-tactical-blue">{totalCount}</p>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-white/50">
            {showingFrom}-{showingTo} of {totalCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sales List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
          All Transactions
        </h2>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Sales you make will appear here"
          />
        ) : (
          <div className="card-tactical divide-y divide-white/5">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between gap-2 py-4 first:pt-0 last:pb-0 min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      sale.payment_status === 'paid'
                        ? 'bg-tactical-neon/20'
                        : 'bg-tactical-orange/20'
                    }`}
                  >
                    <DollarSign
                      className={`w-5 h-5 ${
                        sale.payment_status === 'paid'
                          ? 'text-tactical-neon'
                          : 'text-tactical-orange'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{sale.product?.name}</p>
                    <p className="text-xs text-white/40 truncate">
                      {sale.client?.full_name}
                    </p>
                    <p className="text-xs text-white/30">
                      {formatDate(sale.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-black">
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => sale.client?.id && sale.client?.phone_number && setQuickActionsClient({ id: sale.client.id, full_name: sale.client.full_name, phone_number: sale.client.phone_number, saleId: sale.id, saleAmount: sale.total_amount })}
                      className="p-1.5 rounded-lg bg-tactical-neon/10 hover:bg-tactical-neon/20 text-tactical-neon shrink-0"
                      title="Contact Client"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleViewReceipt(sale.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white shrink-0"
                      title="View Receipt"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingSale(sale)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sale.id)}
                      className="p-1.5 rounded-lg bg-tactical-red/10 hover:bg-tactical-red/20 text-tactical-red shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Quick Actions */}
      {quickActionsClient && (
        <ClientQuickActions
          client={quickActionsClient}
          saleId={quickActionsClient.saleId}
          saleAmount={quickActionsClient.saleAmount}
          onClose={() => setQuickActionsClient(null)}
        />
      )}

      {/* Edit Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-tactical-slate rounded-t-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">Edit Transaction</h2>
              <button onClick={() => setEditingSale(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Product</p>
                <p className="font-semibold">{editingSale.product?.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Client</p>
                <p className="font-semibold">{editingSale.client?.full_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2">Amount</p>
                <p className="font-black text-tactical-neon">{formatCurrency(editingSale.total_amount)}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Payment Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['paid', 'pending'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setEditingSale({ ...editingSale, payment_status: status })}
                      className={`py-3 rounded-xl text-sm font-bold uppercase transition-all ${
                        editingSale.payment_status === status
                          ? status === 'paid'
                            ? 'bg-tactical-neon text-black'
                            : 'bg-tactical-orange text-black'
                          : 'bg-white/5 text-white/60'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'pay-slow'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setEditingSale({ ...editingSale, payment_method: method })}
                      className={`py-3 rounded-xl text-sm font-bold uppercase transition-all ${
                        editingSale.payment_method === method
                          ? 'bg-tactical-blue text-white'
                          : 'bg-white/5 text-white/60'
                      }`}
                    >
                      {method === 'cash' ? 'Cash' : 'Pay Slow'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleEdit}
              disabled={isSubmitting}
              className="w-full btn-tactical h-14 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Update Transaction'}
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptHtml && viewingReceipt && (
        <ReceiptModal
          html={receiptHtml}
          onClose={() => {
            setReceiptHtml(null);
            setViewingReceipt(null);
          }}
        />
      )}
    </div>
  );
}
