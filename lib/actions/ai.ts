'use server';

import groq from '@/lib/groq';
import { formatCurrency, formatDateShort } from '@/lib/utils';

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
    {
      role: 'system' as const,
      content: `You are a professional debt collection assistant for a business called "Global Essentials".
Generate a polite, firm but friendly payment reminder message.
The message should:
- Be concise (under 300 characters)
- Include the amount due and due date
- Mention the product name if provided
- Be professional but warm in tone
- Not include any placeholders - use the actual values provided
- End with "- Global Essentials"
Do NOT use emojis.`,
    },
    {
      role: 'user' as const,
      content: `Generate a payment reminder for ${clientName}.
Amount: ${formatCurrency(amount)}
Due Date: ${formatDateShort(dueDate)}
Product: ${productName || 'your purchase'}
Payment History: ${paymentHistory || 'this is a new customer'}`,
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 256,
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
    {
      role: 'system' as const,
      content: `You are a credit risk analyst. Analyze the payment history and provide a risk assessment.
Return a JSON object with:
- risk: "low", "medium", or "high"
- message: A brief explanation (1 sentence)
- recommendation: One actionable suggestion (1 sentence)`,
    },
    {
      role: 'user' as const,
      content: `Analyze payment risk for ${clientName}:
- Total outstanding debt: ${formatCurrency(totalDebt)}
- Number of overdue installments: ${overdueCount}
- On-time payments: ${onTimePayments}
- Late payments: ${latePayments}`,
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 256,
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