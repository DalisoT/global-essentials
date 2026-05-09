'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient, getClients } from '@/lib/actions/sales';
import { formatCurrency } from '@/lib/utils';
import {
  User,
  Plus,
  X,
  CreditCard,
  Clock,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client, Product } from '@/lib/supabase-types';

interface CartItem {
  product: Product;
  quantity: number;
}

interface POSCartProps {
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  paymentMethod: 'cash' | 'pay-slow';
  onPaymentMethodChange: (method: 'cash' | 'pay-slow') => void;
  installmentDuration: number;
  onInstallmentDurationChange: (months: number) => void;
  showCustomPlan: boolean;
  onShowCustomPlanChange: (show: boolean) => void;
  customInstallments: Array<{
    amount: number;
    dueDate: string;
    dateMode: 'calendar' | 'relative';
    relativeOption: string;
  }>;
  onCustomInstallmentsChange: (inst: Array<{
    amount: number;
    dueDate: string;
    dateMode: 'calendar' | 'relative';
    relativeOption: string;
  }>) => void;
  onAddCustomInstallment: () => void;
  onRemoveCustomInstallment: (idx: number) => void;
  onCompleteSale: () => void;
  isSubmitting: boolean;
}

export function POSCart({
  items,
  onRemoveItem,
  onUpdateQuantity,
  selectedClient,
  onSelectClient,
  paymentMethod,
  onPaymentMethodChange,
  installmentDuration,
  onInstallmentDurationChange,
  showCustomPlan,
  onShowCustomPlanChange,
  customInstallments,
  onCustomInstallmentsChange,
  onAddCustomInstallment,
  onRemoveCustomInstallment,
  onCompleteSale,
  isSubmitting,
}: POSCartProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const total = items.reduce(
    (sum, item) => sum + item.product.selling_price * item.quantity,
    0
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const monthlyPayment =
    installmentDuration > 0 ? Math.floor(total / installmentDuration) : 0;

  const filteredClients = clients.filter(
    (c) =>
      !clientSearch ||
      c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone_number.includes(clientSearch)
  );

  const loadClients = async () => {
    const { data } = await getClients();
    if (data) setClients(data as Client[]);
    setShowClientSearch(true);
  };

  const handleAddClient = async () => {
    if (!newClientName || !newClientPhone) {
      toast.error('Please fill in all fields');
      return;
    }
    const { data, error } = await createClient(newClientName, newClientPhone);
    if (error || !data) {
      toast.error('Failed to add client');
      return;
    }
    setClients((prev) => [...prev, data as Client]);
    onSelectClient(data as Client);
    setShowNewClient(false);
    setShowClientSearch(false);
    setNewClientName('');
    setNewClientPhone('');
    toast.success('Client added');
  };

  const getCustomTotal = () =>
    customInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);

  const canSubmit =
    items.length > 0 && selectedClient && total > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold uppercase tracking-wide text-white/60">
            Cart
          </span>
          <span className="text-xs text-white/40">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <p className="text-2xl font-black text-tactical-neon">
          {formatCurrency(total)}
        </p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm uppercase tracking-wide">
              Tap products to add
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-2 p-2 bg-white/5 rounded-xl"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {item.product.name}
                </p>
                <p className="text-xs text-tactical-neon">
                  {formatCurrency(item.product.selling_price)} each
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    onUpdateQuantity(
                      item.product.id,
                      item.quantity - 1
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold hover:bg-white/20"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-bold">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    onUpdateQuantity(
                      item.product.id,
                      item.quantity + 1
                    )
                  }
                  disabled={
                    item.quantity >= item.product.stock_level
                  }
                  className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold hover:bg-white/20 disabled:opacity-30"
                >
                  +
                </button>
                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-tactical-red/20 hover:text-tactical-red ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Client Selector */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">
          Client
        </p>
        {showClientSearch ? (
          <div className="space-y-2">
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredClients.slice(0, 5).map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    onSelectClient(client);
                    setShowClientSearch(false);
                    setClientSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all',
                    selectedClient?.id === client.id
                      ? 'bg-tactical-blue/20 text-white'
                      : 'text-white/60 hover:bg-white/10'
                  )}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="truncate">{client.full_name}</span>
                  <span className="text-xs text-white/40 ml-auto">
                    {client.phone_number}
                  </span>
                </button>
              ))}
            </div>
            {showNewClient ? (
              <div className="space-y-2 p-2 bg-white/5 rounded-lg">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full h-9 px-3 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowNewClient(false);
                      setNewClientName('');
                      setNewClientPhone('');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddClient}
                    className="flex-1 py-1.5 rounded-lg bg-tactical-blue text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewClient(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/20 text-white/40 text-xs hover:border-white/40 hover:text-white/60 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Client
              </button>
            )}
            <button
              onClick={() => {
                setShowClientSearch(false);
                setClientSearch('');
              }}
              className="w-full py-1 text-xs text-white/30 hover:text-white/50"
            >
              Cancel
            </button>
          </div>
        ) : selectedClient ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-tactical-blue" />
              <span className="text-sm font-semibold truncate max-w-[120px]">
                {selectedClient.full_name}
              </span>
            </div>
            <button
              onClick={loadClients}
              className="text-xs text-tactical-blue hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            onClick={loadClients}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:border-white/40 hover:text-white/60 transition-all text-sm"
          >
            <User className="w-4 h-4" />
            Select Client
          </button>
        )}
      </div>

      {/* Payment Method */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">
          Payment
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPaymentMethodChange('cash')}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all',
              paymentMethod === 'cash'
                ? 'bg-tactical-neon text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            <CreditCard className="w-4 h-4" />
            Cash
          </button>
          <button
            onClick={() => onPaymentMethodChange('pay-slow')}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all',
              paymentMethod === 'pay-slow'
                ? 'bg-tactical-orange text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            <Clock className="w-4 h-4" />
            Pay-Slow
          </button>
        </div>

        {/* Installment options for pay-slow */}
        {paymentMethod === 'pay-slow' && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {[2, 3, 4, 6].map((mo) => (
                <button
                  key={mo}
                  onClick={() => {
                    onInstallmentDurationChange(mo);
                    onShowCustomPlanChange(false);
                  }}
                  className={cn(
                    'py-2 rounded-lg font-bold text-xs transition-all',
                    installmentDuration === mo && !showCustomPlan
                      ? 'bg-tactical-blue text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  )}
                >
                  {mo}mo
                </button>
              ))}
            </div>

            {!showCustomPlan && (
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-xs text-white/40">
                  {formatCurrency(monthlyPayment)}/mo
                </p>
              </div>
            )}

            <button
              onClick={() => {
                onInstallmentDurationChange(0);
                onShowCustomPlanChange(true);
              }}
              className={cn(
                'w-full py-2 rounded-lg font-bold text-xs transition-all',
                showCustomPlan
                  ? 'border border-tactical-purple bg-tactical-purple/10 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              Custom Plan
            </button>

            {/* Custom plan builder */}
            {showCustomPlan && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {customInstallments.map((inst, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <span className="text-[10px] text-white/30 w-4">#{idx + 1}</span>
                    <input
                      type="number"
                      value={inst.amount || ''}
                      onChange={(e) => {
                        const updated = [...customInstallments];
                        updated[idx].amount = parseFloat(e.target.value) || 0;
                        onCustomInstallmentsChange(updated);
                      }}
                      className="flex-1 h-8 px-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                      placeholder="K"
                    />
                    <input
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => {
                        const updated = [...customInstallments];
                        updated[idx].dueDate = e.target.value;
                        onCustomInstallmentsChange(updated);
                      }}
                      className="h-8 px-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                    />
                    {customInstallments.length > 2 && (
                      <button
                        onClick={() => onRemoveCustomInstallment(idx)}
                        className="p-1 text-white/30 hover:text-tactical-red"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={onAddCustomInstallment}
                  className="w-full py-1.5 border border-dashed border-white/20 rounded-lg text-white/30 text-xs hover:border-white/40 hover:text-white/50"
                >
                  + Add Installment
                </button>
                <div
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg text-xs',
                    getCustomTotal() === total
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  )}
                >
                  <span>Total</span>
                  <span className="font-bold">
                    {formatCurrency(getCustomTotal())} / {formatCurrency(total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Complete Sale Button */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={onCompleteSale}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            'w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2',
            canSubmit && !isSubmitting
              ? 'bg-tactical-neon text-black hover:bg-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            'Processing...'
          ) : (
            <>
              <Check className="w-5 h-5" />
              Complete Sale
            </>
          )}
        </button>
      </div>
    </div>
  );
}