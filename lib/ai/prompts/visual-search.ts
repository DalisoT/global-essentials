/**
 * Visual product search prompt (Phase 8 / 8.2).
 *
 * Used by `lib/actions/catalog.ts → visualSearch`. Given an image
 * uploaded by the user and the list of product names available in
 * the shop's catalog, the model picks the top matches.
 *
 * Why we send the product name list (not the full catalog):
 *   - Vision models have limited context. Sending 14 product rows
 *     with images would blow the budget. Names are tiny.
 *   - We only need the model to PICK from the list, not to invent
 *     new products. Constraining the answer space gives cleaner
 *     output.
 *
 * If the catalog grows past ~50 products we'll need to chunk the
 * list or move to a vector-embedding approach. For v1, the list
 * is small enough to fit in a single prompt.
 */

export const meta = {
  id: 'visual-search' as const,
  model: 'llama-3.2-11b-vision-preview',
  /** Low temperature — we want the model's best single guess, not
   *  three different picks on three different runs. */
  temperature: 0.1,
  /** Vision model context is much smaller than text-only models.
   *  Cap output to keep the response time tight. */
  maxTokens: 200,
} as const;

export const system = `You match a product photo to a shop's catalog. Given an
image of a product and a list of product names the shop sells,
return a JSON array of the top 1-3 best matches in order of
confidence. The match must be a literal product name from the
list — do not invent new names, do not paraphrase.

If nothing in the catalog resembles the image, return an empty
array. Do not force a match.

Output ONLY a valid JSON array of strings. No markdown fences, no
prose, no explanations.

Example output:
["Black Leather Wallet", "Brown Canvas Wallet"]

Example empty output:
[]`;

export interface VisualSearchInput {
  productNames: string[];
  /** Optional user hint: "looking for something like X". */
  hint?: string;
}

/**
 * Builds the user-prompt text. The image itself is attached
 * separately by the action as a vision content block.
 */
export function buildUserMessage(input: VisualSearchInput): string {
  const list = input.productNames.length > 0
    ? input.productNames.map((n, i) => `${i + 1}. ${n}`).join('\n')
    : '(catalog is empty)';
  const hintLine = input.hint
    ? `\nUser hint: "${input.hint}"\n`
    : '';
  return `Catalog (${input.productNames.length} products):
${list}
${hintLine}
Return the top 1-3 matches as a JSON array of product names from the catalog above, ordered by match confidence. Empty array if nothing matches.`;
}
