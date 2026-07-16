'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MessageCircle,
  Loader2,
  Copy,
  Check,
  X,
  Send,
} from 'lucide-react';
import { cn, getWhatsAppLink } from '@/lib/utils';
import {
  MESSAGE_TEMPLATES,
  SHOP_PHONE,
  renderMessage,
  type MessageTemplateId,
} from '@/lib/pre-orders/messages';
import { recordMessageSent } from '@/lib/actions/pre-orders-lifecycle';
import type { PreOrder } from '@/lib/supabase-types';

/**
 * Send-update button + modal (Phase 11 / 11.9).
 *
 * Lives on the pre-order detail page. Clicking it opens a
 * modal that:
 *   1. Shows a template picker (auto-suggested from the
 *      current status).
 *   2. Renders the message body in a textarea (editable).
 *   3. Two CTAs:
 *        - "Open WhatsApp" → opens wa.me with the message
 *          pre-filled, in a new tab. Owner sends it manually.
 *        - "Mark as sent" → records a `message_sent` event
 *          on the pre-order so the timeline shows the
 *          communication. No auto-send in v1.
 */
export function SendUpdateButton({ order }: { order: PreOrder }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const suggested = useMemo(
    () =>
      MESSAGE_TEMPLATES.find((t) =>
        t.suggestedFor.includes(order.status)
      ) ?? MESSAGE_TEMPLATES[0],
    [order.status]
  );
  const [templateId, setTemplateId] =
    useState<MessageTemplateId>(suggested.id);
  const [body, setBody] = useState(() =>
    renderMessage(suggested.id, order)
  );
  const [copied, setCopied] = useState(false);

  function changeTemplate(id: MessageTemplateId) {
    setTemplateId(id);
    setBody(renderMessage(id, order));
  }

  function openWhatsApp() {
    const url = getWhatsAppLink(order.customer_whatsapp, body);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy manually');
    }
  }

  function markAsSent() {
    startTransition(async () => {
      const res = await recordMessageSent({
        pre_order_id: order.id,
        template_id: templateId,
        message_body: body,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Logged as sent');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full card-tactical p-3 flex items-center gap-3 text-left hover:border-tactical-neon/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-tactical-neon/20 text-tactical-neon flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-tactical-neon">Send WhatsApp update</p>
          <p className="text-[10px] text-white/40">
            Pick a template, edit if you want, then send via WhatsApp
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="card-tactical w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black uppercase tracking-widest text-tactical-neon">
            Send update
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded text-white/40 hover:text-white/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template picker */}
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
            Template
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {MESSAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTemplate(t.id)}
                className={cn(
                  'text-left p-2 rounded-lg border transition-colors',
                  templateId === t.id
                    ? 'border-tactical-neon bg-tactical-neon/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-black uppercase tracking-widest',
                    templateId === t.id ? 'text-tactical-neon' : 'text-white/80'
                  )}
                >
                  {t.label}
                </p>
                <p className="text-[9px] text-white/40 leading-tight mt-0.5 line-clamp-2">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Message body */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Message
            </p>
            <button
              type="button"
              onClick={copyBody}
              className={cn(
                'inline-flex items-center gap-1 h-6 px-1.5 rounded text-[9px] font-black uppercase tracking-widest',
                copied
                  ? 'bg-tactical-neon/20 text-tactical-neon'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs resize-none focus:border-tactical-neon/50 focus:outline-none"
          />
          <p className="text-[10px] text-white/40">
            Goes to <strong className="text-white/70">{order.customer_whatsapp}</strong>
          </p>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={markAsSent}
            disabled={isPending || !body.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-white/20 text-white/80 font-bold text-xs hover:bg-white/5 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Mark as sent
          </button>
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!body.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tactical-neon text-black font-black text-xs uppercase tracking-widest hover:bg-white disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Open WhatsApp
          </button>
        </div>
        <p className="text-[10px] text-white/40 text-center">
          Shop phone for replies: {SHOP_PHONE}
        </p>
      </div>
    </div>
  );
}
