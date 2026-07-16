import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigestCron } from '@/lib/actions/daily-digest';

/**
 * Vercel Cron endpoint (Phase 12 / D).
 *
 * Hit nightly at 19:00 Africa/Lusaka (configured in
 * vercel.json). Builds a short daily digest and persists
 * it as a `kind='custom'` recommendation so the owner
 * sees it first thing in the morning.
 *
 * Idempotency: re-runs on the same day just refresh the
 * body in case the numbers moved (natural key is
 * kind='custom' + related_id=dateISO).
 */

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
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

  const startedAt = new Date().toISOString();
  const result = await runDailyDigestCron();
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
  });
}
