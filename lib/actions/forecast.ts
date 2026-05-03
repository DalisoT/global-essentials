'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

interface DayForecast {
  date: string;
  dayName: string;
  confirmed: number;
  predicted: number;
  upper_bound: number;
  lower_bound: number;
}

interface CashFlowForecast {
  days: DayForecast[];
  total_confirmed: number;
  total_predicted: number;
  ai_explanation: string;
}

export async function getCashFlowForecast(
  days: number = 30
): Promise<{ data?: CashFlowForecast; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Get confirmed installments in the forecast period
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data: installments, error } = await supabase
    .from('installments')
    .select(
      `
      amount_due,
      due_date,
      is_paid,
      sale: sales(total_amount, created_at)
    `
    )
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', endDate.toISOString().split('T')[0]);

  if (error) return { error: error.message };

  // Get historical payment data for predictions
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: historicalPayments } = await supabase
    .from('installments')
    .select('amount_due, paid_at, due_date')
    .gte('paid_at', thirtyDaysAgo.toISOString())
    .eq('is_paid', true);

  // Calculate day-of-week patterns
  const dayPatterns: Record<string, { count: number; total: number }> = {};
  for (const payment of historicalPayments || []) {
    const dayName = new Date(payment.paid_at!).toLocaleDateString('en-US', {
      weekday: 'long',
    });
    if (!dayPatterns[dayName]) {
      dayPatterns[dayName] = { count: 0, total: 0 };
    }
    dayPatterns[dayName].count++;
    dayPatterns[dayName].total += payment.amount_due;
  }

  // Calculate average per day of week
  const avgPerDayOfWeek: Record<string, number> = {};
  for (const [day, pattern] of Object.entries(dayPatterns)) {
    avgPerDayOfWeek[day] = pattern.count > 0 ? pattern.total / pattern.count : 0;
  }

  // Build forecast for each day
  const forecastDays: DayForecast[] = [];
  let totalConfirmed = 0;
  let totalPredicted = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Confirmed = unpaid installments due on this day
    const confirmed = (installments || [])
      .filter((inst) => inst.due_date === dateStr && !inst.is_paid)
      .reduce((sum, inst) => sum + inst.amount_due, 0);

    totalConfirmed += confirmed;

    // Predicted = historical average for this day of week
    const predictedDayAvg = avgPerDayOfWeek[dayName] || 0;
    // Add some confirmed amount to predicted as well (customers often pay on time)
    const predicted = predictedDayAvg + confirmed * 0.3; // 30% of confirmed usually comes in

    totalPredicted += predicted;

    // Bounds (assume 50% variance)
    const upper_bound = predicted * 1.5;
    const lower_bound = predicted * 0.5;

    forecastDays.push({
      date: dateStr,
      dayName,
      confirmed: Math.round(confirmed * 100) / 100,
      predicted: Math.round(predicted * 100) / 100,
      upper_bound: Math.round(upper_bound * 100) / 100,
      lower_bound: Math.round(lower_bound * 100) / 100,
    });
  }

  const aiExplanation = generateForecastExplanation(
    totalConfirmed,
    totalPredicted,
    dayPatterns
  );

  return {
    data: {
      days: forecastDays,
      total_confirmed: Math.round(totalConfirmed * 100) / 100,
      total_predicted: Math.round(totalPredicted * 100) / 100,
      ai_explanation: aiExplanation,
    },
  };
}

function generateForecastExplanation(
  confirmed: number,
  predicted: number,
  dayPatterns: Record<string, { count: number; total: number }>
): string {
  const bestDay = Object.entries(dayPatterns).sort(
    (a, b) => b[1].total - a[1].total
  )[0];

  let explanation = `Based on the next 30 days, you have K${confirmed.toFixed(2)} in confirmed payments due.`;

  if (bestDay) {
    explanation += ` Historically, ${bestDay[0]}s tend to have the highest payment volume (K${bestDay[1].total.toFixed(2)} average).`;
  }

  return explanation;
}