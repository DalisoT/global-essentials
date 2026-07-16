'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Copy,
  MessageCircle,
  Search,
  Calendar,
  Ship,
  Plane,
  Package,
  Loader2,
  Check,
} from 'lucide-react';
import { getWhatsAppLink, cn } from '@/lib/utils';
import { formatK, localDateString } from '@/lib/pre-orders/pricing';
import {
  lookupPreOrderPublic,
} from '@/lib/actions/pre-orders';
import type { PreOrder, PreOrderEvent } from '@/lib/supabase-types';

const SHOP_PHONE = '260980062299';
const SHOP_NAME = 'Global Essentials';

function depositMessageFor(
  trackingCode: string,
  customerName: string,
  deposit: number
): string {
  return (
    `Hi ${SHOP_NAME}! I just pre-ordered via the website.\n\n` +
    `Tracking code: ${trackingCode}\n` +
    `Name: ${customerName}\n` +
    `Deposit to pay: ${formatK(deposit)}\n\n` +
    `Could you confirm the order and share payment options?`
  );
}

/**
 * Confirmation content (Phase 11 / 11.8).
 *
 * Server-side this is a thin client component (the page
 * itself is server-rendered, this client component handles
 * the dynamic searchParams and lookup).
 */
export function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (searchParams.get('code') ?? '').trim().toUpperCase();

  // Optional: re-fetch the pre-order so we can show a
  // personalised confirmation. If the fetch fails, we
  // still show the code (the user just got it from the
  // server-side action).
  const [preOrder, setPreOrder] = useState<
    (PreOrder & { events: PreOrderEvent[] }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setLookupError(null);
    const rateKey =
      typeof window !== 'undefined'
        ? navigator.userAgent + ':track'
        : 'server';
    lookupPreOrderPublic({ tracking_code: code, rate_limit_key: rateKey })
      .then((res) => {
        if (res.error) {
          setLookupError(res.error);
        } else {
          setPreOrder(res.data ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [code]);

  const copied = useCopy(code);

  if (!code) {
    return (
      <EmptyState
        title="No tracking code"
        body="It looks like you came here without a tracking code. If you just placed a pre-order, check your WhatsApp — the code is on the way."
      />
    );
  }

  const customerName = preOrder?.customer_name ?? 'there';
  const deposit = preOrder?.deposit_amount ?? 0;
  const balance = preOrder?.balance_due ?? 0;
  const total = preOrder?.unit_price ?? 0;
  const expected = preOrder?.expected_delivery_date ?? null;
  const ShippingIcon =
    preOrder?.shipping_mode === 'air' ? Plane : Ship;

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tactical-neon/20">
          <CheckCircle2 className="w-9 h-9 text-tactical-neon" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight">
          You&apos;re on the list
        </h1>
        <p className="text-sm text-white/60">
          We&apos;ve saved your pre-order. Pay the deposit to lock it in.
        </p>
      </div>

      {/* Tracking code card */}
      <div className="rounded-2xl border border-tactical-neon/30 bg-tactical-neon/5 p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-tactical-neon">
          Your tracking code
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-3xl font-black text-tactical-neon tracking-widest">
            {code}
          </p>
          <button
            type="button"
            onClick={copied.copy}
            className={cn(
              'inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors',
              copied.done
                ? 'bg-tactical-neon/20 text-tactical-neon'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            )}
          >
            {copied.done ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied.done ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[10px] text-white/50">
          Save this — it&apos;s how you check on your pre-order later.
        </p>
      </div>

      {/* Pricing summary (when available) */}
      {preOrder && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
            What you owe
          </p>
          <Row label="Total" value={formatK(total)} />
          <Row label="Deposit now" value={formatK(deposit)} highlight />
          <Row label="Balance on delivery" value={formatK(balance)} />
          {expected && (
            <p className="text-[10px] text-white/50 pt-1 inline-flex items-center gap-1">
              <ShippingIcon className="w-3 h-3" />
              Expected around {prettyDate(expected)}
            </p>
          )}
        </div>
      )}

      {/* Pay deposit CTA */}
      {preOrder && (
        <a
          href={getWhatsAppLink(
            SHOP_PHONE,
            depositMessageFor(code, customerName, deposit)
          )}
          target="_blank"
          rel="noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-tactical-neon text-black font-black uppercase tracking-wide hover:bg-white transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Pay deposit via WhatsApp
        </a>
      )}

      <p className="text-xs text-white/50 text-center px-2">
        We&apos;ll text you on WhatsApp as soon as your boots land at the shop.
      </p>

      {/* Track later */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Want to check on it later?
        </p>
        <Link
          href={`/catalog/track?code=${encodeURIComponent(code)}`}
          className="inline-flex items-center gap-1.5 text-tactical-blue hover:text-tactical-neon text-sm font-bold"
        >
          <Search className="w-4 h-4" />
          Track this pre-order
        </Link>
      </div>

      {loading && (
        <p className="text-[10px] text-white/40 text-center inline-flex items-center gap-1.5 w-full justify-center">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading details…
        </p>
      )}
      {lookupError && !preOrder && (
        <p className="text-[10px] text-white/40 text-center">
          (Couldn&apos;t load the details — your code is saved regardless.)
        </p>
      )}

      <div className="text-center pt-2">
        <Link
          href="/catalog"
          className="text-xs text-white/40 hover:text-white/70 uppercase tracking-widest"
        >
          ← Back to catalog
        </Link>
      </div>
    </div>
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center space-y-3 py-10">
      <Package className="w-10 h-10 text-white/30 mx-auto" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-white/60 px-4">{body}</p>
      <Link
        href="/catalog"
        className="inline-block text-xs font-bold uppercase tracking-widest text-tactical-blue hover:text-tactical-neon"
      >
        Browse the catalog →
      </Link>
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

/** Tiny "copy to clipboard" hook. */
function useCopy(text: string) {
  const [done, setDone] = useState(false);
  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      })
      .catch(() => undefined);
  };
  return { done, copy };
}

// Reference localDateString so the import isn't unused.
// (used implicitly via the date helpers above).
void localDateString;
