import { NextRequest, NextResponse } from 'next/server';
import { runWeeklyBriefingCron } from '@/lib/actions/weekly-briefing';

/**
 * Vercel Cron endpoint (Phase 9 / 9.3).
 *
 * Hit weekly at Sunday 08:00 Africa/Lusaka (= 06:00 UTC,
 * configured in vercel.json). Generates a weekly briefing
 * from the past 7 days and persists it as a
 * `kind='weekly_briefing'` row in `ai_recommendations`. The
 * user sees it in their inbox (and, in v2, will get it
 * emailed).
 *
 * Auth: Vercel Cron sends a `Authorization: Bearer
 * <CRON_SECRET>` header. We verify it. Without CRON_SECRET
 * in env, the route refuses every request (no silent
 * fallback).
 *
 * Idempotency: the action upserts on (kind, related_id =
 * weekStartISO), so the same week can be re-run safely
 * (e.g. on a manual retry) without spamming the inbox.
 */

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  // 1) Auth
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on the server' },
      { status: 500 }
    );
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2) Run
  const startedAt = new Date().toISOString();
  const result = await runWeeklyBriefingCron();
  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        finishedAt,
        error: result.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt,
    recommendationId: result.recommendation?.id,
    title: result.recommendation?.title,
    message: result.message,
  });
}
