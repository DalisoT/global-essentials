'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateLessonProgress, markLessonRead } from '@/lib/actions/learn';

/**
 * LessonProgressTracker (Phase 4 / 4D.1).
 *
 * Invisible client component that lives inside the lesson reader
 * page. Its job is to:
 *   1. Track how far down the user has scrolled (max position
 *      relative to the page, capped at 100).
 *   2. Track how many seconds the lesson has been in the
 *      foreground (visibility API + setInterval).
 *   3. Persist both to `user_lesson_progress` via a debounced
 *      server action.
 *   4. Auto-mark the lesson as completed when the user has
 *      scrolled >= 80% AND spent >= 30 seconds reading.
 *   5. Render the "Mark as read" button as a manual fallback
 *      for users who don't trigger the auto-complete.
 *
 * The tracker is a separate component so the lesson reader
 * page can stay a Server Component for the markdown body
 * + lesson resources. Only the tracker itself needs the
 * 'use client' boundary.
 */

interface LessonProgressTrackerProps {
  lessonId: string;
  initialCompleted: boolean;
  /** Optional: read_seconds the user has already accumulated (from a prior visit). */
  initialReadSeconds?: number;
  /** Optional: scroll_depth_pct the user has already reached. */
  initialScrollDepthPct?: number;
}

const SCROLL_AUTOCOMPLETE_PCT = 80;
const TIME_AUTOCOMPLETE_SECS = 30;
const SCROLL_SAVE_DEBOUNCE_MS = 4000;
const TIME_SAVE_INTERVAL_MS = 15000;

export function LessonProgressTracker({
  lessonId,
  initialCompleted,
  initialReadSeconds = 0,
  initialScrollDepthPct = 0,
}: LessonProgressTrackerProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [savingHint, setSavingHint] = useState<'idle' | 'saving' | 'saved'>('idle');

  // The deepest scroll position reached this visit. We don't read this
  // back from state during render (would cause re-renders on every
  // scroll event), we keep it in a ref and read it from a ref-backed
  // callback. This is the standard "throttle via ref" pattern.
  const maxScrollPctRef = useRef<number>(initialScrollDepthPct);
  const maxScrollSeenOnServerRef = useRef<number>(initialScrollDepthPct);
  const accumulatedReadSecondsRef = useRef<number>(0);
  const lastSavedSecondsRef = useRef<number>(initialReadSeconds);
  const lastAutoCompleteAttemptRef = useRef<boolean>(initialCompleted);

  // Refs to the latest save/save-status functions so the visibility /
  // scroll handlers can call them without re-binding on every render.
  const saveRef = useRef<(() => void) | null>(null);

  // ── Save function: persists the current snapshot to the server. Called
  //    on debounced scroll, on the time interval, and on page hide.
  const performSave = useRef(async (markDone: boolean | null = null) => {
    const scrollPct = maxScrollPctRef.current;
    const readSecs = Math.max(0, accumulatedReadSecondsRef.current);

    // Skip the network round-trip if nothing changed since the last save.
    if (
      scrollPct === maxScrollSeenOnServerRef.current &&
      readSecs === lastSavedSecondsRef.current &&
      markDone === null
    ) {
      return;
    }

    setSavingHint('saving');
    const res = await updateLessonProgress(lessonId, {
      scrollDepthPct: scrollPct,
      readSeconds: readSecs - lastSavedSecondsRef.current, // delta since last save
      completed: markDone === true ? true : undefined,
    });

    if (res.error) {
      // Non-fatal — log and keep going. The user can still mark as
      // read manually; we just lose granular progress data on this save.
      console.warn('[LessonProgressTracker] save failed:', res.error);
      setSavingHint('idle');
      return;
    }

    if (markDone === true && res.data?.completed) {
      setCompleted(true);
      lastAutoCompleteAttemptRef.current = true;
    }
    maxScrollSeenOnServerRef.current = scrollPct;
    lastSavedSecondsRef.current = readSecs;
    setSavingHint('saved');
    // Fade the "Saved" hint back to idle after a moment.
    setTimeout(() => setSavingHint('idle'), 1500);
    // Silence unused-var warning.
    void markDone;
  });

  // ── Scroll tracking: passive listener, throttled to once per
  //    SCROLL_SAVE_DEBOUNCE_MS. Computes the deepest position reached.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.max(0, Math.min(100, (window.scrollY / max) * 100));
      if (pct > maxScrollPctRef.current) {
        maxScrollPctRef.current = pct;
      }
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        performSave.current(null);
      }, SCROLL_SAVE_DEBOUNCE_MS);
    };

    // Run once on mount in case the user reloaded mid-lesson.
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  // ── Time tracking: setInterval ticks every second, but only
  //    counts when the tab is visible. Saves every TIME_SAVE_INTERVAL_MS.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let isVisible = document.visibilityState === 'visible';
    const onVisibility = () => {
      isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = setInterval(() => {
      if (isVisible) {
        accumulatedReadSecondsRef.current += 1;
      }
      // Every TIME_SAVE_INTERVAL_MS ticks, persist.
      if (accumulatedReadSecondsRef.current % TIME_SAVE_INTERVAL_MS === 0) {
        performSave.current(null);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ── Auto-complete check: when scroll >= 80% AND read >= 30s, mark
  //    complete. Throttled so we only attempt once per session.
  useEffect(() => {
    if (lastAutoCompleteAttemptRef.current) return;
    const totalSeconds = lastSavedSecondsRef.current + accumulatedReadSecondsRef.current;
    if (
      maxScrollPctRef.current >= SCROLL_AUTOCOMPLETE_PCT &&
      totalSeconds >= TIME_AUTOCOMPLETE_SECS
    ) {
      performSave.current(true);
    }
  });

  // ── Final save on page hide / unload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHide = () => performSave.current(null);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // Keep the saveRef pointed at the latest performSave.current.
  saveRef.current = () => performSave.current(null);

  // ── Manual "mark as read" button.
  const handleMarkRead = async () => {
    const res = await markLessonRead(lessonId);
    if (res.error) {
      console.warn('[LessonProgressTracker] markLessonRead failed:', res.error);
      return;
    }
    setCompleted(true);
    lastAutoCompleteAttemptRef.current = true;
  };

  if (completed) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-tactical-neon font-bold">
        <CheckCircle2 className="w-4 h-4" />
        Lesson complete
        {savingHint === 'saving' && (
          <span className="text-[10px] text-white/30 font-normal">· saving…</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <button
        onClick={handleMarkRead}
        className={cn(
          'flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-colors',
          'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
        )}
      >
        <Circle className="w-4 h-4" />
        Mark as read
      </button>
      {savingHint === 'saving' && (
        <span className="text-[10px] text-white/30">saving progress…</span>
      )}
      {savingHint === 'saved' && (
        <span className="text-[10px] text-white/30">saved</span>
      )}
    </div>
  );
}
