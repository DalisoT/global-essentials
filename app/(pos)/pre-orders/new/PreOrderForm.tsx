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
  Calendar,
  Phone,
  User,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculatePreOrderPricing,
  formatK,
  localDateString,
} from '@/lib/pre-orders/pricing';
import {
  createPreOrder,
  listProductVariants,
} from '@/lib/actions/pre-orders';
import type {
  PreOrderShippingMode,
  Product,
  ProductVariant,
} from '@/lib/supabase-types';

/**
 * Pre-order form (Phase 11 / 11.4).
 *
 * The deposit math is computed client-side for the live preview
 * (re-uses the same calculatePreOrderPricing as the server
 * action, so the preview is always exactly what the server
 * will accept). On submit, the server action re-computes and
 * re-validates; if anything changed, the server wins.
 */
export function PreOrderForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [productId, setProductId] = useState<string>('');
  const [variantId, setVariantId] = useState<string>('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [shippingMode, setShippingMode] =
    useState<PreOrderShippingMode>('sea');
  const [notes, setNotes] = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId]
  );

  // Live pricing preview. Same function the server uses, so the
  // numbers you see are the numbers you'll be charged.
  const pricing = useMemo(() => {
    if (!selectedProduct) return null;
    return calculatePreOrderPricing({
      product: selectedProduct,
      variant: selectedVariant,
      shippingMode,
    });
  }, [selectedProduct, selectedVariant, shippingMode]);

  // When the product changes, fetch its variants.
  function handleProductChange(id: string) {
    setProductId(id);
    setVariantId('');
    setVariants([]);
    if (!id) return;
    setLoadingVariants(true);
    listProductVariants(id)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setVariants(res.data ?? []);
      })
      .finally(() => setLoadingVariants(false));
  }

  function submit() {
    if (!selectedProduct) {
      toast.error('Pick a product');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!customerWhatsapp.trim()) {
      toast.error('Customer WhatsApp number is required');
      return;
    }
    startTransition(async () => {
      const res = await createPreOrder({
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        product_id: selectedProduct.id,
        variant_id: variantId || null,
        shipping_mode: shippingMode,
        source: 'pos',
        notes: notes.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Pre-order ${res.tracking_code} created. Deposit: ${formatK(res.pricing?.deposit_amount ?? 0)}.`
      );
      router.push(`/pre-orders/${res.data?.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Customer */}
      <div className="card-tactical p-3 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-tactical-blue" />
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Customer
          </p>
        </div>
        <FieldGroup label="Full name">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Patience Mwamba"
            className="input-tactical w-full text-sm"
            maxLength={100}
          />
        </FieldGroup>
        <FieldGroup label="WhatsApp number">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="tel"
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              placeholder="260970000000"
              className="input-tactical w-full text-sm pl-9"
              maxLength={30}
            />
          </div>
        </FieldGroup>
      </div>

      {/* Product */}
      <div className="card-tactical p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-tactical-blue" />
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Product
          </p>
        </div>
        <FieldGroup label="Boot">
          <select
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="select-tactical w-full text-sm"
          >
            <option value="">— pick a product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · sells at {formatK(p.selling_price)}
              </option>
            ))}
          </select>
        </FieldGroup>

        {loadingVariants && (
          <p className="text-xs text-white/40 inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading sizes…
          </p>
        )}

        {!loadingVariants && variants.length > 0 && (
          <FieldGroup label="Size">
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="select-tactical w-full text-sm"
            >
              <option value="">— any size —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.size, v.color].filter(Boolean).join(' / ') || 'Unspecified'}
                  {v.stock_level != null ? ` · ${v.stock_level} in stock` : ''}
                </option>
              ))}
            </select>
          </FieldGroup>
        )}
      </div>

      {/* Shipping mode */}
      <div className="card-tactical p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Ship className="w-4 h-4 text-tactical-blue" />
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Shipping
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            mode="sea"
            active={shippingMode === 'sea'}
            onClick={() => setShippingMode('sea')}
            icon={Ship}
            title="Sea cargo"
            subtitle="+50 days · cheaper"
          />
          <ModeCard
            mode="air"
            active={shippingMode === 'air'}
            onClick={() => setShippingMode('air')}
            icon={Plane}
            title="Air cargo"
            subtitle="+14 days · faster"
          />
        </div>
      </div>

      {/* Live pricing preview */}
      {pricing && selectedProduct && (
        <div className="card-tactical border-tactical-neon/30 bg-tactical-neon/5 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-tactical-neon" />
            <p className="text-xs font-black uppercase tracking-widest text-tactical-neon">
              Pricing
            </p>
          </div>

          <PriceRow label="Cost" value={formatK(pricing.unit_cost)} />
          <PriceRow
            label={`Shipping (${shippingMode})`}
            value={formatK(pricing.shipping_cost)}
          />
          <PriceRow label="Sell price" value={formatK(pricing.unit_price)} />

          <div className="h-px bg-white/10 my-1" />

          <PriceRow
            label="Deposit (covers cost + shipping)"
            value={formatK(pricing.deposit_amount)}
            highlight
          />
          <PriceRow
            label="Balance on delivery"
            value={formatK(pricing.balance_due)}
            highlight
          />

          <div className="flex items-center gap-1.5 text-[10px] text-white/40 mt-1">
            <Calendar className="w-3 h-3" />
            Expected by {prettyDate(pricing.expected_delivery_date)}
            <span className="text-white/30">
              ({pricing.delivery_days} days from today, {localDateString()})
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="card-tactical p-3 space-y-2">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-tactical-blue" />
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Notes (optional)
          </p>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Customer prefers a call before the shipment lands…"
          rows={2}
          maxLength={500}
          className="input-tactical w-full text-sm resize-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !selectedProduct || !pricing}
        className={cn(
          'btn-tactical w-full flex items-center justify-center gap-2',
          (isPending || !selectedProduct || !pricing) && 'opacity-50'
        )}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Package className="w-4 h-4" />
        )}
        Register pre-order
      </button>
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
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

function PriceRow({
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
  // 'YYYY-MM-DD' → '15 Sep 2026'
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}
