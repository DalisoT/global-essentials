/**
 * Review summary prompt (Phase 8 / 8.6).
 *
 * Used by `lib/actions/catalog.ts → summarizeReviews`. Distils the
 * raw approved reviews for a product into a short, scannable
 * summary: overall sentiment, top themes, and a couple of
 * representative quotes. The cache is the existing `forecasts`
 * table with `kind = 'review_summary'` (1-day TTL).
 *
 * Tone:
 *   - Plain English, no marketing-speak.
 *   - Direct quotes must be VERBATIM from the reviews. We
 *     validate that in the action before storing.
 *   - Themes are 1-3 word labels ('durability', 'size runs small',
 *     'great value', etc.) so the UI can render them as chips.
 *   - If there are fewer than 3 reviews, the model still returns
 *     a summary but with fewer themes / quotes.
 */

export const meta = {
  id: 'review-summary' as const,
  model: 'llama-3.3-70b-versatile',
  /** Low temperature — we want a stable, consistent summary, not
   *  a different vibe every time the cache expires. */
  temperature: 0.3,
  maxTokens: 600,
} as const;

export const system = `You summarise product reviews for a Zambia online store.
Given the raw text + star rating of every approved review for one
product, you return a JSON object with:

  - "overall": a 1-2 sentence summary of the overall sentiment
    (e.g. "Overwhelmingly positive, with a few complaints about
    delivery time."). Be honest about mixed reviews.
  - "themes": an array of 1-3 word theme labels, each tagged
    with 'positive', 'negative', or 'mixed'. Sort by frequency
    (most-mentioned first). Cap at 5 themes.
  - "quotes": up to 3 VERBATIM quotes from the reviews, each
    between 8 and 30 words. Trim obvious junk. Don't paraphrase
    — every word must appear in the original review.

Output ONLY a valid JSON object with the three fields. No markdown
fences, no prose, no apology if there are few reviews.

JSON shape:
{
  "overall": "string (1-2 sentences)",
  "themes": [
    { "label": "string (1-3 words)", "sentiment": "positive|negative|mixed" }
  ],
  "quotes": ["string (verbatim)"]
}`;

export interface ReviewSummaryInput {
  productName: string;
  reviews: Array<{
    rating: number; // 1-5
    comment: string | null;
    reviewerName?: string;
  }>;
}

export function buildUserMessage(input: ReviewSummaryInput): string {
  const reviewLines = input.reviews
    .map((r, i) => {
      const text = r.comment?.trim() || '(no comment, rating only)';
      return `Review ${i + 1} (${r.rating}/5 by ${r.reviewerName ?? 'Anonymous'}): ${text}`;
    })
    .join('\n');

  const counts = input.reviews.reduce(
    (acc, r) => {
      acc.total += 1;
      acc.sumRating += r.rating;
      if (r.rating >= 4) acc.positive += 1;
      else if (r.rating === 3) acc.neutral += 1;
      else acc.negative += 1;
      return acc;
    },
    { total: 0, sumRating: 0, positive: 0, neutral: 0, negative: 0 }
  );
  const avg = counts.total > 0 ? (counts.sumRating / counts.total).toFixed(1) : '0';

  return `Product: ${input.productName}

${counts.total} approved reviews · average ${avg}/5 (${counts.positive} positive, ${counts.neutral} neutral, ${counts.negative} negative)

${reviewLines}

Return the JSON object now.`;
}
