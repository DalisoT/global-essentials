'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Brain, Send, Sparkles, TrendingUp, Package, Wallet, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AI CFO Copilot — chat route shell (Phase 3 / 3B.1).
 *
 * This is the *visual* layout only: header, message list area, sticky
 * input. State, askCFO wiring, the answer card, and the "based on"
 * disclosure all land in 3B.2 / 3B.3. You can navigate to /cfo now
 * (the nav link is added in 3B.4) and see the shape of the page.
 *
 * Layout notes:
 *   - The page sits inside the (pos) layout which has a fixed bottom
 *     nav with `pb-24` on its main. To keep the chat input above the
 *     nav we use `sticky bottom-24` (24 ≈ 6rem ≈ the nav height).
 *   - The message list scrolls inside its own container, not the page,
 *     so the input stays put while the user reads old turns.
 */

interface SuggestionChip {
  id: string;
  label: string;
  icon: typeof Sparkles;
  /** What the chip would prefill — for 3B.1 the input is read-only so we
   *  only show the label; 3B.2 will wire the prefill behavior. */
  prefill: string;
}

const SUGGESTIONS: SuggestionChip[] = [
  {
    id: 'pnl',
    label: "What's my net profit this month?",
    icon: TrendingUp,
    prefill: "What's my net profit this month?",
  },
  {
    id: 'top',
    label: 'Which products are my profit engines?',
    icon: Package,
    prefill: 'Which products are my profit engines this month?',
  },
  {
    id: 'cash',
    label: 'How much cash do I have right now?',
    icon: Wallet,
    prefill: 'How much cash do I have right now, and what is my runway?',
  },
  {
    id: 'debt',
    label: 'Who owes me the most overdue?',
    icon: AlertCircle,
    prefill: "Who owes me the most, and how overdue is it?",
  },
];

export default function CfoPage() {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the input on mount so the keyboard pops on mobile.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Placeholder submit handler — replaced in 3B.2 when askCFO is wired.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 3B.1: this is a no-op. The real wiring lives in 3B.2.
    void draft;
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 7rem)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-tactical-blue/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-tactical-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tighter">AI CFO</h1>
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-blue/20 text-tactical-blue">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider">
              Reads your books · Suggests, never acts
            </p>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-white/20" />
      </motion.div>

      {/* Message list area — empty state for 3B.1 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        <EmptyState suggestions={SUGGESTIONS} onPick={(s) => setDraft(s.prefill)} />
      </div>

      {/* Sticky input. `bottom-24` ≈ 6rem, leaves room above the global
          bottom nav. bg-black/80 + backdrop-blur so messages under it
          don't bleed through. */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-24 -mx-4 px-4 py-3 bg-black/80 backdrop-blur-xl border-t border-white/10"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about your business…"
            className="flex-1 h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-tactical-neon"
            aria-label="Question for the AI CFO"
            // 3B.1: no enter-to-send wiring yet. The button does nothing.
            // 3B.2: remove disabled + wire onKeyDown / form submit.
          />
          <button
            type="submit"
            disabled
            aria-label="Send"
            className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center transition-all',
              'bg-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-white/30 mt-2 text-center uppercase tracking-widest">
          AI features land in the next commit (3B.2)
        </p>
      </form>
    </div>
  );
}

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: SuggestionChip[];
  onPick: (s: SuggestionChip) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="card-tactical text-center py-10 px-4"
    >
      <div className="w-12 h-12 rounded-full bg-tactical-blue/15 flex items-center justify-center mx-auto mb-4">
        <Brain className="w-6 h-6 text-tactical-blue" />
      </div>
      <p className="font-black text-lg mb-1">Hi, I&apos;m your AI CFO.</p>
      <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
        I can read your sales, expenses, inventory, and debts — and answer
        questions in plain English.
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
        Try one to start
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-left text-sm text-white/80 hover:bg-white/10 hover:border-tactical-blue/40 transition-all"
            >
              <Icon className="w-4 h-4 text-tactical-blue shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
