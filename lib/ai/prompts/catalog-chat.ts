/**
 * Catalog chatbot prompt (Phase 8 / 8.4).
 *
 * Used by `lib/actions/catalog.ts → catalogChat`. Public — no auth
 * required. The chat helps a customer browse a small Zambia
 * online store and answers questions about products, prices, and
 * availability.
 *
 * The system prompt is intentionally small: it tells the model
 * what it knows (the products the user is looking at) and what
 * it MUST NOT do (invent prices, claim stock we don't have, etc.).
 *
 * Tone:
 *   - Friendly, no hype, plain English.
 *   - Currency in K. No decimals unless meaningful.
 *   - If the user asks something we don't have data for, say so
 *     and suggest they reach the team on WhatsApp.
 *   - Never invent a product that isn't in the supplied list.
 *
 * Output: plain text, no JSON. The model speaks to the customer
 * directly; we don't need a structured response.
 */

export const meta = {
  id: 'catalog-chat' as const,
  model: 'llama-3.3-70b-versatile',
  /** Slightly higher than other prompts — chat benefits from a
   *  bit of natural variation so the conversation doesn't feel
   *  canned. */
  temperature: 0.6,
  /** Cap is on the SMALL side — chat answers should be 1-3 short
   *  paragraphs. Long answers feel like essays. */
  maxTokens: 350,
} as const;

export interface CatalogProductSummary {
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  categoryName?: string | null;
}

export interface CatalogChatInput {
  /** Products the user is currently looking at (the one open in
   *  the product detail page, or the catalog's full list when on
   *  the home page). The model grounds answers in this list. */
  products: CatalogProductSummary[];
  /** The full chat history so far. The user's latest message is
   *  the last entry. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The user's latest message. Pulled out of `history` for
   *  convenience so the prompt can refer to it explicitly. */
  latestUserMessage: string;
  /** Optional context the caller wants to inject. e.g. "the
   *  user is currently on the page for 'Black Wallet'". */
  contextNote?: string;
}

export function buildSystemMessage(input: CatalogChatInput): string {
  const productList = input.products
    .map((p) => {
      const desc = p.description ? ` — ${p.description}` : '';
      const cat = p.categoryName ? ` [${p.categoryName}]` : '';
      return `- ${p.name}${cat} — K${p.price} (${p.stock} in stock)${desc}`;
    })
    .join('\n');

  return `You are a friendly shop assistant for a small Zambia
online store. You help customers find the right product, check
prices and stock, and decide whether to buy.

You know ONLY the products in the list below. Never invent a
product, price, or stock number that isn't on the list.

RULES:
- Speak in plain English, no jargon.
- Mention prices in K (no decimals unless meaningful, e.g. K45.50
  is fine but K45.00 should be K45).
- If the user asks about a product we don't have, say so and
  suggest they contact the team on WhatsApp to special-order it.
- If the user is unsure between two products, give a short
  side-by-side comparison.
- For "do you have X" questions: say yes only if X is in the list
  AND its stock > 0.
- If the conversation is going long, the user wants to place an
  order, or they're asking anything that requires the team (bulk
  orders, custom requests, payment questions), suggest they tap
  the WhatsApp button at the bottom of the chat to talk to a
  real person. Don't push aggressively — one suggestion is enough.
- Keep replies to 1-3 short paragraphs. No bullet lists unless
  the user asks for a comparison.

PRODUCTS IN STOCK (${input.products.length}):
${productList || '(catalog is empty — let the user know gently and suggest WhatsApp)'}
${input.contextNote ? `\nContext: ${input.contextNote}` : ''}`;
}

export function buildUserMessage(input: CatalogChatInput): string {
  return input.latestUserMessage;
}
