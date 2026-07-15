'use client';

import { toast } from 'sonner';
import { Flame, PartyPopper, Sparkles } from 'lucide-react';
import { getStreakSummary } from '@/lib/actions/learn';

/**
 * celebration.ts (Phase 4 / 4C.6).
 *
 * Client-side helper that fires a sonner toast when a lesson
 * transitions from "in progress" to "completed". Lives in its own
 * file so any completion source (the auto-tracker, the manual
 * "Mark as read" button, future flows) can re-use it without
 * depending on a specific component.
 *
 * The toast:
 *   - Always: "Lesson complete" headline + a CTA to the Learn home
 *   - Conditionally: streak callout when the user's streak >= 2 days
 *   - Conditionally: 'first lesson' message on the very first one
 *
 * We re-fetch getStreakSummary() rather than relying on the server
 * action's return value, because the new streak count depends on
 * whether the user has already completed anything else today.
 */

export async function fireCompletionCelebration(lessonTitle: string) {
  let streakDays = 0;
  let totalCompleted = 0;
  let completedToday = false;
  try {
    const res = await getStreakSummary();
    if (res.data) {
      streakDays = res.data.streakDays;
      totalCompleted = res.data.totalCompleted;
      completedToday = res.data.completedToday;
    }
  } catch {
    // Non-fatal: the toast still fires, just without streak info.
  }

  // Pick the icon + message based on the milestone.
  let icon: React.ReactNode = <Sparkles className="w-5 h-5 text-tactical-neon" />;
  let headline = 'Lesson complete';
  let description = `Nice work on "${lessonTitle}". Keep the momentum going.`;

  if (totalCompleted === 1) {
    icon = <PartyPopper className="w-5 h-5 text-tactical-amber" />;
    headline = 'First lesson done!';
    description = 'You just finished your first lesson. The streak counter is live — keep it going tomorrow.';
  } else if (streakDays >= 7) {
    icon = <Flame className="w-5 h-5 text-tactical-amber" />;
    headline = `${streakDays}-day streak — on fire!`;
    description = `${totalCompleted} lessons done. Read one more tomorrow to keep the fire alive.`;
  } else if (streakDays >= 3) {
    icon = <Flame className="w-5 h-5 text-tactical-amber" />;
    headline = `${streakDays}-day streak`;
    description = completedToday
      ? "You've already completed a lesson today — anything else is bonus."
      : 'Read one more tomorrow to keep the streak alive.';
  } else if (streakDays >= 2) {
    icon = <Flame className="w-5 h-5 text-tactical-amber" />;
    headline = `${streakDays}-day streak`;
    description = "Keep it up — consistency beats intensity.";
  }

  toast(headline, {
    description,
    icon,
    duration: 7000,
    action: {
      label: 'Browse lessons',
      onClick: () => {
        window.location.href = '/learn';
      },
    },
  });
}
