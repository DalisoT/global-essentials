/**
 * Barrel export for all prompt modules. Import from '@/lib/ai/prompts'
 * rather than reaching into individual files.
 *
 * Each module exports:
 *   - `meta`   — { id, model, temperature, maxTokens }
 *   - `system` — the system prompt string
 *   - `buildUserMessage(input)` — pure function that templates the user prompt
 *   - `XxxInput` — the typed shape of the user-prompt input
 *
 * This convention is set in ROADMAP.md#3A.1. The actual `groq.chat.completions.create`
 * call (with retries, fallback, message history, etc.) stays in the action
 * module that uses the prompt.
 */

export * as paymentReminder from './payment-reminder';
export * as paymentRisk from './payment-risk';
export * as shippingRecommender from './shipping-recommender';
export * as profitabilityAdvisor from './profitability-advisor';
export * as demandAdjustment from './demand-adjustment';
export * as analytics from './analytics';
export * as dailyInsights from './daily-insights';
export * as cfoSystem from './cfo-system';
export * as lessonQuiz from './lesson-quiz';
