/**
 * Groq function-calling tool schemas for the AI CFO Copilot (Phase 3).
 *
 * Pure data — no implementations here. Each schema describes one tool the
 * model can call when answering a business question. Implementations live in
 * `./cfo-tools.ts`.
 *
 * The engine in `./cfo-engine.ts` passes these directly to Groq's `tools`
 * parameter, then dispatches the model's tool_calls by name.
 *
 * Wire-format rules (Groq / OpenAI compatible):
 *   - function.name: snake_case, ≤ 64 chars, ^[a-zA-Z0-9_-]+$
 *   - parameters must be a JSON Schema object with `type: 'object'`
 */

import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';

/** Date-range preset used by the financial-statement tools. */
const PRESET_ENUM = ['today', 'week', 'month', 'year', 'all'] as const;

export const CFO_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_pnl',
      description:
        'Compute the Profit & Loss statement for a given period. Returns total revenue, cost of goods sold, gross profit, operating expenses, and net profit, plus per-account breakdown.',
      parameters: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            enum: [...PRESET_ENUM],
            description:
              "Time window. 'month' = current calendar month so far. 'year' = current year. 'all' = lifetime.",
          },
        },
        required: ['preset'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trial_balance',
      description:
        'Return the trial balance: per-account sum of debits and credits within a period, used to verify the books are balanced.',
      parameters: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            enum: [...PRESET_ENUM],
            description: 'Time window for the trial balance.',
          },
        },
        required: ['preset'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description:
        'Return the top products by profit for a period, including revenue, units sold, cost of goods sold, and gross margin percentage. Use when the user asks about best-sellers, top profit engines, or product performance.',
      parameters: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            enum: [...PRESET_ENUM],
            description: 'Time window to measure product performance over.',
          },
          limit: {
            type: 'number',
            description: 'How many top products to return. Defaults to 5, max 20.',
          },
        },
        required: ['preset'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_aging_debts',
      description:
        "Return accounts-receivable aging buckets: how much money is owed and how late each unpaid installment is, broken into 0-30, 31-60, 61-90, and 90+ day buckets. Use when the user asks about overdue debts, collections, or 'who owes me money'.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cash_position',
      description:
        "Return the current cash position: balance on hand (Cash on Hand + Mobile Money + Bank). Use when the user asks 'how much cash do I have', 'what is my runway', or 'can I afford X'.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_slow_moving_stock',
      description:
        "Return products that are sitting in stock without selling — useful for 'dead stock', 'what should I discount', or 'what is tying up my capital' questions. Returns stock value at cost and days since last sale.",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'How many slow-moving products to return. Defaults to 10, max 50.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forecast_demand',
      description:
        "Predict a product's sales volume over a future horizon (1-90 days). Returns a daily series of predicted units (with upper/lower bounds) plus a confidence score (0-1) and the model used (e.g. '14-day moving average'). Use when the user asks 'will I sell enough of X', 'how much should I stock', 'what's the demand trend for X'.",
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description:
              "The product's UUID. Get this from get_top_products or another tool that returns product identifiers.",
          },
          days: {
            type: 'number',
            description:
              'How many days into the future to forecast. Defaults to 30. Capped at 90.',
          },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forecast_cashflow',
      description:
        "Project the business's cash position for the next N days. Returns daily inflow (scheduled installments) vs outflow (logged expenses), the running cumulative cash, and the day cash is lowest. Use when the user asks 'how much cash will I have in 30 days', 'when am I lowest on cash', or 'can I afford to order more stock'.",
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description:
              'How many days into the future to forecast. Defaults to 30. Capped at 90.',
          },
        },
        required: [],
      },
    },
  },
];

/** Map for fast name → schema lookup by the engine. */
export const CFO_TOOLS_BY_NAME: Record<string, ChatCompletionTool> = Object.fromEntries(
  CFO_TOOLS.map((t) => [t.function!.name, t])
);

/** Names of every tool, in declaration order. Useful for tests + the UI disclosure. */
export const CFO_TOOL_NAMES = CFO_TOOLS.map((t) => t.function!.name);

/**
 * Argument types for each tool. Kept here (next to the schemas) so the
 * engine and tools stay in sync at a glance.
 */
export interface GetPnLArgs {
  preset: 'today' | 'week' | 'month' | 'year' | 'all';
}
export interface GetTrialBalanceArgs {
  preset: 'today' | 'week' | 'month' | 'year' | 'all';
}
export interface GetTopProductsArgs {
  preset: 'today' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
}
export interface GetAgingDebtsArgs {
  // No args.
}
export interface GetCashPositionArgs {
  // No args.
}
export interface GetSlowMovingStockArgs {
  limit?: number;
}
export interface ForecastDemandArgs {
  product_id: string;
  days?: number;
}
export interface ForecastCashflowArgs {
  days?: number;
}
