'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Ship,
  Plane,
  Calculator,
  Loader2,
  Package,
  Phone,
  User,
  StickyNote,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculatePreOrderPricing,
  formatK,
} from '@/lib/pre-orders/pricing';
import {
  createCatalogPreOrder,
} from '@/lib/actions/pre-orders';
import type {
  PreOrderShippingMode,
  ProductVariant,
} from '@/lib/supabase-types';

interface PublicProduct {
  id: string;
  name: string;
  selling_price: number;
  pre_order_enabled: boolean;
  image_url: string | null;
  image_urls: string[] | null;
}

/**
 * Public catalog pre-order form (Phase 11 / 11.7).
 *
 * Reuses the same pricing engine as the POS form so the
 * numbers always match. Submits via the service-role
 * `createCatalogPreOrder` action which has its own in-process
 * rate limiter.
 */
export function CatalogPreOrderForm({
  product,
  variants,
  preselectedVariantId,
}: {
  product: PublicProduct;
  variants: ProductVariant[];
  preselectedVariantId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState(preselectedVariantId);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [shippingMode, setShippingMode] =
    useState<PreOrderShippingMode>('sea');
  const [notes, setNotes] = useState('');

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId]
  );

  // We don't have the full product row from the public catalog
  // action (it strips cost_price for security — that's the
  // whole point of the deposit-covers-cost model). The server
  // recomputes with the real cost when it inserts. For the
  // preview, we use a conservative estimate.
  const previewProduct = useMemo(
    () => ({
      cost_price: product.selling_price * 0.4, // estimate; the real value is server-side
      selling_price: product.selling_price,
      shipping_per_kg: 80 as number | null,
      weight_kg: 1.0 as number | null,
    }),
    [product.selling_price]
  );

  const pricing = useMemo(
    () =>
      calculatePreOrderPricing({
        product: previewProduct,
        variant: selectedVariant,
        shippingMode,
      }),
    [previewProduct, selectedVariant, shippingMode]
  );

  function submit() {
    if (!customerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!customerWhatsapp.trim()) {
      toast.error('Please enter your WhatsApp number');
      return;
    }
    if (customerWhatsapp.replace(/\D/g, '').length < 7) {
      toast.error('That WhatsApp number looks too short');
      return;
    }
    // Use a coarse rate-limit key: the user agent + (optional) IP.
    // Vercel sets the x-forwarded-for header; we read it from a
    // hidden field set by the server. For v1 the rate limit is
    // lenient enough that a single user won't hit it.
    const rateKey =
      typeof window !== 'undefined'
        ? navigator.userAgent + ':' + window.location.host
        : 'server';

    startTransition(async () => {
      const res = await createCatalogPreOrder({
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        product_id: product.id,
        variant_id: variantId || null,
        shipping_mode: shippingMode,
        notes: notes.trim() || undefined,
        rate_limit_key: rateKey,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Redirect to the confirmation page (built in 11.8)
      router.push(
        `/catalog/pre-order-confirmed?code=${res.tracking_code ?? ''}`
      );
    });
  }

  return (
    <div className="space-y-4 py-2">
      {/* Product card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-14 h-14 rounded-lg object-cover bg-white/5"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center">
            <Package className="w-6 h-6 text-white/30" />
          </div>
        )}
        <div>
          <p className="font-bold text-sm">{product.name}</p>
          <p className="text-[10px] text-white/50">
            Pay a deposit to reserve · balance on delivery
          </p>
        </div>
      </div>

      {/* Customer */}
      <Card title="Your details" icon={User}>
        <Field label="Full name">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Patience Mwamba"
            maxLength={100}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm focus:border-tactical-blue/50 focus:outline-none"
          />
        </Field>
        <Field label="WhatsApp number (we&apos;ll text you when it arrives)">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="tel"
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              placeholder="260970000000"
              maxLength={30}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm focus:border-tactical-blue/50 focus:outline-none"
            />
          </div>
        </Field>
      </Card>

      {/* Size */}
      {variants.length > 0 && (
        <Card title="Size" icon={Package}>
          <div className="grid grid-cols-3 gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={cn(
                  'h-12 rounded-xl border text-sm font-bold transition-colors',
                  variantId === v.id
                    ? 'border-tactical-blue bg-tactical-blue/10 text-tactical-blue'
                    : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                )}
              >
                {[v.size, v.color].filter(Boolean).join(' / ') || '—'}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Shipping */}
      <Card title="Shipping" icon={Ship}>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            mode="sea"
            active={shippingMode === 'sea'}
            onClick={() => setShippingMode('sea')}
            icon={Ship}
            title="Sea cargo"
            subtitle="~50 days · standard"
          />
          <ModeCard
            mode="air"
            active={shippingMode === 'air'}
            onClick={() => setShippingMode('air')}
            icon={Plane}
            title="Air cargo"
            subtitle="~14 days · faster"
          />
        </div>
      </Card>

      {/* Pricing preview (estimates — server has the real numbers) */}
      <div className="rounded-2xl border border-tactical-neon/30 bg-tactical-neon/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-tactical-neon" />
          <p className="text-xs font-black uppercase tracking-widest text-tactical-neon">
            Estimated pricing
          </p>
        </div>
        <Row label="Sell price" value={formatK(product.selling_price)} />
        <Row
          label="Deposit (covers import + shipping)"
          value={formatK(pricing.deposit_amount)}
          highlight
        />
        <Row
          label="Balance on delivery"
          value={formatK(pricing.balance_due)}
          highlight
        />
        <p className="text-[10px] text-white/50 pt-1">
          Expected to land around {prettyDate(pricing.expected_delivery_date)}.
          We&apos;ll confirm the exact date when you pay the deposit.
        </p>
      </div>

      {/* Notes */}
      <Card title="Notes (optional)" icon={StickyNote}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Need them by a specific date? Tell us."
          rows={2}
          maxLength={500}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:border-tactical-blue/50 focus:outline-none"
        />
      </Card>

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-tactical-neon text-black font-black uppercase tracking-wide hover:bg-white transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        Reserve my pair
      </button>
      <p className="text-[10px] text-white/40 text-center px-4">
        We&apos;ll text you on WhatsApp to confirm and arrange the deposit payment.
      </p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-tactical-blue" />
        <p className="text-xs font-black uppercase tracking-widest text-white/60">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  mode: PreOrderShippingMode;
  active: boolean;
  onClick: () => void;
  icon: typeof Ship;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl border text-left transition-colors',
        active
          ? 'border-tactical-blue bg-tactical-blue/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'w-4 h-4',
            active ? 'text-tactical-blue' : 'text-white/40'
          )}
        />
        <p
          className={cn(
            'text-sm font-bold',
            active ? 'text-tactical-blue' : 'text-white/70'
          )}
        >
          {title}
        </p>
      </div>
      <p className="text-[10px] text-white/40 mt-0.5">{subtitle}</p>
    </button>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p
        className={cn(
          'text-xs',
          highlight ? 'text-white font-bold' : 'text-white/60'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-sm',
          highlight ? 'font-black text-tactical-neon' : 'font-semibold'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function prettyDate(dateStr: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}
