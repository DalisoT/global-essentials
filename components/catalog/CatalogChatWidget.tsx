'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { MessageCircle, X, Send, Phone, Loader2, Sparkles } from 'lucide-react';
import { cn, getWhatsAppLink } from '@/lib/utils';
import {
  askCatalog,
  type ChatMessage,
} from '@/lib/actions/catalog';

/**
 * CatalogChatWidget (Phase 8 / 8.4).
 *
 * Floating chat button + panel for the public catalog. Customers
 * can ask product questions; the AI answers using only the data
 * we send it. A "Talk to us on WhatsApp" button is always visible
 * at the bottom of the panel for human escalation.
 *
 * The widget is mounted once per page (catalog + product detail).
 * It carries its own chat state — no global store for v1. Reload
 * = fresh conversation. That's fine: catalog browsing is short.
 *
 * WhatsApp handoff:
 *   - Phone number is hardcoded for the shop (260980062299).
 *     Centralising it here means one place to change.
 *   - The handoff message is a context-aware summary: the last
 *     user question + a one-liner about what they were looking at.
 *     Better than a generic "I want to order" because the team
 *     sees the context immediately.
 */

interface CatalogChatWidgetProps {
  /** Optional product context. When set, the chat gets a richer prompt. */
  productName?: string;
  productId?: string;
  /** Hardcoded shop phone (Zambia). Centralised here for future change. */
  shopPhone?: string;
}

const SHOP_PHONE_DEFAULT = '260980062299';
const SHOP_NAME = 'Global Essentials';

export function CatalogChatWidget({
  productName,
  productId,
  shopPhone = SHOP_PHONE_DEFAULT,
}: CatalogChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: productName
        ? `Hi! I can answer questions about ${productName} or any of our other products. What can I help you find?`
        : `Hi! Looking for something specific, or have a question about a product? Ask away.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isPending]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;
    const next: ChatMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(next);
    setInput('');
    startTransition(async () => {
      const res = await askCatalog({
        productIds: productId ? [productId] : [],
        history: next,
        contextNote: productName ? `User is viewing ${productName}.` : undefined,
      });
      if (res.error) {
        setHistory([
          ...next,
          {
            role: 'assistant',
            content: `Sorry, something went wrong on my end. Tap the WhatsApp button below to talk to the team directly.`,
          },
        ]);
        return;
      }
      if (res.data) {
        setHistory(res.data.history);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // Build the WhatsApp handoff message from the last user question.
  const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
  const whatsappMessage = lastUserMsg
    ? `Hi ${SHOP_NAME}! I was just${productName ? ` looking at ${productName}` : ' on your site'} and asked: "${lastUserMsg.content.slice(0, 200)}". Can you help?`
    : `Hi ${SHOP_NAME}! I'd like to know more about your products.`;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className={cn(
          'fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all',
          'bg-tactical-neon text-black hover:scale-105',
          open && 'scale-90 opacity-0 pointer-events-none'
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Panel */}
      <div
        className={cn(
          'fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] flex flex-col',
          'bg-tactical-slate rounded-3xl border border-white/10 shadow-2xl overflow-hidden',
          'transition-all duration-200 origin-bottom-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 p-3.5 border-b border-white/10 bg-black/30">
          <div className="w-9 h-9 rounded-full bg-tactical-neon/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-tactical-neon" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{SHOP_NAME} Assistant</p>
            <p className="text-[10px] text-white/40">Powered by AI · answers grounded in our catalog</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-2 bg-black/20"
        >
          {history.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}
          {isPending && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 text-tactical-neon animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input + WhatsApp */}
        <div className="border-t border-white/10 p-2.5 space-y-2 bg-black/30">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask about a product…"
              disabled={isPending}
              className="flex-1 min-h-[40px] max-h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:border-tactical-blue focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !input.trim()}
              aria-label="Send"
              className={cn(
                'w-10 h-10 rounded-xl bg-tactical-blue/20 border border-tactical-blue/40 text-tactical-blue flex items-center justify-center shrink-0',
                (isPending || !input.trim()) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <a
            href={getWhatsAppLink(shopPhone, whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-tactical-neon/15 border border-tactical-neon/30 text-tactical-neon text-[11px] font-black uppercase tracking-widest hover:bg-tactical-neon/25 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Talk to us on WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Chat bubble
// ─────────────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-tactical-blue/20 border border-tactical-blue/30 text-white rounded-2xl rounded-br-md'
            : 'bg-white/5 border border-white/10 text-white/90 rounded-2xl rounded-bl-md'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
