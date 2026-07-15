'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateLessonExamples } from '@/lib/actions/learn';

/**
 * PersonalizedExamplesButton (Phase 4 / 4B.3).
 *
 * Toggle button on the lesson reader. When the user clicks "Show me
 * with my numbers", we:
 *   1. Call generateLessonExamples(lessonId) which fetches the user's
 *      business data and asks the AI to rewrite the lesson body.
 *   2. Render the rewritten body in a card BELOW the original article.
 *      The original body stays visible (the user should still have
 *      access to the canonical version).
 *
 * State machine:
 *   - idle:  show "Show me with my numbers" button
 *   - loading: show spinner while the AI works
 *   - shown:  show "Use my numbers" view + "Back to original" button
 *
 * Errors come back through the server action; we toast them and
 * stay in the idle state.
 */

interface PersonalizedExamplesButtonProps {
  lessonId: string;
  colorClass?: string;
  /** Render the rewritten body if the user has already generated it. */
  initialRewrittenBody?: string | null;
  initialHighlights?: Array<{ label: string; value: string }>;
}

type ViewState = 'idle' | 'loading' | 'shown';

export function PersonalizedExamplesButton({
  lessonId,
  colorClass = 'bg-tactical-purple/20 border-tactical-purple/40 text-tactical-purple',
  initialRewrittenBody = null,
  initialHighlights = [],
}: PersonalizedExamplesButtonProps) {
  const [view, setView] = useState<ViewState>(
    initialRewrittenBody ? 'shown' : 'idle'
  );
  const [rewrittenBody, setRewrittenBody] = useState<string | null>(
    initialRewrittenBody
  );
  const [highlights, setHighlights] = useState<
    Array<{ label: string; value: string }>
  >(initialHighlights);
  const [, startTransition] = useTransition();

  const handleGenerate = () => {
    setView('loading');
    startTransition(async () => {
      const res = await generateLessonExamples(lessonId);
      if (res.error || !res.data) {
        toast.error(res.error || "Couldn't generate personalised examples.");
        setView('idle');
        return;
      }
      setRewrittenBody(res.data.rewrittenBody);
      setHighlights(res.data.highlights);
      setView('shown');
      if (res.data.highlights.length > 0) {
        toast.success('Personalised with your numbers', {
          description: `${res.data.highlights.length} key numbers from your business were injected into this lesson.`,
        });
      } else {
        toast.success('Generated', {
          description:
            "The AI didn't find numbers to inject — your lesson looks the same as the original.",
        });
      }
    });
  };

  const handleReset = () => {
    setView('idle');
    // Keep the body in state so toggling back is instant; we just
    // hide it from the UI. To re-generate, the user clicks the
    // button again.
  };

  if (view === 'loading') {
    return (
      <button
        type="button"
        disabled
        className={cn(
          'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors opacity-70',
          'bg-white/5 border-white/10 text-white/60'
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Reading your books…
      </button>
    );
  }

  if (view === 'shown') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border',
              colorClass
            )}
          >
            <Sparkles className="w-4 h-4" />
            Using your numbers
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Back to original
          </button>
        </div>
        {highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {highlights.map((h, i) => (
              <div
                key={i}
                className="card-tactical p-3 border-tactical-purple/20"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  {h.label}
                </p>
                <p className="text-base font-black mt-1 text-tactical-purple">
                  {h.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {rewrittenBody && (
          <article className="card-tactical border-tactical-purple/20">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/90">
              {rewrittenBody}
            </pre>
          </article>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      className={cn(
        'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
        'bg-white/5 border-white/10 text-white/60 hover:bg-tactical-purple/20 hover:border-tactical-purple/40 hover:text-tactical-purple'
      )}
    >
      <Sparkles className="w-4 h-4" />
      Show me with my numbers
    </button>
  );
}
