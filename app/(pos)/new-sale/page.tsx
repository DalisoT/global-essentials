'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createSale } from '@/lib/actions/sales';
import { getSaleReceipt } from '@/lib/actions/receipts';
import { queueSale } from '@/lib/offline/sync';
import { useOffline } from '@/hooks/useOffline';
import { ReceiptModal } from '@/components/ReceiptModal';
import { POSCart } from '@/components/pos/POSCart';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { X } from 'lucide-react';
import type { Product, Client } from '@/lib/supabase-types';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const { isOnline } = useOffline();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pay-slow'>('cash');
  const [installmentDuration, setInstallmentDuration] = useState(3);
  const [showCustomPlan, setShowCustomPlan] = useState(false);
  const [customInstallments, setCustomInstallments] = useState<Array<{
    amount: number;
    dueDate: string;
    dateMode: 'calendar' | 'relative';
    relativeOption: string;
  }>>([{ amount: 0, dueDate: '', dateMode: 'calendar', relativeOption: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const total = items.reduce(
    (sum, item) => sum + item.product.selling_price * item.quantity,
    0
  );

  const handleAddProduct = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_level) {
          toast.error(`Max stock reached (${product.stock_level})`);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const handleAddCustomInstallment = () => {
    setCustomInstallments((prev) => [
      ...prev,
      { amount: 0, dueDate: new Date().toISOString().split('T')[0], dateMode: 'calendar', relativeOption: '' },
    ]);
  };

  const handleRemoveCustomInstallment = (idx: number) => {
    setCustomInstallments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCompleteSale = async () => {
    if (items.length === 0 || !selectedClient) {
      toast.error('Please add items and select a client');
      return;
    }

    setIsSubmitting(true);

    const salePayload = {
      items: items.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
      client_id: selectedClient.id,
      payment_method: paymentMethod,
      ...(showCustomPlan
        ? { installments: customInstallments.filter((inst) => inst.amount > 0).map((inst) => ({ amount_due: inst.amount, due_date: inst.dueDate })) }
        : { installment_duration: paymentMethod === 'pay-slow' ? installmentDuration : undefined }),
    };

    if (!isOnline) {
      await queueSale(salePayload);
      setIsSubmitting(false);
      toast.success('Sale saved offline. Will sync when back online.');
      router.push('/dashboard');
      return;
    }

    const { data: sales, error } = await createSale(salePayload);

    setIsSubmitting(false);

    if (error || !sales || sales.length === 0) {
      toast.error(error || 'Failed to complete sale');
      return;
    }

    toast.success('Sale completed successfully!');

    // Show receipt for first sale
    const firstSale = sales[0];
    setLastSaleId(firstSale.id);
    const { data: receiptHtml } = await getSaleReceipt(firstSale.id);
    if (receiptHtml) {
      setReceiptHtml(receiptHtml);
    } else {
      router.push('/dashboard');
    }
  };

  const addedProductIds = new Set(items.map((i) => i.product.id));

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight">New Sale</h1>
          <p className="text-xs text-white/40">
            {items.length} items · {formatTotal(total)}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ProductGrid onAddProduct={handleAddProduct} addedProductIds={addedProductIds} />
      </div>

      {/* Bottom Cart Bar */}
      {items.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="sticky bottom-20 mx-4 mb-4 p-4 rounded-2xl bg-tactical-neon flex items-center justify-between z-30 active:scale-[0.98] transition-transform"
        >
          <div className="text-left">
            <p className="text-xs text-black/60 font-semibold uppercase">View Cart</p>
            <p className="text-sm font-black text-black">{items.length} item{items.length !== 1 ? 's' : ''} · {formatTotal(total)}</p>
          </div>
          <span className="text-black font-black text-lg">→</span>
        </button>
      )}

      {/* Cart Sidebar Slide-in */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-tactical-slate z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <p className="font-bold text-white">Cart</p>
                <button onClick={() => setCartOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/60">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <POSCart
                  items={items}
                  onRemoveItem={handleRemoveItem}
                  onUpdateQuantity={handleUpdateQuantity}
                  selectedClient={selectedClient}
                  onSelectClient={setSelectedClient}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={setPaymentMethod}
                  installmentDuration={installmentDuration}
                  onInstallmentDurationChange={setInstallmentDuration}
                  showCustomPlan={showCustomPlan}
                  onShowCustomPlanChange={setShowCustomPlan}
                  customInstallments={customInstallments}
                  onCustomInstallmentsChange={setCustomInstallments}
                  onAddCustomInstallment={handleAddCustomInstallment}
                  onRemoveCustomInstallment={handleRemoveCustomInstallment}
                  onCompleteSale={handleCompleteSale}
                  isSubmitting={isSubmitting}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      {receiptHtml && (
        <ReceiptModal
          html={receiptHtml}
          onClose={() => {
            setReceiptHtml(null);
            router.push('/dashboard');
          }}
        />
      )}
    </div>
  );
}

function formatTotal(amount: number) {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}