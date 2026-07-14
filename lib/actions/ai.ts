'use server';

import groq from '@/lib/groq';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { paymentReminder, paymentRisk } from '@/lib/ai/prompts';

interface ReminderContext {
  clientName: string;
  amount: number;
  dueDate: string;
  productName?: string;
  paymentHistory?: string;
}

export async function generatePaymentReminder(context: ReminderContext): Promise<string> {
  const { clientName, amount, dueDate, productName, paymentHistory } = context;

  const messages = [
    { role: 'system' as const, content: paymentReminder.system },
    {
      role: 'user' as const,
      content: paymentReminder.buildUserMessage({
        clientName,
        amount: formatCurrency(amount),
        dueDate: formatDateShort(dueDate),
        productName,
        paymentHistory,
      }),
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: paymentReminder.meta.model,
    temperature: paymentReminder.meta.temperature,
    max_tokens: paymentReminder.meta.maxTokens,
  });

  return response.choices[0]?.message?.content?.trim() ||
    `Hi ${clientName}, this is a reminder that payment of ${formatCurrency(amount)} is due on ${formatDateShort(dueDate)}. Please arrange payment at your earliest convenience. - Global Essentials`;
}

export async function analyzePaymentRisk(
  clientName: string,
  totalDebt: number,
  overdueCount: number,
  onTimePayments: number,
  latePayments: number
): Promise<{
  risk: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
}> {
  const messages = [
    { role: 'system' as const, content: paymentRisk.system },
    {
      role: 'user' as const,
      content: paymentRisk.buildUserMessage({
        clientName,
        totalDebt: formatCurrency(totalDebt),
        overdueCount,
        onTimePayments,
        latePayments,
      }),
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: paymentRisk.meta.model,
    temperature: paymentRisk.meta.temperature,
    max_tokens: paymentRisk.meta.maxTokens,
  });

  try {
    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
  }

  // Default fallback
  if (latePayments > onTimePayments) {
    return {
      risk: 'high',
      message: 'Customer has more late payments than on-time payments.',
      recommendation: 'Consider requiring upfront payment for future purchases.',
    };
  } else if (overdueCount > 2) {
    return {
      risk: 'medium',
      message: 'Customer has multiple overdue installments.',
      recommendation: 'Send reminder and monitor closely.',
    };
  }
  return {
    risk: 'low',
    message: 'Customer has a good payment history.',
    recommendation: 'Continue normal payment terms.',
  };
}
