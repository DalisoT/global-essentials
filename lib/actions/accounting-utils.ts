/**
 * Phase 1 helpers — kept out of the 'use server' module because Next.js
 * requires every export from a server-actions file to be async.
 */

export type DateRangePreset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface DateRange {
  from: string; // YYYY-MM-DD (inclusive)
  to: string;   // YYYY-MM-DD (inclusive)
}

export function getDateRangeFromPreset(preset: DateRangePreset, custom?: DateRange): DateRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (preset === 'custom' && custom) return custom;
  if (preset === 'today') return { from: fmt(today), to: fmt(today) };
  if (preset === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { from: fmt(start), to: fmt(today) };
  }
  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today) };
  }
  if (preset === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: fmt(start), to: fmt(today) };
  }
  return { from: '2000-01-01', to: fmt(today) };
}