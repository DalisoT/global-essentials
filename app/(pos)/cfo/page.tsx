'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Send,
  Sparkles,
  TrendingUp,
  Package,
  Wallet,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { askCFO, type AskCFOData } from '@/lib/actions/cfo';
import type { CfoHistoryMessage, CfoToolCallRecord } from '@/lib/ai/cfo-engine';

/**
 * AI CFO Copilot — chat route (Phase 3 / 3B.1 + 3B.2 + 3B.3).
 *
 *   3B.1 → visual layout shell (header, sticky input, sticky message list)
 *   3B.2 → real message state, askCFO wiring, auto-scroll, typing state,
 *           enter-to-send, suggestion chips that auto-submit
 *   3B.3 → CFOAnswerCard with collapsible "based on…" tool-call disclosure
 *
 * The page is a client component because the entire chat is interactive
 * state. Heavy lifting (Groq calls, tool execution, ai_usage + audit_log
 * writes) is delegated to the `askCFO` server action; the page only
 * orchestrates the UI.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Tool calls the model made (assistant only). */
  toolCalls?: CfoToolCallRecord[];
  /** Token usage (assistant only). */
  usage?: AskCFOData['usage'];
  /** Echoed askCFO timestamp (assistant only). */
  askedAt?: string;
  /** Error string (assistant only, when askCFO returned { error }). */
  error?: string;
  /** True if the engine hit MAX_ITERATIONS (assistant only). */
  hitIterationCap?: boolean;
  /** True if the answer came from the 3C.3 fallback (engine was unreachable). */
  fallback?: boolean;
}

interface SuggestionChip {
  id: string;
  label: string;
  icon: typeof Sparkles;
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

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export default function CfoPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // On first mount, seed the input from ?prefill=... if present. The
  // dashboard cards (3B.5) link to /cfo?prefill=<question> to give the
  // user a one-tap "explain this number to me" experience.
  // We use a ref guard so the prefill is consumed exactly once even if
  // the effect re-runs (it can, in dev with React strict mode).
  const prefillConsumed = useRef(false);
  useEffect(() => {
    if (prefillConsumed.current) return;
    const prefill = searchParams?.get('prefill');
    if (prefill) {
      setDraft(prefill);
      prefillConsumed.current = true;
    }
  }, [searchParams]);

  // Auto-scroll to the bottom on every new message + when loading flips on.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  // Re-focus the input after the model finishes, so the next question
  // is just a keystroke away.
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  const submit = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;

      // 1) Push the user message immediately so it shows up in the list.
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft('');
      setIsLoading(true);

      // 2) Build the conversation history for the engine. We only pass
      //    user/assistant turns (no synthetic tool-call bookkeeping) —
      //    the engine re-creates the tool messages itself.
      const history: CfoHistoryMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      // 3) Call the server action.
      const { data, error } = await askCFO({ question: trimmed, history });

      // 4) Append the assistant message (or error).
      if (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            error,
          },
        ]);
        toast.error(error);
      } else if (data) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.answer,
            toolCalls: data.toolCalls,
            usage: data.usage,
            askedAt: data.askedAt,
            hitIterationCap: data.hitIterationCap,
            fallback: data.fallback,
          },
        ]);
      }

      setIsLoading(false);
    },
    [isLoading, messages]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submit(draft);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(draft);
    }
  };

  const reset = () => {
    setMessages([]);
    setDraft('');
  };

  const hasMessages = messages.length > 0;

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
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={reset}
              className="p-2 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
              aria-label="New conversation"
              title="New conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <Sparkles className="w-4 h-4 text-white/20" />
        </div>
      </motion.div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {!hasMessages ? (
          <EmptyState
            suggestions={SUGGESTIONS}
            onPick={(s) => void submit(s.prefill)}
          />
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))
        )}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky input. `bottom-24` clears the global bottom nav. */}
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
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Thinking…' : 'Ask anything about your business…'}
            disabled={isLoading}
            className="flex-1 h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-tactical-neon disabled:opacity-50"
            aria-label="Question for the AI CFO"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!draft.trim() || isLoading}
            aria-label="Send"
            className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center transition-all',
              draft.trim() && !isLoading
                ? 'bg-tactical-neon text-black hover:bg-white'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

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

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return <UserBubble content={message.content} />;
  }
  if (message.error) {
    return <ErrorBubble error={message.error} />;
  }
  return (
    <CFOAnswerCard
      content={message.content}
      toolCalls={message.toolCalls ?? []}
      usage={message.usage}
      askedAt={message.askedAt}
      hitIterationCap={message.hitIterationCap ?? false}
      fallback={message.fallback ?? false}
    />
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-tactical-blue text-white px-4 py-2.5 text-sm">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </motion.div>
  );
}

function ErrorBubble({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 shrink-0 rounded-full bg-tactical-red/15 flex items-center justify-center">
        <XCircle className="w-4 h-4 text-tactical-red" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-tactical-red/10 border border-tactical-red/30 px-4 py-2.5 text-sm">
        <p className="font-bold text-tactical-red mb-1">Couldn&apos;t answer</p>
        <p className="text-white/80 whitespace-pre-wrap break-words">{error}</p>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 shrink-0 rounded-full bg-tactical-blue/15 flex items-center justify-center">
        <Brain className="w-4 h-4 text-tactical-blue" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-1">
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-white/40"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3B.3 — CFOAnswerCard with the "based on…" tool-call disclosure
// ─────────────────────────────────────────────────────────────────────

interface CFOAnswerCardProps {
  content: string;
  toolCalls: CfoToolCallRecord[];
  usage?: AskCFOData['usage'];
  askedAt?: string;
  hitIterationCap: boolean;
  fallback: boolean;
}

function CFOAnswerCard({
  content,
  toolCalls,
  usage,
  askedAt,
  hitIterationCap,
  fallback,
}: CFOAnswerCardProps) {
  const [showBasedOn, setShowBasedOn] = useState(false);

  const toolCallCount = toolCalls.length;
  const errorCount = toolCalls.filter((t) => !t.result.ok).length;
  const totalDurationMs = toolCalls.reduce((s, t) => s + t.durationMs, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 shrink-0 rounded-full bg-tactical-blue/15 flex items-center justify-center">
        <Brain className="w-4 h-4 text-tactical-blue" />
      </div>
      <div className="max-w-[85%] flex-1 space-y-2">
        {/* The answer */}
        <div className="rounded-2xl rounded-bl-md bg-white/5 border border-white/10 px-4 py-2.5 text-sm">
          {content ? (
            <p className="whitespace-pre-wrap break-words text-white/90">
              {content}
            </p>
          ) : (
            <p className="italic text-white/40">
              The model returned an empty answer.
            </p>
          )}
        </div>

        {/* Metadata strip: tool count, tokens, timestamp, iteration cap warning */}
        {(toolCallCount > 0 || usage || askedAt || hitIterationCap || fallback) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-white/40">
            {fallback && (
              <span
                className="text-tactical-orange font-bold flex items-center gap-1"
                title="The AI was unreachable. This is a templated answer from a keyword-routed tool call (see 3C.3)."
              >
                <AlertCircle className="w-3 h-3" />
                Fallback (AI unavailable)
              </span>
            )}
            {toolCallCount > 0 && (
              <button
                onClick={() => setShowBasedOn((v) => !v)}
                className="flex items-center gap-1 hover:text-white/70 transition-colors"
                aria-expanded={showBasedOn}
              >
                {showBasedOn ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Wrench className="w-3 h-3" />
                Based on {toolCallCount} tool call{toolCallCount > 1 ? 's' : ''}
                {errorCount > 0 && (
                  <span className="text-tactical-red">
                    · {errorCount} failed
                  </span>
                )}
              </button>
            )}
            {usage && (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {formatTokenCount(usage.totalTokens)} tokens
                {usage.promptTokens > 0 && usage.completionTokens > 0 && (
                  <span className="text-white/30">
                    ({formatTokenCount(usage.promptTokens)}↑ {formatTokenCount(usage.completionTokens)}↓)
                  </span>
                )}
              </span>
            )}
            {askedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(askedAt)}
              </span>
            )}
            {hitIterationCap && (
              <span className="text-tactical-orange font-bold">
                Truncated (hit tool-call cap)
              </span>
            )}
            {toolCallCount > 0 && (
              <span className="text-white/30">{totalDurationMs}ms total</span>
            )}
          </div>
        )}

        {/* "Based on…" disclosure */}
        <AnimatePresence initial={false}>
          {showBasedOn && toolCallCount > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">
                {toolCalls.map((call, i) => (
                  <ToolCallDisclosure key={`${call.name}-${i}`} call={call} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ToolCallDisclosure({ call }: { call: CfoToolCallRecord }) {
  const [showArgs, setShowArgs] = useState(false);
  const ok = call.result.ok;

  return (
    <div className="rounded-xl bg-black/40 border border-white/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {ok ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-tactical-neon shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-tactical-red shrink-0" />
        )}
        <span className="font-mono text-xs text-white/80">{call.name}</span>
        <span className="text-[10px] text-white/30 ml-auto shrink-0">
          {call.durationMs}ms
        </span>
      </div>
      {!ok && (
        <p className="px-3 pb-2 text-[11px] text-tactical-red font-mono break-all">
          {call.result.ok ? '' : call.result.error}
        </p>
      )}
      <div className="border-t border-white/5">
        <button
          onClick={() => setShowArgs((v) => !v)}
          className="w-full text-left px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 flex items-center gap-1"
        >
          {showArgs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {showArgs ? 'Hide' : 'Show'} inputs
        </button>
        {showArgs && (
          <pre className="px-3 pb-2 text-[10px] text-white/60 font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(call.args, null, 2)}
          </pre>
        )}
      </div>
      <div className="border-t border-white/5">
        <details className="group">
          <summary className="cursor-pointer px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 flex items-center gap-1 list-none">
            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
            Output
          </summary>
          <pre className="px-3 pb-2 text-[10px] text-white/60 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {JSON.stringify(ok ? call.result.data : null, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatTokenCount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return String(n);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-ZM', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
