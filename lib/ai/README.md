# `lib/ai/` — AI infrastructure

This directory holds everything related to the LLM side of the product.

## Layout

```
lib/ai/
├── prompts/              # Versioned prompt modules (ROADMAP.md#3A.1)
│   ├── payment-reminder.ts
│   ├── payment-risk.ts
│   ├── shipping-recommender.ts
│   ├── profitability-advisor.ts
│   ├── demand-adjustment.ts
│   ├── analytics.ts
│   ├── daily-insights.ts
│   └── index.ts          # Barrel — import from '@/lib/ai/prompts'
├── tools.ts              # Groq function-calling tool schemas (3A.2)
├── cfo-tools.ts          # Server-side implementations of the tools (3A.2)
├── cfo-engine.ts         # Function-calling loop for the CFO Copilot (3A.3)
└── README.md             # You are here
```

## Prompt module convention

Every file in `prompts/` exports the same shape:

```ts
export const meta = {
  id: 'payment-reminder' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 256,
} as const;

export const system = `...`;

export interface XxxInput { ... }

export function buildUserMessage(input: XxxInput): string {
  return `...`;
}
```

Action modules use it like:

```ts
import { paymentReminder } from '@/lib/ai/prompts';

const response = await groq.chat.completions.create({
  messages: [
    { role: 'system', content: paymentReminder.system },
    { role: 'user',   content: paymentReminder.buildUserMessage(input) },
  ],
  model: paymentReminder.meta.model,
  temperature: paymentReminder.meta.temperature,
  max_tokens: paymentReminder.meta.maxTokens,
});
```

Why split this way:
- **One place to grep for "what does the model see"** — every prompt is a single file.
- **Templating lives in pure functions** — testable, type-safe, no side effects.
- **Action modules own the call** — retries, fallback, message history, audit-log writes, and rate limiting stay where they belong.

## Adding a new prompt

1. Create `lib/ai/prompts/<id>.ts` with the three exports.
2. Add a `export * as <id> from './<id>'` line in `prompts/index.ts`.
3. Use it from the action module.

## Adding a new tool (for the CFO engine)

See ROADMAP.md#3A.2 and `tools.ts` (added in that step).
