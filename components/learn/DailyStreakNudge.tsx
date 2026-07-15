'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getStreakSummary } from '@/lib/actions/learn';

/**
 * DailyStreakNudge (Phase 4 / 4D.3).
 *
 * Mounted once in the (pos) layout. On mount, it asks the server
 * for the user's current streak stats. If the user has a streak of
 * 2+ days AND hasn't completed anything today, it surfaces a sonner
 * toast that nudges them to read a lesson.
 *
 * We don't trigger when:
 *   - The user has never completed a lesson (no streak to lose)
 *   - The user has completed a lesson today (no nudge needed)
 *   - The current local hour is before 9 AM (don't nag first thing)
 *   - We've already nudged today (localStorage dedupe key)
 *
 * The nudge is a one-time-per-day in-app reminder, NOT a real web
 * push notification. The real web-push flow requires a service worker
 * + backend worker; that's a Phase 4+ effort.
 *
 * The component renders nothing visible — it only fires the toast.
 */

const NUDGE_KEY_PREFIX = 'learn-streak-nudge-';
const NUDGE_HOUR_LOCAL = 9;

export function DailyStreakNudge() {
  const firedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (firedRef.current) return;

    // Compute today's date in the user's local timezone (Zambia is
    // consistent at GMT+2, but we honour the browser's clock).
    const now = new Date();
    if (now.getHours() < NUDGE_HOUR_LOCAL) return;

    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD (local-ish)
    const dedupeKey = NUDGE_KEY_PREFIX + today;
    try {
      if (localStorage.getItem(dedupeKey)) return;
    } catch {
      // localStorage may be disabled (private mode etc.) — fall
      // through and still try the nudge. Worst case: nudge fires
      // more than once across a session, which is annoying but
      // not harmful.
    }

    firedRef.current = true;
    (async () => {
      const res = await getStreakSummary();
      if (res.error || !res.data) return;
      const { streakDays, completedToday, totalCompleted } = res.data;
      if (completedToday) return;
      // Only nudge users with a real streak (≥2 days) — first-time
      // users don't have a streak to lose.
      if (streakDays < 2) return;
      // And only if they've completed at least 2 lessons historically,
      // so the streak number isn't a fluke.
      if (totalCompleted < 2) return;

      try {
        localStorage.setItem(dedupeKey, '1');
      } catch {
        // Ignore.
      }

      toast(
        `${streakDays}-day streak — keep it going! Read today's lesson to keep the fire alive.`,
        {
          description: 'Takes 5 minutes. New content every week.',
          icon: <Flame className="w-5 h-5 text-tactical-amber" />,
          duration: 8000,
          action: {
            label: "Show me today's lesson",
            onClick: () => {
              // We can't import Link / useRouter here without
              // dragging in extra deps; window.location is fine
              // for a toast CTA. The dashboard widget (4C.5) is
              // the proper destination.
              window.location.href = '/learn';
            },
          },
        }
      );
    })();
  }, [mounted]);

  return null;
}

/**
 * Lightweight version of the streak summary for the /learn home (4C.6).
 * Same action, no toast — just returns the stats for the chip.
 */
export async function fetchStreakSummary() {
  const res = await getStreakSummary();
  return res.data ?? null;
}

// Re-export Sparkles so other learn components can use it for
// celebratory toasts.
export { Sparkles };
