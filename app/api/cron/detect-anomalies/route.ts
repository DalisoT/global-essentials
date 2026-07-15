import { NextRequest, NextResponse } from 'next/server';
import { runAnomalyDetectionCron } from '@/lib/actions/anomaly-detection';

/**
 * Vercel Cron endpoint (Phase 9 / 9.4).
 *
 * Hit nightly after the forecast regen (configured in
 * vercel.json). Scans the last 7 days of revenue and expenses
 * against a 30-day baseline, flags outliers as `kind='anomaly'`
 * rows in `ai_recommendations`.
 *
 * Idempotent: anomalies are upserted on (kind, related_id=date)
 * so re-running on the same day just refreshes the body.
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
  const result = await runAnomalyDetectionCron();
  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    return NextResponse.json(
      {
        startedAt,
        finishedAt,
        error: result.message,
        scannedDays: result.scannedDays,
        detected: result.detected,
        inserted: result.inserted,
        updated: result.updated,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt,
    scannedDays: result.scannedDays,
    detected: result.detected,
    inserted: result.inserted,
    updated: result.updated,
  });
}
