import { NextRequest, NextResponse } from 'next/server';
import {
  forceRegenerateForecast,
} from '@/lib/actions/forecast';
import { createServiceRoleClient } from '@/lib/supabase-server';

/**
 * Vercel Cron endpoint (Phase 7 / 7.8).
 *
 * Hit nightly at 02:00 Africa/Lusaka (configured in vercel.json).
 * Regenerates every cached forecast that has expired or is about to
 * expire. Returns a summary of what was touched so the cron logs
 * are debuggable.
 *
 * Auth: Vercel Cron sends a `Authorization: Bearer <CRON_SECRET>`
 * header. We verify it. Without CRON_SECRET in env, the route
 * refuses every request (no silent fallback).
 *
 * Why a single endpoint (not one per kind): the user has one
 * business, the dataset is small, and a single ping is easier to
 * monitor than three separate schedules. The endpoint is idempotent
 * and safe to call multiple times in a row.
 */

const DEFAULT_HORIZONS: Array<{
  kind: 'demand' | 'cashflow' | 'default_risk';
  horizon_days: number;
}> = [
  { kind: 'demand', horizon_days: 30 },
  { kind: 'cashflow', horizon_days: 30 },
  { kind: 'default_risk', horizon_days: 30 },
];

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  // 1) Auth: Vercel Cron sends `Authorization: Bearer <secret>`.
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

  // 2) Use the service-role client to bypass RLS.
  let supabase;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create client' },
      { status: 500 }
    );
  }

  const startedAt = new Date().toISOString();
  const summary = {
    startedAt,
    demand: { touched: 0, errors: [] as string[] },
    cashflow: { touched: 0, errors: [] as string[] },
    default_risk: { touched: 0, errors: [] as string[] },
  };

  // 3) Demand forecasts — one per active product.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .is('deleted_at', null)
    .limit(2000);

  if (productsError) {
    summary.demand.errors.push(productsError.message);
  } else if (products) {
    for (const p of products as Array<{ id: string }>) {
      const res = await forceRegenerateForecast(supabase, 'demand', p.id, 30);
      if (res.error) summary.demand.errors.push(`${p.id}: ${res.error}`);
      else summary.demand.touched += 1;
    }
  }

  // 4) Cashflow forecast — one for the whole business.
  {
    const res = await forceRegenerateForecast(supabase, 'cashflow', null, 30);
    if (res.error) summary.cashflow.errors.push(res.error);
    else summary.cashflow.touched += 1;
  }

  // 5) Default-risk forecasts — one per client with any history.
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id')
    .limit(5000);

  if (clientsError) {
    summary.default_risk.errors.push(clientsError.message);
  } else if (clients) {
    for (const c of clients as Array<{ id: string }>) {
      const res = await forceRegenerateForecast(supabase, 'default_risk', c.id, 30);
      if (res.error) summary.default_risk.errors.push(`${c.id}: ${res.error}`);
      else summary.default_risk.touched += 1;
    }
  }

  const finishedAt = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    finishedAt,
    demand: summary.demand,
    cashflow: summary.cashflow,
    default_risk: summary.default_risk,
  });
}
