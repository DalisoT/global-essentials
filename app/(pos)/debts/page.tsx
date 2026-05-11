'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { searchDebts, recordInstallmentPayment } from '@/lib/actions/ledger';
import { generatePaymentReminder } from '@/lib/actions/ai';
import { markSaleFullyPaid } from '@/lib/actions/sales';
import { formatCurrency, formatDateShort, isOverdue, getWhatsAppLink } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Search, Clock, CheckCircle, MessageCircle, AlertTriangle, Sparkles, Loader2, Bell, BellOff, X, DollarSign } from 'lucide-react';
import type { Installment } from '@/lib/supabase-types';
import type { Sale, Product, Client } from '@/lib/supabase-types';
import { Skeleton, EmptyState } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface DebtItem extends Installment {
  sale?: Sale & { product?: Product; client?: Client };
}

interface PaymentModalProps {
  installment: DebtItem;
  onClose: () => void;
  onRecorded: () => void;
}

function PaymentModal({ installment, onClose, onRecorded }: PaymentModalProps) {
  const [amount, setAmount] = useState(installment.amount_due.toString());
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fullAmount = installment.amount_due;
  const parsedAmount = parseFloat(amount) || 0;
  const isFull = parsedAmount >= fullAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    const { error } = await recordInstallmentPayment({
      installmentId: installment.id,
      amount: parsedAmount,
      paidAt: new Date(paidAt).toISOString(),
      note: note || undefined,
    });
    setIsSubmitting(false);
    if (error) {
      toast.error('Failed to record payment');
    } else {
      toast.success(isFull ? 'Payment recorded!' : 'Partial payment recorded');
      onRecorded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-tactical-slate rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-bold text-white">Record Payment</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 rounded-xl bg-white/5 space-y-1">
            <p className="text-xs text-white/40 font-semibold uppercase">Client</p>
            <p className="font-bold text-white">{installment.sale?.client?.full_name}</p>
            <p className="text-sm text-white/60">{installment.sale?.product?.name}</p>
          </div>

          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/40 font-semibold uppercase mb-1">Installment Due</p>
            <p className="text-xl font-black text-tactical-neon">{formatCurrency(fullAmount)}</p>
            {installment.amount_paid ? (
              <p className="text-xs text-white/40 mt-1">
                Already paid: {formatCurrency(installment.amount_paid)} · Remaining: {formatCurrency(fullAmount - installment.amount_paid)}
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Amount Received
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                max={fullAmount}
                step="0.01"
                className="w-full h-12 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-bold placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
                placeholder={`Full amount (${formatCurrency(fullAmount)})`}
              />
            </div>
            {parsedAmount < fullAmount && parsedAmount > 0 && (
              <p className="text-xs text-tactical-orange mt-1">Partial payment — remaining {formatCurrency(fullAmount - parsedAmount)}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Date Payment Was Made
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via bank transfer"
              className="w-full h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Recording...' : isFull ? 'Record Full Payment' : 'Record Partial Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [generatingReminder, setGeneratingReminder] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<DebtItem | null>(null);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDebts();
  }, [search]);

  const loadDebts = async () => {
    setIsLoading(true);
    const { data } = await searchDebts(search);
    setDebts((data || []) as DebtItem[]);
    setIsLoading(false);
  };

  const handleRecordPayment = (debt: DebtItem) => {
    setPaymentModal(debt);
  };

  const toggleSaleExpanded = (saleId: string) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const handleAiReminder = async (debt: any) => {
    setGeneratingReminder(debt.id);
    try {
      const message = await generatePaymentReminder({
        clientName: debt.sale?.client?.full_name || 'Customer',
        amount: debt.amount_due,
        dueDate: debt.due_date,
        productName: debt.sale?.product?.name,
      });
      const phone = debt.sale?.client?.phone_number || '';
      window.open(getWhatsAppLink(phone, message), '_blank');
    } catch (error) {
      toast.error('Failed to generate reminder');
    } finally {
      setGeneratingReminder(null);
    }
  };

  const sendReminder = (phone: string, clientName: string, amount: number, dueDate: string) => {
    const message = `Hi ${clientName}, this is a reminder that payment of ${formatCurrency(amount)} is due on ${formatDateShort(dueDate)}. Please arrange payment at your earliest convenience. - Global Essentials`;
    window.open(getWhatsAppLink(phone, message), '_blank');
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + d.amount_due, 0);
  const overdueCount = debts.filter((d) => isOverdue(d.due_date)).length;
  const { permission, requestPermission, scheduleReminders, isEnabled, isScheduling } = usePushNotifications();

  const handleEnableNotifications = async () => {
    if (permission === 'denied') {
      toast.error('Notifications blocked in browser settings');
      return;
    }
    const granted = await requestPermission();
    if (granted) {
      // Schedule reminders for all current debts
      const installmentData = debts.map((d) => ({
        id: d.id,
        amount_due: d.amount_due,
        due_date: d.due_date,
        client_name: d.sale?.client?.full_name || 'Customer',
        product_name: d.sale?.product?.name || '',
      }));
      await scheduleReminders(installmentData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-tactical text-tactical">DEBTS</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            Collect Outstanding Payments
          </p>
        </div>
        <button
          onClick={handleEnableNotifications}
          disabled={isScheduling || isEnabled}
          className={`p-3 rounded-xl transition-colors ${
            isEnabled
              ? 'bg-tactical-neon/20 text-tactical-neon'
              : 'bg-tactical-blue/10 hover:bg-tactical-blue/20 text-tactical-blue'
          } disabled:opacity-50`}
          title={isEnabled ? 'Notifications enabled' : 'Enable payment reminders'}
        >
          {isEnabled ? (
            <Bell className="w-5 h-5" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search by client name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-tactical-orange" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Outstanding
            </span>
          </div>
          <p className="text-xl font-black text-tactical-orange">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
        <div className="card-tactical border-tactical-red/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-tactical-red" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Overdue
            </span>
          </div>
          <p className="text-xl font-black text-tactical-red">{overdueCount}</p>
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
          Unpaid Installments
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-tactical">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : debts.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="All debts cleared!"
            description="No outstanding payments to collect"
          />
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => {
              const overdue = isOverdue(debt.due_date);
              const clientPhone = debt.sale?.client?.phone_number || '';
              const clientName = debt.sale?.client?.full_name || '';

              return (
                <div
                  key={debt.id}
                  className={`card-tactical ${
                    overdue ? 'border-tactical-red bg-tactical-red/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          overdue ? 'bg-tactical-red/20' : 'bg-tactical-orange/20'
                        }`}
                      >
                        <Clock
                          className={`w-6 h-6 ${
                            overdue ? 'text-tactical-red' : 'text-tactical-orange'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-bold">{clientName}</p>
                        <p className="text-sm text-white/40">
                          {debt.sale?.product?.name}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-xl font-black ${
                        overdue ? 'text-tactical-red' : 'text-tactical-orange'
                      }`}
                    >
                      {formatCurrency(debt.amount_due)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                          overdue
                            ? 'bg-tactical-red/20 text-tactical-red'
                            : 'bg-white/5 text-white/60'
                        }`}
                      >
                        {overdue ? 'Overdue' : 'Due'} {formatDateShort(debt.due_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAiReminder(debt)}
                        disabled={generatingReminder === debt.id}
                        className="p-3 rounded-xl bg-tactical-blue/10 hover:bg-tactical-blue/20 text-tactical-blue transition-colors disabled:opacity-50"
                        title="AI Generate Reminder"
                      >
                        {generatingReminder === debt.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          sendReminder(clientPhone, clientName, debt.amount_due, debt.due_date)
                        }
                        className="p-3 rounded-xl bg-tactical-neon/10 hover:bg-tactical-neon/20 text-tactical-neon transition-colors"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRecordPayment(debt)}
                        className="p-3 rounded-xl bg-tactical-neon/10 hover:bg-tactical-neon/20 text-tactical-neon transition-colors"
                        title="Record Payment"
                      >
                        <DollarSign className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal
          installment={paymentModal}
          onClose={() => setPaymentModal(null)}
          onRecorded={loadDebts}
        />
      )}
    </div>
  );
}
