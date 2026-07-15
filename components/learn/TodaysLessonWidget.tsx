import Link from 'next/link';
import { GraduationCap, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { resolvePillarIcon, pillarColorClasses } from '@/lib/learn/pillar-ui';
import type { Pillar } from '@/lib/supabase-types';

/**
 * TodaysLessonWidget (Phase 4 / 4C.5).
 *
 * Server component. Renders the dashboard card for "Today's lesson".
 * The card shows:
 *   - A small "TODAY" eyebrow + pillar name
 *   - The lesson title (large, bold)
 *   - A reason line ("Pick up where you left off", "Today's pick", etc.)
 *   - A progress bar when the user has some read time
 *   - A CTA arrow on the right
 *
 * Renders nothing if there's no picked lesson (the dashboard itself
 * decides whether to mount the widget at all).
 */

interface TodaysLessonWidgetProps {
  lesson: {
    id: string;
    slug: string;
    title: string;
    est_minutes: number;
  };
  pillar: Pick<Pillar, 'id' | 'slug' | 'name' | 'color' | 'icon'>;
  reason: 'in_progress' | 'next_unread' | 'fallback';
  progressPct: number;
}

const REASON_LABEL: Record<TodaysLessonWidgetProps['reason'], string> = {
  in_progress: 'Pick up where you left off',
  next_unread: "Today's pick for you",
  fallback: 'Start with this lesson',
};

export function TodaysLessonWidget({
  lesson,
  pillar,
  reason,
  progressPct,
}: TodaysLessonWidgetProps) {
  const Icon = resolvePillarIcon(pillar.icon);
  const color = pillarColorClasses(pillar.color);

  return (
    <Link
      href={`/learn/${pillar.slug}/${lesson.slug}`}
      className={`card-tactical relative overflow-hidden border ${color.border} block hover:bg-white/[0.02] transition-colors`}
    >
      <div className={`absolute -top-12 -right-12 w-48 h-48 ${color.bgBlur} rounded-full blur-3xl`} />
      <div className="relative flex items-center gap-4">
        {/* Pillar icon */}
        <div className={`w-12 h-12 shrink-0 rounded-2xl ${color.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color.icon}`} />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40">
            <Sparkles className="w-3 h-3" />
            <span>Today</span>
            <span className="text-white/20">·</span>
            <span className={color.icon}>{pillar.name}</span>
          </div>
          <p className="font-black text-base leading-snug mt-1 truncate">
            {lesson.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] uppercase tracking-widest font-bold text-white/40">
            <BookOpen className="w-3 h-3" />
            {lesson.est_minutes} min
            <span className="text-white/20">·</span>
            <span>{REASON_LABEL[reason]}</span>
          </div>
          {progressPct > 0 && progressPct < 1 && (
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full ${color.bg} transition-all`}
                style={{ width: `${Math.round(progressPct * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* CTA arrow */}
        <div className={`shrink-0 w-10 h-10 rounded-full ${color.bg} flex items-center justify-center`}>
          <ArrowRight className={`w-5 h-5 ${color.icon}`} />
        </div>
      </div>
    </Link>
  );
}

// Re-export GraduationCap so the import above can be used by callers
// that want to wrap the widget in a "Learning Academy" section header
// without an extra import.
export { GraduationCap };
