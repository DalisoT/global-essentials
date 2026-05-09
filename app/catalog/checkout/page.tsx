'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import { createOrder } from '@/lib/actions/catalog-orders';
import { formatCurrency } from '@/lib/utils';
import { getWhatsAppLink } from '@/lib/utils';
import { Loader2, Check, Truck, MapPin, User, Phone, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type CheckoutStep = 'info' | 'shipping' | 'review';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getSubtotal, clearCart } = useCartStore();
  const [step, setStep] = useState<CheckoutStep>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<'standard' | 'express'>('standard');
  const [notes, setNotes] = useState('');

  const subtotal = getSubtotal();
  const deliveryCost = deliveryOption === 'express' ? 150 : 75;
  const total = subtotal + deliveryCost;

  useEffect(() => {
    if (items.length === 0) {
      router.push('/catalog');
    }
  }, [items, router]);

  const handleSubmitOrder = async () => {
    if (!customerName || !customerPhone || !shippingAddress || !shippingCity || !shippingProvince) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    const { data: order, error } = await createOrder({
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      shippingCost: deliveryCost,
      shippingMethod: deliveryOption === 'express' ? 'Express Delivery' : 'Standard Delivery',
      shippingAddress,
      shippingCity,
      shippingProvince,
      shippingPostalCode: shippingPostalCode || undefined,
      notes: notes || undefined,
    });

    setIsSubmitting(false);

    if (error || !order) {
      toast.error(error || 'Failed to create order');
      return;
    }

    clearCart();

    const whatsappMessage = `Hi! I've placed order ${order.order_number}.

Order Summary:
${items.map((i) => `• ${i.name} x${i.quantity} = ${formatCurrency(i.price * i.quantity)}`).join('\n')}

Total: ${formatCurrency(total)}
Delivery to: ${shippingCity}, ${shippingProvince}

I'll pay on delivery. Please confirm!`;

    router.push(`/catalog/order/${order.id}`);
    window.open(getWhatsAppLink(customerPhone.replace(/\D/g, ''), whatsappMessage), '_blank');
  };

  const canProceedInfo = customerName.trim() && customerPhone.trim();
  const canProceedShipping = shippingAddress.trim() && shippingCity.trim() && shippingProvince.trim();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <Link href="/catalog" className="text-white/60 hover:text-white text-sm">
            ← Back to Catalog
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-2xl font-black mb-6">Checkout</h1>

        <div className="flex items-center gap-2 mb-8">
          {(['info', 'shipping', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                  step === s ? 'bg-tactical-neon text-black' :
                    ['info', 'shipping', 'review'].indexOf(step) > i ? 'bg-green-500 text-black' :
                    'bg-white/10 text-white/40'
                )}
              >
                {['info', 'shipping', 'review'].indexOf(step) > i ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-white/10" />}
            </div>
          ))}
        </div>

        {step === 'info' && (
          <div className="space-y-6">
            <div className="card-tactical space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-tactical-blue" />
                Your Information
              </h2>

              <div>
                <label className="block text-sm text-white/60 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Chanda Mwansa"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">WhatsApp Number *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0977123456"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                />
                <p className="text-xs text-white/40 mt-1">We&apos;ll send order updates via WhatsApp</p>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="chanda@email.com"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                />
              </div>
            </div>

            <button
              onClick={() => setStep('shipping')}
              disabled={!canProceedInfo}
              className="w-full py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg hover:bg-white transition-all disabled:opacity-50"
            >
              Continue to Delivery
            </button>
          </div>
        )}

        {step === 'shipping' && (
          <div className="space-y-6">
            <div className="card-tactical space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-tactical-blue" />
                Delivery Address
              </h2>

              <div>
                <label className="block text-sm text-white/60 mb-2">Street Address *</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="123 Mulungushi Street"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">City/Town *</label>
                  <input
                    type="text"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="Lusaka"
                    className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Province *</label>
                  <select
                    value={shippingProvince}
                    onChange={(e) => setShippingProvince(e.target.value)}
                    className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-tactical-neon"
                  >
                    <option value="">Select...</option>
                    <option value="Lusaka">Lusaka</option>
                    <option value="Copperbelt">Copperbelt</option>
                    <option value="Central">Central</option>
                    <option value="Southern">Southern</option>
                    <option value="Northern">Northern</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Luapula">Luapula</option>
                    <option value="Muchinga">Muchinga</option>
                    <option value="North-Western">North-Western</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Postal Code</label>
                <input
                  type="text"
                  value={shippingPostalCode}
                  onChange={(e) => setShippingPostalCode(e.target.value)}
                  placeholder="10101"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Delivery Option</label>
                <div className="space-y-2">
                  <label
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all',
                      deliveryOption === 'standard'
                        ? 'border-tactical-neon bg-tactical-neon/10'
                        : 'border-white/10 hover:border-white/30'
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryOption === 'standard'}
                      onChange={() => setDeliveryOption('standard')}
                      className="sr-only"
                    />
                    <Truck className="w-6 h-6 text-tactical-blue" />
                    <div className="flex-1">
                      <p className="font-bold">Standard Delivery</p>
                      <p className="text-sm text-white/60">3-5 business days</p>
                    </div>
                    <span className="font-black text-tactical-neon">{formatCurrency(75)}</span>
                  </label>
                  <label
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all',
                      deliveryOption === 'express'
                        ? 'border-tactical-neon bg-tactical-neon/10'
                        : 'border-white/10 hover:border-white/30'
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryOption === 'express'}
                      onChange={() => setDeliveryOption('express')}
                      className="sr-only"
                    />
                    <Package className="w-6 h-6 text-tactical-blue" />
                    <div className="flex-1">
                      <p className="font-bold">Express Delivery</p>
                      <p className="text-sm text-white/60">Next business day</p>
                    </div>
                    <span className="font-black text-tactical-neon">{formatCurrency(150)}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Order Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 resize-none focus:outline-none focus:border-tactical-neon"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('info')}
                className="flex-1 py-4 rounded-2xl border border-white/20 text-white/70 font-bold hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!canProceedShipping}
                className="flex-1 py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg hover:bg-white transition-all disabled:opacity-50"
              >
                Review Order
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <div className="card-tactical space-y-4">
              <h2 className="text-lg font-bold">Order Review</h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-black text-tactical-neon">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Delivery ({deliveryOption === 'express' ? 'Express' : 'Standard'})</span>
                  <span>{formatCurrency(deliveryCost)}</span>
                </div>
                <div className="flex justify-between text-xl font-black pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-tactical-neon">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-white/40 mt-0.5" />
                  <div>
                    <p className="font-bold">{customerName}</p>
                    <p className="text-white/60">{shippingAddress}</p>
                    <p className="text-white/60">{shippingCity}, {shippingProvince}</p>
                    <p className="text-white/60">{customerPhone}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('shipping')}
                className="flex-1 py-4 rounded-2xl border border-white/20 text-white/70 font-bold hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="flex-1 py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Place Order
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-white/30">
              By placing this order, you agree to pay {formatCurrency(total)} on delivery
            </p>
          </div>
        )}
      </main>
    </div>
  );
}