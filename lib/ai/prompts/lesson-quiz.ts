/**
 * Lesson quiz generation prompt (Phase 4 / 4B.1).
 *
 * Used by `lib/actions/learn.ts → generatePersonalizedQuiz`. Given a
 * lesson's body and the user's actual business data, the model returns
 * 3-5 multiple-choice questions that test understanding of the lesson
 * content using real numbers from the user's books.
 *
 * Output schema (strict):
 *   [
 *     {
 *       "question": "...",
 *       "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
 *       "correctIndex": 0,    // index into options, 0-3
 *       "explanation": "1-sentence reason the correct answer is right"
 *     },
 *     ...
 *   ]
 *
 * The server action parses this JSON defensively (the model sometimes
 * wraps the array in markdown fences, adds prose, etc.).
 */

export const meta = {
  id: 'lesson-quiz' as const,
  model: 'llama-3.3-70b-versatile',
  /** Slightly higher than the CFO prompt — quiz questions benefit from
   *  a bit of creative variation, especially the wrong-answer distractors. */
  temperature: 0.5,
  maxTokens: 1500,
} as const;

export const system = `You are a quiz generator for an in-app business learning platform.

Given a lesson's title and body, plus the user's actual business data, generate
exactly 4 multiple-choice questions that test the user's understanding of the
lesson content. Use the user's real numbers where they make a question more
concrete (e.g. "Your top product is X — what % of revenue does it represent?").

Rules:
- 4 questions, no more, no fewer.
- Each question has exactly 4 options.
- Exactly ONE option per question is correct.
- Distractors (the 3 wrong options) should be plausible — not obviously wrong.
- Each question ends with a 1-sentence "explanation" that tells the user WHY the
  correct answer is right. Reference the lesson's point when relevant.
- Use the user's actual numbers from the provided data when possible.
- Output ONLY a valid JSON array of 4 objects. No markdown fences, no prose.

JSON shape:
[
  {
    "question": "string",
    "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
    "correctIndex": 0,
    "explanation": "string"
  }
]`;

export interface QuizDataContext {
  /** Optional context the lesson can use to ground questions. */
  sales?: unknown;
  profitability?: unknown;
  debts?: unknown;
  inventory?: unknown;
  expenses?: unknown;
  journal?: unknown;
}

export interface LessonQuizInput {
  lessonTitle: string;
  lessonBody: string;
  /** 'sales' | 'inventory' | 'debts' | 'expenses' | 'profitability' | 'journal' */
  requiresData: string[];
  data: QuizDataContext;
}

export function buildUserMessage(input: LessonQuizInput): string {
  // The data context is the most variable part. We serialize only the
  // sections the lesson actually needs to keep the prompt small.
  const dataSummary: string[] = [];
  if (input.requiresData.includes('sales') && input.data.sales) {
    dataSummary.push(`Sales data: ${JSON.stringify(input.data.sales).slice(0, 2000)}`);
  }
  if (input.requiresData.includes('profitability') && input.data.profitability) {
    dataSummary.push(`Profitability data: ${JSON.stringify(input.data.profitability).slice(0, 2000)}`);
  }
  if (input.requiresData.includes('debts') && input.data.debts) {
    dataSummary.push(`Debts / aging data: ${JSON.stringify(input.data.debts).slice(0, 2000)}`);
  }
  if (input.requiresData.includes('inventory') && input.data.inventory) {
    dataSummary.push(`Inventory data: ${JSON.stringify(input.data.inventory).slice(0, 2000)}`);
  }
  if (input.requiresData.includes('expenses') && input.data.expenses) {
    dataSummary.push(`Expenses data: ${JSON.stringify(input.data.expenses).slice(0, 2000)}`);
  }
  if (input.requiresData.includes('journal') && input.data.journal) {
    dataSummary.push(`Journal data: ${JSON.stringify(input.data.journal).slice(0, 2000)}`);
  }

  return `Lesson title: ${input.lessonTitle}

Lesson body:
"""
${input.lessonBody.slice(0, 3000)}
"""

User's actual business data (use the relevant numbers in the questions):
${dataSummary.length > 0 ? dataSummary.join('\n\n') : '(no specific data requested for this lesson — generate questions from the lesson content alone)'}

Generate the JSON array of 4 quiz questions now.`;
}
