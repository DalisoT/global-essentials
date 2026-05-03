'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createSale, getProducts, getClients, createClient } from '@/lib/actions/sales';
import { getSaleReceipt } from '@/lib/actions/receipts';
import { formatCurrency } from '@/lib/utils';
import { ReceiptModal } from '@/components/ReceiptModal';
import {
  Package,
  User,
  CreditCard,
  Clock,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product, Client } from '@/lib/appwrite-types';

export default function NewSalePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pay-slow'>('cash');
  const [installmentDuration, setInstallmentDuration] = useState(3);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  useEffect(() => {
    getProducts().then(({ data }) => data && setProducts(data));
    getClients().then(({ data }) => data && setClients(data));
  }, []);

  const handleAddClient = async () => {
    if (!newClientName || !newClientPhone) {
      toast.error('Please fill in all fields');
      return;
    }

    const { error } = await createClient(newClientName, newClientPhone);
    if (error) {
      toast.error('Failed to add client');
      return;
    }

    // Reload full client list instead of just appending
    const { data: updatedClients } = await getClients();
    if (updatedClients) {
      setClients(updatedClients as Client[]);
      // Select the newly created client (last in list alphabetically)
      const newClient = updatedClients[updatedClients.length - 1];
      setSelectedClient(newClient as Client);
    }

    setShowNewClient(false);
    setNewClientName('');
    setNewClientPhone('');
    toast.success('Client added successfully');
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedClient) {
      toast.error('Please select product and client');
      return;
    }

    setIsSubmitting(true);

    const { data: saleData, error } = await createSale({
      product_id: selectedProduct.id,
      client_id: selectedClient.id,
      payment_method: paymentMethod,
      installment_duration: paymentMethod === 'pay-slow' ? installmentDuration : undefined,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success('Sale completed successfully!');

    // Fetch receipt and show modal
    if (saleData?.id) {
      setLastSaleId(saleData.id);
      const { data: receiptHtml } = await getSaleReceipt(saleData.id);
      if (receiptHtml) {
        setReceiptHtml(receiptHtml);
        return; // Don't navigate yet, show receipt first
      }
    }

    router.push('/dashboard');
  };

  const monthlyPayment = selectedProduct
    ? Math.floor(selectedProduct.selling_price / installmentDuration)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-tactical text-tactical">NEW SALE</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            Step {step} of 3
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-tactical-blue transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-tactical-blue" />
            <h2 className="text-lg font-bold uppercase tracking-tight">
              Select Product
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  'card-tactical flex items-center justify-between hover:bg-white/5 transition-all',
                  selectedProduct?.id === product.id && 'border-tactical-blue'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
                    <Package className="w-7 h-7 text-white/40" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{product.name}</p>
                    <p className="text-xs text-white/40 uppercase tracking-wide">
                      Stock: {product.stock_level}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-black text-tactical-neon">
                  {formatCurrency(product.selling_price)}
                </p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!selectedProduct}
            className={cn(
              'w-full btn-tactical flex items-center justify-center gap-2 mt-4',
              !selectedProduct && 'opacity-50 cursor-not-allowed'
            )}
          >
            Next <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step 2: Select Client */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-tactical-blue" />
            <h2 className="text-lg font-bold uppercase tracking-tight">
              Select Client
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className={cn(
                  'card-tactical flex items-center gap-3 hover:bg-white/5 transition-all',
                  selectedClient?.id === client.id && 'border-tactical-blue'
                )}
              >
                <div className="w-12 h-12 rounded-full bg-tactical-blue/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-tactical-blue" />
                </div>
                <div className="text-left">
                  <p className="font-bold">{client.full_name}</p>
                  <p className="text-xs text-white/40">{client.phone_number}</p>
                </div>
              </button>
            ))}
          </div>

          {showNewClient ? (
            <div className="card-tactical space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-tight">New Client</h3>
                <button onClick={() => setShowNewClient(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Full Name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40"
              />
              <button onClick={handleAddClient} className="w-full btn-tactical">
                Add Client
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewClient(true)}
              className="w-full btn-tactical-secondary flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Add New Client
            </button>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 btn-tactical-secondary">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedClient}
              className={cn(
                'flex-1 btn-tactical',
                !selectedClient && 'opacity-50 cursor-not-allowed'
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment Method */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-tactical-blue" />
            <h2 className="text-lg font-bold uppercase tracking-tight">
              Payment Method
            </h2>
          </div>

          {/* Order Summary */}
          <div className="card-tactical bg-tactical-blue/10 border-tactical-blue/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">
              Order Summary
            </h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60">Product</span>
              <span className="font-semibold">{selectedProduct?.name}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60">Client</span>
              <span className="font-semibold">{selectedClient?.full_name}</span>
            </div>
            <div className="border-t border-white/10 my-3" />
            <div className="flex items-center justify-between">
              <span className="text-white/60">Total</span>
              <span className="text-2xl font-black text-tactical-neon">
                {formatCurrency(selectedProduct?.selling_price || 0)}
              </span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={cn(
                'card-tactical flex flex-col items-center gap-2 p-4 transition-all',
                paymentMethod === 'cash' && 'border-tactical-neon bg-tactical-neon/10'
              )}
            >
              <CreditCard className="w-8 h-8" />
              <span className="font-bold uppercase tracking-tight">Cash</span>
            </button>
            <button
              onClick={() => setPaymentMethod('pay-slow')}
              className={cn(
                'card-tactical flex flex-col items-center gap-2 p-4 transition-all',
                paymentMethod === 'pay-slow' && 'border-tactical-orange bg-tactical-orange/10'
              )}
            >
              <Clock className="w-8 h-8" />
              <span className="font-bold uppercase tracking-tight">Pay-Slow</span>
            </button>
          </div>

          {/* Installment Duration */}
          {paymentMethod === 'pay-slow' && (
            <div className="card-tactical space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                Select Duration
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4, 6, 8, 12].map((months) => (
                  <button
                    key={months}
                    onClick={() => setInstallmentDuration(months)}
                    className={cn(
                      'py-3 rounded-xl font-bold uppercase tracking-tight transition-all',
                      installmentDuration === months
                        ? 'bg-tactical-blue text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    )}
                  >
                    {months}mo
                  </button>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Upfront (1st month)</span>
                  <span className="font-semibold text-tactical-neon">
                    {formatCurrency(monthlyPayment)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Remaining {installmentDuration - 1} months</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyPayment)}/mo
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 btn-tactical-secondary">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                'flex-1 btn-tactical',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      )}

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
