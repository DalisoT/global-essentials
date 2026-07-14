/**
 * Shared UI helpers for the Learning Academy routes.
 *
 * Pure server-component-compatible utilities. No client hooks, no state.
 * Safe to import from any page.tsx or layout.tsx.
 */

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

/**
 * Map the `icon` column on `pillars` to a lucide component. Falls back
 * to GraduationCap for unknown names so a typo in a new seed never
 * crashes the grid.
 *
 * Add new icons here as the seed grows. The full list of pillar icons
 * the seed currently uses: BookOpen, Layers, Briefcase, Settings.
 */
const iconMap: Record<string, LucideIcon> = {
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
  GraduationCap,
};

export function resolvePillarIcon(name: string | null | undefined): LucideIcon {
  if (!name) return GraduationCap;
  return iconMap[name] ?? GraduationCap;
}

/** Map the `color` column to a set of Tailwind classes. */
export interface PillarColorClasses {
  /** Card-icon background. */
  bg: string;
  /** Decorative blurred halo behind the card. */
  bgBlur: string;
  /** Foreground icon/text color. */
  icon: string;
  /** Thin border accent. */
  border: string;
}

export function pillarColorClasses(color: string | null | undefined): PillarColorClasses {
  switch (color) {
    case 'tactical-blue':
      return {
        bg: 'bg-tactical-blue/20',
        bgBlur: 'bg-tactical-blue/20',
        icon: 'text-tactical-blue',
        border: 'border-tactical-blue/30',
      };
    case 'tactical-neon':
      return {
        bg: 'bg-tactical-neon/20',
        bgBlur: 'bg-tactical-neon/20',
        icon: 'text-tactical-neon',
        border: 'border-tactical-neon/30',
      };
    case 'tactical-orange':
      return {
        bg: 'bg-tactical-orange/20',
        bgBlur: 'bg-tactical-orange/20',
        icon: 'text-tactical-orange',
        border: 'border-tactical-orange/30',
      };
    case 'tactical-purple':
      return {
        bg: 'bg-tactical-purple/20',
        bgBlur: 'bg-tactical-purple/20',
        icon: 'text-tactical-purple',
        border: 'border-tactical-purple/30',
      };
    case 'tactical-red':
      return {
        bg: 'bg-tactical-red/20',
        bgBlur: 'bg-tactical-red/20',
        icon: 'text-tactical-red',
        border: 'border-tactical-red/30',
      };
    default:
      return {
        bg: 'bg-white/10',
        bgBlur: 'bg-white/5',
        icon: 'text-white/70',
        border: 'border-white/10',
      };
  }
}
