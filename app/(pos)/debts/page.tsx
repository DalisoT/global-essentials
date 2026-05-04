'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { searchDebts, markInstallmentPaid } from '@/lib/actions/ledger';
import { generatePaymentReminder } from '@/lib/actions/ai';
import { formatCurrency, formatDateShort, isOverdue, getWhatsAppLink } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Search, Clock, CheckCircle, MessageCircle, AlertTriangle, Sparkles, Loader2, Bell, BellOff } from 'lucide-react';
import type { Installment } from '@/lib/supabase-types';
import type { Sale, Product, Client } from '@/lib/supabase-types';

export default function DebtsPage() {
  const [debts, setDebts] = useState<(Installment & { sale?: Sale & { product?: Product; client?: Client } })[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [generatingReminder, setGeneratingReminder] = useState<string | null>(null);

  useEffect(() => {
    loadDebts();
  }, [search]);

  const loadDebts = async () => {
    setIsLoading(true);
    const { data } = await searchDebts(search);
    setDebts(data || []);
    setIsLoading(false);
  };

  const handleMarkPaid = async (installmentId: string) => {
    const { error } = await markInstallmentPaid(installmentId);
    if (error) {
      toast.error('Failed to mark as paid');
    } else {
      toast.success('Payment recorded!');
      loadDebts();
    }
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
          <div className="card-tactical py-8 text-center text-white/40">
            Loading...
          </div>
        ) : debts.length === 0 ? (
          <div className="card-tactical py-8 text-center text-white/40">
            All debts cleared!
          </div>
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
                        onClick={() => handleMarkPaid(debt.id)}
                        className="p-3 rounded-xl bg-tactical-neon/10 hover:bg-tactical-neon/20 text-tactical-neon transition-colors"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
