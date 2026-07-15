/**
 * Product description generation prompt (Phase 8 / 8.1).
 *
 * Used by `lib/actions/catalog.ts → generateProductDescription`.
 * Given a product's name, category, and (optionally) price + stock
 * context, the model returns a short catalog-ready description that
 * the user can review and edit before publishing.
 *
 * Output schema:
 *   {
 *     "description": "string (50-100 words, plain prose, no markdown)",
 *     "highlights": ["3-4 short selling points, each < 60 chars"],
 *     "category_label": "string (the model's interpretation of the category)"
 *   }
 *
 * Why this shape:
 *   - `description` is the long-form text that goes into the
 *     catalog's product detail page.
 *   - `highlights` is a list of bullet-point selling points that
 *     could be rendered as a 'Why you'll love it' card on the
 *     product page (Phase 8 follow-up).
 *   - `category_label` is the model's plain-English read of the
 *     category, useful when the user has assigned a category that
 *     doesn't match a known customer-facing label.
 *
 * Tone:
 *   - Friendly, factual, no hype, no "buy now!"
 *   - Zambia small-retail voice: clear, no jargon, prices in K
 *   - For multi-pack items, mention the unit (e.g. "K45 each or
 *     K130 for a pack of 3")
 *   - Never invent specs (e.g. "1.2m cable") the model can't see
 */

export const meta = {
  id: 'product-description' as const,
  model: 'llama-3.3-70b-versatile',
  /** Lower than the lesson prompts — we want consistent, factual
   *  copy, not creative variation between runs. */
  temperature: 0.4,
  maxTokens: 500,
} as const;

export const system = `You write short product descriptions for a small retail
shop in Zambia. The audience is everyday customers browsing the
shop's online catalog. The product names and prices are real —
copy that fakes specifications, materials, or features you don't
have evidence for is worse than no copy at all.

Tone rules:
- Plain prose, no markdown, no bullet characters, no headers.
- 50-100 words for the description. Short sentences. No hype words
  like 'amazing', 'stunning', 'incredible'.
- For multi-pack items, mention the unit (e.g. 'K45 each, or
  K130 for a pack of 3').
- Never invent specs, materials, dimensions, brand stories, or
  certifications the data does not support. If the product is
  just 'Soap' with no further info, say so: a sentence is fine.
- Use K for the Kwacha. No decimals unless they're meaningful
  (K45.50 is fine; K45.00 should be written K45).
- Mention category_label so the model commits to a single
  customer-facing category (e.g. 'Home & Kitchen').

Output ONLY a valid JSON object with the three fields. No markdown
fences, no prose.

JSON shape:
{
  "description": "string (50-100 words, plain prose)",
  "highlights": [
    "string (3-4 selling points, each < 60 chars)"
  ],
  "category_label": "string (1-3 words)"
}`;

export interface ProductDescriptionInput {
  name: string;
  categoryName?: string | null;
  sellingPrice?: number | null;
  costPrice?: number | null;
  stockLevel?: number | null;
  /** Optional existing description to revise (the user may iterate). */
  currentDescription?: string | null;
}

export function buildUserMessage(input: ProductDescriptionInput): string {
  const priceLine =
    typeof input.sellingPrice === 'number'
      ? `Selling price: K${input.sellingPrice}.`
      : '';
  const costLine =
    typeof input.costPrice === 'number'
      ? `Cost (internal, never shown to customers): K${input.costPrice}.`
      : '';
  const stockLine =
    typeof input.stockLevel === 'number'
      ? `In stock: ${input.stockLevel} unit${input.stockLevel === 1 ? '' : 's'}.`
      : '';
  const categoryLine = input.categoryName
    ? `Category (internal): ${input.categoryName}.`
    : '';
  const reviseLine = input.currentDescription
    ? `Existing description (revise, don't copy verbatim):\n"""\n${input.currentDescription}\n"""\n`
    : '';

  return `Product name: ${input.name}

${categoryLine}
${priceLine}
${costLine}
${stockLine}
${reviseLine}

Write the JSON object now.`;
}
