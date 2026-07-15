import { NextRequest, NextResponse } from 'next/server';
import { runGoalProgressCron } from '@/lib/actions/goals';

/**
 * Vercel Cron endpoint (Phase 9 / 9.5).
 *
 * Hit nightly after anomaly detection (configured in
 * vercel.json). Re-measures progress on every active goal
 * and upserts a `kind='goal_progress'` recommendation for
 * each one. Idempotent: re-running on the same day just
 * refreshes the body in case the numbers moved.
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
  const result = await runGoalProgressCron();
  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    return NextResponse.json(
      {
        startedAt,
        finishedAt,
        error: result.message,
        updated: result.updated,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt,
    updated: result.updated,
  });
}
