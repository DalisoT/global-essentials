/**
 * AI CFO Copilot — function-calling engine (Phase 3 / 3A.3).
 *
 * The loop:
 *   1. Build messages: system prompt + (optional) history + user question
 *   2. Call Groq with `tools: CFO_TOOLS`
 *   3. If the response contains `tool_calls`, execute each one via
 *      `cfoToolHandlers`, append the results to messages, and re-call.
 *   4. When the model returns a final text answer (no tool_calls), stop.
 *   5. Cap at `MAX_ITERATIONS` to prevent runaway loops.
 *
 * Errors are not fatal: a tool that throws or returns `{ ok: false }` is
 * surfaced to the model as a tool result, so it can either retry, try
 * another tool, or admit it can't answer. The only thing that throws
 * out of `runCfoEngine` is a complete Groq failure (network, auth, 5xx).
 *
 * The engine itself is pure — it does not call `requireAuth`, write to
 * `audit_log`, or record `ai_usage`. Those concerns live in the calling
 * server action (`lib/actions/cfo.ts` in 3A.5) so the engine stays
 * testable and reusable (e.g. the analytics route can adopt it later).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'groq-sdk/resources/chat/completions';
import groq from '@/lib/groq';
import { cfoSystem } from '@/lib/ai/prompts';
import { CFO_TOOLS } from './tools';
import { cfoToolHandlers, type ToolResult } from './cfo-tools';

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

/** A prior message in the conversation (user or assistant turns only —
 * the engine owns the tool_call / tool_result messages internally). */
export interface CfoHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CfoToolCallRecord {
  /** snake_case tool name (e.g. 'get_pnl'). */
  name: string;
  /** Parsed args the model passed to the tool. */
  args: Record<string, unknown>;
  /** Handler result. */
  result: ToolResult;
  /** Wall-clock duration of the tool call, ms. */
  durationMs: number;
}

export interface CfoUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CfoRunResult {
  /** Final assistant text answer. May be empty if the engine hit MAX_ITERATIONS. */
  answer: string;
  /** All tool calls the model made during the run, in order. */
  toolCalls: CfoToolCallRecord[];
  /** Aggregated token usage across every Groq call in the run. */
  usage: CfoUsage;
  /** How many Groq calls the engine made. */
  iterations: number;
  /** True if the engine stopped because it hit MAX_ITERATIONS, not because
   * the model produced a final answer. */
  hitIterationCap: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────

/** Hard cap on the number of model + tool rounds. Prevents runaway loops
 * when the model keeps calling tools without converging. */
const MAX_ITERATIONS = 5;

/** Temperature / token limits come from the prompt module. The engine
 * doesn't own these — the prompt is the source of truth. */
const MODEL = cfoSystem.meta.model;
const TEMPERATURE = cfoSystem.meta.temperature;
const MAX_TOKENS = cfoSystem.meta.maxTokens;

// ─────────────────────────────────────────────────────────────────────
// The loop
// ─────────────────────────────────────────────────────────────────────

export interface RunCfoEngineOptions {
  /** Conversation history (user/assistant turns only). Defaults to []. */
  history?: CfoHistoryMessage[];
  /** Override the cap for this run. Mostly useful for tests. */
  maxIterations?: number;
}

export async function runCfoEngine(
  supabase: SupabaseClient,
  question: string,
  options: RunCfoEngineOptions = {}
): Promise<CfoRunResult> {
  const history = options.history ?? [];
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;

  if (!question || !question.trim()) {
    throw new Error('Question is required');
  }

  // Build the initial message list. We use a `ChatCompletionMessageParam[]`
  // so the messages we push later (assistant tool-call messages, tool
  // result messages) match the SDK's typing.
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: cfoSystem.system },
    ...history.map<ChatCompletionMessageParam>((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const toolCalls: CfoToolCallRecord[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let iterations = 0;
  let answer = '';
  let hitIterationCap = false;

  while (iterations < maxIterations) {
    iterations += 1;

    // 1) Call Groq. `groq-sdk` is fully typed here so no `as any` is needed
    //    except for the `tools` param (the SDK accepts it but the union
    //    type doesn't include the narrow `ChatCompletionTool` shape we use
    //    in `tools.ts`).
    const response: ChatCompletion = await groq.chat.completions.create({
      tools: CFO_TOOLS as any,
      messages,
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    });

    // 2) Accumulate usage. The field is optional in some SDK versions, so
    //    guard every read.
    const u = response.usage;
    if (u) {
      promptTokens += u.prompt_tokens ?? 0;
      completionTokens += u.completion_tokens ?? 0;
      totalTokens += u.total_tokens ?? 0;
    }

    const choice = response.choices?.[0];
    const message = choice?.message;
    if (!message) {
      throw new Error('Groq returned no message');
    }

    // 3) Final-answer case: no tool_calls → we're done.
    const calls = message.tool_calls;
    if (!calls || calls.length === 0) {
      answer = (message.content || '').trim();
      // Append the assistant's final message to history for the caller.
      messages.push({ role: 'assistant', content: message.content ?? '' });
      break;
    }

    // 4) Tool-call case: append the assistant message (with tool_calls)
    //    to the conversation, then append one tool result message per call.
    //    The SDK types assistant-with-tool-calls as a discriminated
    //    `ChatCompletionAssistantMessageParam`, but casting is simpler
    //    than threading the union through here.
    messages.push(message as unknown as ChatCompletionMessageParam);

    for (const call of calls) {
      const record = await executeToolCall(supabase, call);
      toolCalls.push(record);

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(record.result),
      } as ChatCompletionMessageParam);
    }

    // If we just hit the cap on the last allowed iteration, fall out and
    // synthesize a best-effort answer below.
    if (iterations >= maxIterations) {
      hitIterationCap = true;
    }
  }

  // 5) If the engine stopped because of the cap (not because the model
  //    produced a final answer), make one more call WITHOUT tools so the
  //    model has to commit to a text answer based on what it has gathered.
  if (hitIterationCap && !answer) {
    const final = await groq.chat.completions.create({
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            "You've used your tool budget. Based on the data you've already gathered, give me a concise final answer now. If the data is incomplete, say so explicitly.",
        },
      ],
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    });
    const u = final.usage;
    if (u) {
      promptTokens += u.prompt_tokens ?? 0;
      completionTokens += u.completion_tokens ?? 0;
      totalTokens += u.total_tokens ?? 0;
    }
    answer = (final.choices?.[0]?.message?.content || '').trim();
  }

  return {
    answer,
    toolCalls,
    usage: { promptTokens, completionTokens, totalTokens },
    iterations,
    hitIterationCap,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

async function executeToolCall(
  supabase: SupabaseClient,
  call: ChatCompletionMessageToolCall
): Promise<CfoToolCallRecord> {
  const name = call.function.name;
  let args: Record<string, unknown> = {};
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    // Malformed JSON from the model — treat as empty args and let the
    // handler deal with the consequences (or fail informatively).
    args = {};
  }

  const handler = cfoToolHandlers[name];
  const start = Date.now();
  let result: ToolResult;
  if (!handler) {
    result = { ok: false, error: `Unknown tool: ${name}` };
  } else {
    try {
      result = await handler(supabase, args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result = { ok: false, error: `Tool threw: ${msg}` };
    }
  }
  const durationMs = Date.now() - start;

  return { name, args, result, durationMs };
}
