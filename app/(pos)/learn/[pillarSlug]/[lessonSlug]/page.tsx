import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight, Clock, ExternalLink, BookOpen } from 'lucide-react';
import {
  getLessonBySlug,
  getLessonResources,
  getPillarBySlug,
  getUserLessonProgress,
} from '@/lib/actions/learn';
import { resolvePillarIcon, pillarColorClasses } from '@/lib/learn/pillar-ui';
import { Markdown, markdownToPlainText } from '@/lib/learn/markdown';
import { TakeQuizButton } from '@/components/learn/TakeQuizButton';
import { LessonProgressTracker } from '@/components/learn/LessonProgressTracker';
import { LessonBookmarkButton } from '@/components/learn/LessonBookmarkButton';
import { LessonAudioButton } from '@/components/learn/LessonAudioButton';
import type { Lesson, LessonResource } from '@/lib/supabase-types';

/**
 * Learning Academy — lesson reader (Phase 4 / 4C.3 + 4D.1).
 *
 * Server component. Renders:
 *   1. Back link → pillar lesson list
 *   2. Breadcrumb: Pillar › Lesson title
 *   3. Lesson header (title, est_minutes, "Take quiz" button)
 *   4. Markdown body (small inline renderer — see lib/learn/markdown.tsx)
 *   5. <LessonProgressTracker /> — invisible client component that
 *      tracks scroll depth + foreground read time and auto-marks
 *      the lesson complete (4D.1).
 *   6. "Apply to your business" — list of lesson_resources as buttons
 *   7. "Take quiz" — the TakeQuizButton client component (4B.1)
 *
 * The tracker needs to be inside the page so it can read scroll
 * events; we render it at the bottom of the article so the "Mark
 * as read" button sits where the user naturally finishes.
 *
 * Audio playback (4B.2) and the lesson-completion celebration
 * (4C.6) are intentionally NOT in this commit — they land later
 * with their own features.
 *
 * The pillar slug + lesson slug are both in the URL so users can
 * share links like /learn/financial-literacy/what-is-gross-margin.
 */

export default async function LessonPage({
  params,
}: {
  params: { pillarSlug: string; lessonSlug: string };
}) {
  // Fetch pillar (for the header) + lesson + resources in parallel.
  // getPillarBySlug isn't strictly required (the lesson row includes
  // the pillar info via the join in getLessonBySlug) but it's a
  // clean way to surface a "pillar not found" 404 vs a "lesson not
  // found" 404.
  const [pillarResult, lessonResult] = await Promise.all([
    getPillarBySlug(params.pillarSlug),
    getLessonBySlug(params.pillarSlug, params.lessonSlug),
  ]);

  if (pillarResult.error || !pillarResult.data) notFound();
  if (lessonResult.error || !lessonResult.data) notFound();

  const pillar = pillarResult.data;
  const lesson = lessonResult.data as Lesson & { pillar?: { slug: string; name: string; color: string | null; icon: string | null } };

  const { data: resources } = await getLessonResources(lesson.id);

  // 4D.1 — fetch the user's prior progress for this lesson so the
  // tracker can resume from where they left off and won't re-trigger
  // the auto-complete for already-finished lessons.
  const { data: progress } = await getUserLessonProgress(lesson.id);
  const initialCompleted = !!progress?.completedAt;
  const initialReadSeconds = progress?.readSeconds ?? 0;
  const initialScrollDepthPct = progress?.scrollDepthPct ?? 0;
  // 4D.2 — initial bookmark state for the header button.
  const initialBookmarked = progress?.bookmarked ?? false;

  const Icon = resolvePillarIcon(lesson.pillar?.icon ?? pillar.icon);
  const color = pillarColorClasses(lesson.pillar?.color ?? pillar.color);

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href={`/learn/${params.pillarSlug}`}
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {pillar.name}
      </Link>

      {/* Lesson header */}
      <div className={`card-tactical relative overflow-hidden border ${color.border}`}>
        <div className={`absolute -top-12 -right-12 w-48 h-48 ${color.bgBlur} rounded-full blur-3xl`} />
        <div className="relative space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Link href={`/learn/${params.pillarSlug}`} className="hover:text-white/70">
              {pillar.name}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/60 truncate">Lesson</span>
          </div>

          {/* Title row */}
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 shrink-0 rounded-2xl ${color.bg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${color.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black tracking-tighter leading-tight">
                {lesson.title}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] uppercase tracking-widest font-bold text-white/40">
                <Clock className="w-3 h-3" />
                {lesson.est_minutes} min read
                {lesson.requires_data && lesson.requires_data.length > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <BookOpen className="w-3 h-3" />
                    <span>
                      Tied to: {lesson.requires_data.slice(0, 3).join(', ')}
                      {lesson.requires_data.length > 3 && ` +${lesson.requires_data.length - 3}`}
                    </span>
                  </>
                )}
              </div>
            </div>
            {/* 4D.2 — bookmark button */}
            <LessonBookmarkButton lessonId={lesson.id} initialBookmarked={initialBookmarked} />
          </div>

          {/* 4B.2 — audio narration (Listen button). Uses pre-generated
              audio_url when present, otherwise Web Speech fallback. */}
          <div className="pt-1">
            <LessonAudioButton
              audioUrl={lesson.audio_url ?? null}
              bodyText={markdownToPlainText(lesson.body_md)}
              lessonTitle={lesson.title}
              colorClass={`${color.bg} border ${color.border} ${color.icon}`}
            />
          </div>

          {/* Take quiz button (client) */}
          <div className="pt-1">
            <TakeQuizButton lessonId={lesson.id} lessonTitle={lesson.title} />
          </div>
        </div>
      </div>

      {/* Lesson body — markdown rendered */}
      <article className="card-tactical">
        <Markdown source={lesson.body_md} />
      </article>

      {/* 4D.1 — read-time tracker. Lives at the bottom of the article
          so the manual "Mark as read" button sits where users finish. */}
      <LessonProgressTracker
        lessonId={lesson.id}
        initialCompleted={initialCompleted}
        initialReadSeconds={initialReadSeconds}
        initialScrollDepthPct={initialScrollDepthPct}
      />

      {/* Apply to your business — lesson_resources */}
      {resources && resources.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
              Apply to your business
            </h2>
            <p className="text-xs text-white/40 mt-1">
              These links open the parts of the app that use this lesson&apos;s ideas.
            </p>
          </div>
          <div className="space-y-2">
            {resources.map((r: LessonResource) => (
              <ResourceLink key={r.id} resource={r} color={color} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Resource link — handles internal routes, external URLs, and app:// actions
// ─────────────────────────────────────────────────────────────────────

function ResourceLink({
  resource,
  color,
}: {
  resource: LessonResource;
  color: ReturnType<typeof pillarColorClasses>;
}) {
  const isExternal = /^https?:\/\//i.test(resource.href);
  const isApp = resource.href.startsWith('app://');
  const linkProps = isExternal
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {};

  const inner = (
    <>
      <span>{resource.label}</span>
      {isExternal ? (
        <ExternalLink className="w-3.5 h-3.5 text-white/40" />
      ) : isApp ? (
        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-purple/20 text-tactical-purple ml-auto">
          App
        </span>
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
      )}
    </>
  );

  // For now we just render an <a> for everything. app:// actions can
  // be wired up to a runtime dispatcher in a future commit.
  return (
    <Link
      href={isApp ? '#' : resource.href}
      {...linkProps}
      className={`card-tactical flex items-center gap-3 hover:${color.border} transition-colors`}
    >
      <div className={`w-1 h-10 rounded-full ${color.bg}`} />
      <div className="flex-1 min-w-0 flex items-center gap-2 text-sm font-semibold">
        {inner}
      </div>
    </Link>
  );
}
