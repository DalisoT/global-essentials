'use client';

import Link from 'next/link';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small "Ask AI" chip overlaid on dashboard metric cards (3B.5).
 *
 * Clicking it opens the AI CFO chat with a context-aware question
 * pre-filled. The onClick stops the click from bubbling up to the
 * parent card when the parent is itself a <Link> (Low Stock card →
 * /inventory).
 *
 * This component is a Client Component on purpose: the dashboard
 * page is a Server Component, and Next.js 14 doesn't allow event
 * handlers (functions) to be passed from Server to Client
 * Components. By making the whole chip a Client Component, the
 * onClick lives inside the boundary.
 */

interface AskCfoChipProps {
  /** The question to prefill into the CFO chat. */
  prefill: string;
  /** Compact = icon only (for small cards). Default: icon + label. */
  small?: boolean;
}

export function AskCfoChip({ prefill, small = false }: AskCfoChipProps) {
  const href = `/cfo?prefill=${encodeURIComponent(prefill)}`;
  return (
    <Link
      href={href}
      // Stop the chip click from triggering the parent card's
      // navigation (e.g. the Low Stock card links to /inventory).
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-tactical-blue/15 text-tactical-blue text-[10px] font-bold uppercase tracking-wider hover:bg-tactical-blue/25 transition-colors"
      title={prefill}
    >
      <Brain className="w-3 h-3" />
      {!small && <span>Ask AI</span>}
    </Link>
  );
}

// Keep `cn` import live for future style tweaks (cheap, avoids a
// future "unused import" lint error if we add a className prop).
void cn;
