import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';
import {
  getPillarBySlug,
  getLessonsByPillar,
} from '@/lib/actions/learn';
import { resolvePillarIcon, pillarColorClasses } from '@/lib/learn/pillar-ui';

/**
 * Learning Academy — pillar lesson list (Phase 4 / 4C.2).
 *
 * Server component. Renders the pillar header (icon, name, description,
 * lesson count) and an ordered list of lessons for the pillar. Each
 * lesson card links to the reader (4C.3 — `/(pos)/learn/[pillarSlug]/[lessonSlug]/`).
 *
 * Per the roadmap split, this page intentionally does NOT show
 * progress / completion state — that lands in 4D.1 (read-time tracking)
 * and 4D.2 (bookmarks). The cards just show title + read time + a
 * "Read lesson" affordance.
 */

export default async function PillarPage({
  params,
}: {
  params: { pillarSlug: string };
}) {
  const { data: pillar, error: pillarError } = await getPillarBySlug(params.pillarSlug);
  if (pillarError || !pillar) notFound();

  const { data: lessons, error: lessonsError } = await getLessonsByPillar(pillar.id);
  const Icon = resolvePillarIcon(pillar.icon);
  const color = pillarColorClasses(pillar.color);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All pillars
      </Link>

      {/* Pillar header */}
      <div className={`card-tactical relative overflow-hidden border ${color.border}`}>
        <div className={`absolute -top-12 -right-12 w-48 h-48 ${color.bgBlur} rounded-full blur-3xl`} />
        <div className="relative flex items-start gap-4">
          <div className={`w-14 h-14 shrink-0 rounded-2xl ${color.bg} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${color.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tighter">
              {pillar.name}
            </h1>
            {pillar.description && (
              <p className="text-sm text-white/60 mt-1 leading-relaxed">
                {pillar.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-3 text-[10px] uppercase tracking-widest font-bold text-white/40">
              <BookOpen className="w-3 h-3" />
              {pillar.lessonCount} {pillar.lessonCount === 1 ? 'lesson' : 'lessons'}
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {lessonsError && (
        <div className="card-tactical border-tactical-red/30 bg-tactical-red/10 p-4">
          <p className="text-sm text-tactical-red font-bold">Couldn&apos;t load lessons</p>
          <p className="text-xs text-white/60 mt-1">{lessonsError}</p>
        </div>
      )}

      {/* Empty state */}
      {!lessonsError && (!lessons || lessons.length === 0) && (
        <div className="card-tactical text-center py-12">
          <BookOpen className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40 uppercase tracking-widest">
            No lessons in this pillar yet
          </p>
        </div>
      )}

      {/* Lesson list */}
      {lessons && lessons.length > 0 && (
        <div className="space-y-2">
          {lessons.map((lesson, idx) => (
            <Link
              key={lesson.id}
              href={`/learn/${pillar.slug}/${lesson.slug}`}
              className="card-tactical flex items-center gap-3 hover:bg-white/5 transition-colors group"
            >
              {/* Numbered marker */}
              <div className={`w-9 h-9 shrink-0 rounded-xl ${color.bg} flex items-center justify-center`}>
                <span className={`text-sm font-black ${color.icon}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-snug">
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] uppercase tracking-widest font-bold text-white/40">
                  <Clock className="w-3 h-3" />
                  {lesson.est_minutes} min read
                  {lesson.requires_data && lesson.requires_data.length > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <span>
                        Tied to: {lesson.requires_data.slice(0, 2).join(', ')}
                        {lesson.requires_data.length > 2 && ` +${lesson.requires_data.length - 2}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
