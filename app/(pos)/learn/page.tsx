import Link from 'next/link';
import { GraduationCap, BookOpen, Flame } from 'lucide-react';
import { getPillars, getStreakSummary } from '@/lib/actions/learn';
import { resolvePillarIcon, pillarColorClasses } from '@/lib/learn/pillar-ui';

/**
 * Learning Academy — pillar grid home (Phase 4 / 4C.1 + 4C.6).
 *
 * Server component. Fetches the 4 pillars + lesson counts via
 * `getPillars()` and renders them as a 1-col (mobile) / 2-col (sm+)
 * grid of tappable cards. Each card links to the pillar's lesson list
 * (4C.2 — `/(pos)/learn/[pillarSlug]/`).
 *
 * 4C.6 adds a streak chip next to the page title. The chip is a
 * server-rendered summary of `getStreakSummary()` so it's always
 * up to date when the user lands on the home page.
 */

export default async function LearnHomePage() {
  const [{ data: pillars, error }, { data: streak }] = await Promise.all([
    getPillars(),
    getStreakSummary(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-black tracking-tighter">Learning Academy</h1>
          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-purple/20 text-tactical-purple">
            Beta
          </span>
          {/* 4C.6 — streak chip. Hidden until the user has at least
              one completed lesson, so new users don't see "0-day". */}
          {streak && streak.totalCompleted > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                streak.streakDays > 0
                  ? 'bg-tactical-amber/20 text-tactical-amber'
                  : 'bg-white/5 text-white/40'
              }`}
              title={
                streak.streakDays > 0
                  ? `Read a lesson today to keep your ${streak.streakDays}-day streak alive`
                  : 'Read a lesson today to start a new streak'
              }
            >
              <Flame className="w-3 h-3" />
              {streak.streakDays}-day streak
            </span>
          )}
        </div>
        <p className="text-white/50 text-xs uppercase tracking-wider">
          Financial literacy · Diversification · Business · Operations
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="card-tactical border-tactical-red/30 bg-tactical-red/10 p-4">
          <p className="text-sm text-tactical-red font-bold">Couldn&apos;t load pillars</p>
          <p className="text-xs text-white/60 mt-1">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && (!pillars || pillars.length === 0) && (
        <div className="card-tactical text-center py-12">
          <GraduationCap className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40 uppercase tracking-widest">
            No pillars yet
          </p>
          <p className="text-xs text-white/30 mt-1">
            Run the seed_learning_academy migration to load the content.
          </p>
        </div>
      )}

      {/* Pillar grid */}
      {pillars && pillars.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pillars.map((pillar) => {
            const Icon = resolvePillarIcon(pillar.icon);
            const color = pillarColorClasses(pillar.color);
            return (
              <Link
                key={pillar.id}
                href={`/learn/${pillar.slug}`}
                className="card-tactical relative overflow-hidden hover:bg-white/5 transition-colors group"
              >
                <div className={`absolute -top-8 -right-8 w-32 h-32 ${color.bgBlur} rounded-full blur-3xl`} />
                <div className="relative flex items-start gap-3">
                  <div className={`w-12 h-12 shrink-0 rounded-2xl ${color.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${color.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black tracking-tighter">
                      {pillar.name}
                    </h2>
                    {pillar.description && (
                      <p className="text-xs text-white/50 mt-1 leading-relaxed">
                        {pillar.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] uppercase tracking-widest font-bold text-white/40">
                      <BookOpen className="w-3 h-3" />
                      {pillar.lessonCount} {pillar.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
