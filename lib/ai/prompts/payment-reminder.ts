/**
 * Payment reminder prompt.
 *
 * Used by `lib/actions/ai.ts → generatePaymentReminder`. Produces a WhatsApp-
 * ready short message for clients with overdue or upcoming installments.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'payment-reminder' as const,
  /** Always the same Groq model family for now. Centralized so we can swap later. */
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 256,
} as const;

export const system = `You are a professional debt collection assistant for a business called "Global Essentials".
Generate a polite, firm but friendly payment reminder message.
The message should:
- Be concise (under 300 characters)
- Include the amount due and due date
- Mention the product name if provided
- Be professional but warm in tone
- Not include any placeholders - use the actual values provided
- End with "- Global Essentials"
Do NOT use emojis.`;

export interface PaymentReminderInput {
  clientName: string;
  /** Pre-formatted currency string (e.g. "K250.00") — use whatever your formatter produced. */
  amount: string;
  /** Pre-formatted date string. */
  dueDate: string;
  productName?: string;
  paymentHistory?: string;
}

export function buildUserMessage(input: PaymentReminderInput): string {
  return `Generate a payment reminder for ${input.clientName}.
Amount: ${input.amount}
Due Date: ${input.dueDate}
Product: ${input.productName || 'your purchase'}
Payment History: ${input.paymentHistory || 'this is a new customer'}`;
}
