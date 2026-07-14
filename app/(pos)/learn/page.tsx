import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Layers,
  Briefcase,
  Settings,
  TrendingUp,
  Wallet,
  Target,
  BarChart3,
  Sparkles,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { getPillars } from '@/lib/actions/learn';

/**
 * Learning Academy — pillar grid home (Phase 4 / 4C.1).
 *
 * Server component. Fetches the 4 pillars + lesson counts via
 * `getPillars()` and renders them as a 1-col (mobile) / 2-col (sm+)
 * grid of tappable cards. Each card links to the pillar's lesson list
 * (4C.2 — `/(pos)/learn/[pillarSlug]/`).
 *
 * Icons are resolved server-side from the `icon` column on `pillars`.
 * The schema stores the icon name as a string ('BookOpen', 'Layers',
 * etc.) so the seed migration is portable. New pillars need a new
 * entry in `iconMap` below.
 */

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Layers,
  Briefcase,
  Settings,
  // Add new pillar icons here as the seed grows.
  TrendingUp,
  Wallet,
  Target,
  BarChart3,
  Sparkles,
  Brain,
};

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return GraduationCap;
  return iconMap[name] ?? GraduationCap;
}

export default async function LearnHomePage() {
  const { data: pillars, error } = await getPillars();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tighter">Learning Academy</h1>
          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-purple/20 text-tactical-purple">
            Beta
          </span>
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
            const Icon = resolveIcon(pillar.icon);
            // Map the color token to a Tailwind class for the icon
            // background. Tailwind needs these to be full strings
            // because it doesn't see dynamic class names at build time.
            const colorClass = colorToClass(pillar.color);
            return (
              <Link
                key={pillar.id}
                href={`/learn/${pillar.slug}`}
                className="card-tactical relative overflow-hidden hover:bg-white/5 transition-colors group"
              >
                <div className={`absolute -top-8 -right-8 w-32 h-32 ${colorClass.bgBlur} rounded-full blur-3xl`} />
                <div className="relative flex items-start gap-3">
                  <div className={`w-12 h-12 shrink-0 rounded-2xl ${colorClass.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${colorClass.icon}`} />
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

// ─────────────────────────────────────────────────────────────────────
// Color token → Tailwind class map
// ─────────────────────────────────────────────────────────────────────

interface ColorClasses {
  bg: string;
  bgBlur: string;
  icon: string;
}

function colorToClass(color: string | null): ColorClasses {
  switch (color) {
    case 'tactical-blue':
      return {
        bg: 'bg-tactical-blue/20',
        bgBlur: 'bg-tactical-blue/20',
        icon: 'text-tactical-blue',
      };
    case 'tactical-neon':
      return {
        bg: 'bg-tactical-neon/20',
        bgBlur: 'bg-tactical-neon/20',
        icon: 'text-tactical-neon',
      };
    case 'tactical-orange':
      return {
        bg: 'bg-tactical-orange/20',
        bgBlur: 'bg-tactical-orange/20',
        icon: 'text-tactical-orange',
      };
    case 'tactical-purple':
      return {
        bg: 'bg-tactical-purple/20',
        bgBlur: 'bg-tactical-purple/20',
        icon: 'text-tactical-purple',
      };
    case 'tactical-red':
      return {
        bg: 'bg-tactical-red/20',
        bgBlur: 'bg-tactical-red/20',
        icon: 'text-tactical-red',
      };
    default:
      return {
        bg: 'bg-white/10',
        bgBlur: 'bg-white/5',
        icon: 'text-white/70',
      };
  }
}
