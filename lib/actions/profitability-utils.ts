/**
 * Pure helpers for profitability analysis. Kept out of 'use server' so the
 * sync classifier can be reused from client components (e.g. for in-component
 * color decisions).
 */

export type MarginHealth = 'green' | 'yellow' | 'red' | 'gray';

/**
 * Health thresholds:
 *   gray   < 0%   selling below cost — bleeding money
 *   red    0–20%  critically thin / break-even
 *   yellow 20–40% thin-but-okay — review pricing
 *   green  ≥ 40%  healthy retail margin
 */
export function classifyMargin(marginPct: number): MarginHealth {
  if (marginPct < 0) return 'gray';
  if (marginPct < 20) return 'red';
  if (marginPct < 40) return 'yellow';
  return 'green';
}