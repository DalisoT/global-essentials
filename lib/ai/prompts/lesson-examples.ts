/**
 * Lesson personalized examples prompt (Phase 4 / 4B.3).
 *
 * Used by `lib/actions/learn.ts → generateLessonExamples`. Given a
 * lesson's body and the user's actual business data, the model
 * returns a rewritten version of the lesson body with the user's
 * real numbers used in place of generic example numbers.
 *
 * The output is the same lesson body — same headings, same flow,
 * same structure — but with the concrete examples replaced by
 * numbers from the user's books. This makes the lesson feel like
 * it was written FOR them, not a generic audience.
 *
 * Output schema:
 *   {
 *     "rewrittenBody": "...",   // full markdown body, same structure
 *     "highlights": [           // 2-3 short callouts surfacing the
 *       {                        // numbers the model injected
 *         "label": "string",
 *         "value": "string"
 *       }
 *     ]
 *   }
 *
 * Why a `highlights` array: gives the UI something compact to show
 * ABOVE the rewritten body ("Your gross margin is 32% — see how the
 * lesson applies it"). The body itself is the full explanation.
 */

import type { QuizDataContext } from './lesson-quiz';

export const meta = {
  id: 'lesson-examples' as const,
  model: 'llama-3.3-70b-versatile',
  /** Lower than the quiz prompt — we want the rewritten body to be
   *  factually faithful to the original, not creatively different. */
  temperature: 0.3,
  maxTokens: 2500,
} as const;

export const system = `You are a personalisation engine for an in-app business learning platform.

Given a lesson's title, body, and the user's actual business data, you rewrite
the lesson body so that its generic example numbers are replaced with the
user's real numbers. The structure, tone, and pedagogical content of the
lesson must stay the same — only the example numbers change.

Rules:
- Keep the same headings, paragraph breaks, list structure, and overall flow.
- Replace generic example numbers ("a shop selling 100 items at K50 each")
  with concrete numbers from the user's data ("you sold 73 items at K45 each
  last month").
- Do NOT invent numbers. Only use numbers that appear in the provided data.
  If a number is needed but the data doesn't have it, leave the original
  generic number in place and skip that example.
- Do NOT add new advice or sections. The lesson is the lesson.
- Do NOT change the lesson's voice ("you", "your business", etc.) or its
  formatting (bold, italic, lists).
- The \`rewrittenBody\` field is the COMPLETE lesson body, not a diff or
  patch. The user should be able to read it on its own without the
  original.
- The \`highlights\` array is 2-3 short callouts the UI can show above
  the rewritten body to draw attention to the numbers you injected.
  Each highlight is a {label, value} pair. Examples:
    {"label": "Your monthly revenue", "value": "K12,450"}
    {"label": "Your gross margin", "value": "32%"}
- Output ONLY a valid JSON object with the two fields above. No markdown
  fences, no prose.

JSON shape:
{
  "rewrittenBody": "string (the full lesson body, rewritten)",
  "highlights": [
    { "label": "string", "value": "string" }
  ]
}`;

export interface LessonExamplesInput {
  lessonTitle: string;
  lessonBody: string;
  /** 'sales' | 'inventory' | 'debts' | 'expenses' | 'profitability' | 'journal' */
  requiresData: string[];
  data: QuizDataContext;
}

export function buildUserMessage(input: LessonExamplesInput): string {
  const dataSummary: string[] = [];
  if (input.requiresData.includes('sales') && input.data.sales) {
    dataSummary.push(`Sales data: ${JSON.stringify(input.data.sales).slice(0, 2500)}`);
  }
  if (input.requiresData.includes('profitability') && input.data.profitability) {
    dataSummary.push(`Profitability data: ${JSON.stringify(input.data.profitability).slice(0, 2500)}`);
  }
  if (input.requiresData.includes('debts') && input.data.debts) {
    dataSummary.push(`Debts / aging data: ${JSON.stringify(input.data.debts).slice(0, 2500)}`);
  }
  if (input.requiresData.includes('inventory') && input.data.inventory) {
    dataSummary.push(`Inventory data: ${JSON.stringify(input.data.inventory).slice(0, 2500)}`);
  }
  if (input.requiresData.includes('expenses') && input.data.expenses) {
    dataSummary.push(`Expenses data: ${JSON.stringify(input.data.expenses).slice(0, 2500)}`);
  }
  if (input.requiresData.includes('journal') && input.data.journal) {
    dataSummary.push(`Journal data: ${JSON.stringify(input.data.journal).slice(0, 2500)}`);
  }

  return `Lesson title: ${input.lessonTitle}

Original lesson body:
"""
${input.lessonBody.slice(0, 4000)}
"""

User's actual business data (use these numbers to replace the generic examples):
${dataSummary.length > 0 ? dataSummary.join('\n\n') : '(no specific data requested for this lesson — return the original body unchanged with empty highlights)'}

Rewrite the lesson body now.`;
}
