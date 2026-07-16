'use client';

import Link from 'next/link';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { getWhatsAppLink } from '@/lib/utils';
import type { Product } from '@/lib/supabase-types';

interface QueuedMessage {
  pre_order_id: string;
  cadence_key: string;
  template: string;
  body: string;
  customer_whatsapp: string;
  queued_at: string;
}

const TEMPLATE_LABEL: Record<string, string> = {
  deposit_request: 'Ask for deposit',
  deposit_thanks: 'Confirm deposit',
  in_transit: 'In transit',
  customs: 'At customs',
  almost_there: 'Almost there',
  arrived: 'Stock arrived',
  completed: 'Thanks for collecting',
  cancelled: 'Cancellation',
  refunded: 'Refund sent',
  custom: 'Custom update',
};

/**
 * Queued messages banner (Phase 11 / 11.10).
 *
 * Sits at the top of the /pre-orders list. Shows a count of
 * pre-orders with at least one queued (not yet sent) update.
 * Each row links to the pre-order detail page where the
 * shop owner can send the message.
 */
export function QueuedMessagesBanner({
  messages,
  productMap,
  customerMap,
}: {
  messages: QueuedMessage[];
  productMap: Record<string, Pick<Product, 'id' | 'name' | 'image_url'>>;
  customerMap: Record<string, string>;
}) {
  if (messages.length === 0) return null;

  return (
    <div className="card-tactical border-tactical-neon/40 bg-tactical-neon/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-tactical-neon" />
        <p className="text-xs font-black uppercase tracking-widest text-tactical-neon">
          {messages.length} WhatsApp update{messages.length === 1 ? '' : 's'} to send
        </p>
      </div>
      <div className="space-y-1.5">
        {messages.slice(0, 5).map((m) => (
          <Link
            key={`${m.pre_order_id}::${m.cadence_key}`}
            href={`/pre-orders/${m.pre_order_id}`}
            className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-tactical-neon/20 hover:border-tactical-neon/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-tactical-neon">
                {TEMPLATE_LABEL[m.template] ?? m.template}
              </p>
              <p className="text-xs text-white/80 truncate">
                {customerMap[m.pre_order_id] ?? 'Customer'}
                {productMap[m.pre_order_id] ? (
                  <span className="text-white/40"> · {productMap[m.pre_order_id].name}</span>
                ) : null}
              </p>
            </div>
            <a
              href={m.customer_whatsapp ? getWhatsAppLink(m.customer_whatsapp, m.body) : '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-tactical-neon/20 border border-tactical-neon/40 text-[10px] font-black uppercase tracking-widest text-tactical-neon hover:bg-tactical-neon/30"
            >
              <MessageCircle className="w-3 h-3" />
              Send
            </a>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </Link>
        ))}
        {messages.length > 5 && (
          <p className="text-[10px] text-white/40 text-center">
            + {messages.length - 5} more — open each pre-order to send
          </p>
        )}
      </div>
    </div>
  );
}
