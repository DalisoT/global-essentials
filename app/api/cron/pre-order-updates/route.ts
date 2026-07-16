import { NextRequest, NextResponse } from 'next/server';
import { runPreOrderUpdatesCron } from '@/lib/actions/pre-orders-cron';

/**
 * Vercel Cron endpoint (Phase 11 / 11.10).
 *
 * Hit nightly (configured in vercel.json). Walks every
 * active pre-order with a paid deposit and queues any
 * scheduled updates that are due (Day 14 in-transit,
 * Day 30 customs, Day 45 almost-there, +3 days past
 * expected_delivery apology). Idempotent: a cadence key
 * is only queued once per pre-order.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`. We verify it.
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
  const result = await runPreOrderUpdatesCron();
  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        finishedAt,
        error: result.message,
        scanned: result.scanned,
        queued: result.queued,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt,
    scanned: result.scanned,
    queued: result.queued,
    details: result.details,
  });
}
