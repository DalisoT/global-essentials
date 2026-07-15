'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import groq from '@/lib/groq';
import { productDescription, visualSearch } from '@/lib/ai/prompts';

export interface CatalogProductWithImages {
  id: string;
  name: string;
  selling_price: number;
  catalog_price?: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  stock_level: number;
  description?: string;
  images: string[];
}

export async function getCatalogProducts() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description')
    .eq('is_visible_in_catalog', true)
    .gt('stock_level', 0)
    .order('name', { ascending: true });

  // Transform: use catalog_price if set, fall back to selling_price
  const products: CatalogProductWithImages[] = (data || []).map((p) => ({
    ...p,
    selling_price: p.catalog_price ?? p.selling_price,
    images: p.image_urls && p.image_urls.length > 0
      ? p.image_urls
      : p.image_url
        ? [p.image_url]
        : [],
  }));

  return { data: products, error };
}

export async function getProductById(id: string): Promise<{ data: CatalogProductWithImages | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, image_url, image_urls, stock_level')
    .eq('id', id)
    .single();

  if (error) return { data: null, error: 'Product not found' };

  // Fallback: if image_urls is empty/null but image_url exists, use image_url as single-item array
  const images = data.image_urls?.length
    ? data.image_urls
    : data.image_url
      ? [data.image_url]
      : [];

  return { data: { ...data, images }, error: null };
}

// ─────────────────────────────────────────────────────────────────────
// Phase 8.1 — generateProductDescription
// ─────────────────────────────────────────────────────────────────────

export interface ProductDescriptionSuggestion {
  description: string;
  highlights: string[];
  category_label: string;
}

export interface ProductDescriptionContext {
  name: string;
  categoryName: string | null;
  sellingPrice: number | null;
  costPrice: number | null;
  stockLevel: number | null;
  currentDescription: string | null;
}

/**
 * Generate a suggested catalog description for a product.
 * Returns a structured suggestion — the user reviews and edits
 * via saveProductDescription before it goes live.
 */
export async function generateProductDescription(
  productId: string
): Promise<{ data?: ProductDescriptionSuggestion; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  if (!productId) return { error: 'productId is required' };

  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  // 1) Load the product + its category (if any).
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, cost_price, selling_price, stock_level, description, category_id')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    return { error: productError?.message || 'Product not found' };
  }

  let categoryName: string | null = null;
  if ((product as { category_id: string | null }).category_id) {
    const { data: cat } = await supabase
      .from('categories')
      .select('name')
      .eq('id', (product as { category_id: string }).category_id)
      .maybeSingle();
    categoryName = (cat as { name: string } | null)?.name ?? null;
  }

  const ctx: ProductDescriptionContext = {
    name: (product as { name: string }).name,
    categoryName,
    sellingPrice: (product as { selling_price: number | null }).selling_price,
    costPrice: (product as { cost_price: number | null }).cost_price,
    stockLevel: (product as { stock_level: number | null }).stock_level,
    currentDescription: (product as { description: string | null }).description,
  };

  // 2) Call Groq.
  let response;
  try {
    response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: productDescription.system },
        {
          role: 'user',
          content: productDescription.buildUserMessage({
            name: ctx.name,
            categoryName: ctx.categoryName,
            sellingPrice: ctx.sellingPrice,
            costPrice: ctx.costPrice,
            stockLevel: ctx.stockLevel,
            currentDescription: ctx.currentDescription,
          }),
        },
      ],
      model: productDescription.meta.model,
      temperature: productDescription.meta.temperature,
      max_tokens: productDescription.meta.maxTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Couldn't reach the AI (${msg}). Please try again.` };
  }

  const usage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  // 3) Parse the JSON defensively.
  const content = response.choices[0]?.message?.content?.trim() || '';
  const parsed = parseDescriptionResponse(content);
  if (!parsed.description) {
    return {
      error:
        "The AI returned a description I couldn't parse. Please try again — the model occasionally adds prose that breaks the JSON.",
      usage,
    };
  }

  // 4) Best-effort ai_usage + audit_log writes.
  supabase
    .from('ai_usage')
    .insert([{
      user_id: userId,
      route: 'product_description',
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      model: productDescription.meta.model,
    }])
    .then(({ error }) => {
      if (error) console.warn('[generateProductDescription] ai_usage insert failed:', error.message);
    });

  supabase
    .from('audit_log')
    .insert([{
      user_id: userId,
      action: 'product.description_generate',
      entity_type: 'product',
      entity_id: productId,
      metadata: {
        productName: ctx.name,
        categoryName: ctx.categoryName,
        totalTokens: usage.totalTokens,
      },
    }])
    .then(({ error }) => {
      if (error) console.warn('[generateProductDescription] audit_log insert failed:', error.message);
    });

  return { data: parsed, usage };
}

/**
 * Persist the user-edited (or AI-generated) description to a product.
 * Separate from generateProductDescription so the AI can never write
 * to the DB without the user explicitly clicking "Save".
 */
export async function saveProductDescription(
  productId: string,
  description: string
): Promise<{ data?: { description: string }; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  if (!productId) return { error: 'productId is required' };
  // Sanity cap. The description column is TEXT, but anything over
  // ~5000 chars is almost certainly a paste accident.
  const trimmed = description.slice(0, 5000);

  const { data, error } = await supabase
    .from('products')
    .update({ description: trimmed, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select('description')
    .single();

  if (error) return { error: error.message };
  return { data: { description: (data as { description: string }).description } };
}

// ─────────────────────────────────────────────────────────────────────
// Defensive JSON parser
// ─────────────────────────────────────────────────────────────────────

function parseDescriptionResponse(content: string): ProductDescriptionSuggestion {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objMatch) return { description: '', highlights: [], category_label: '' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(objMatch[0]);
  } catch {
    return { description: '', highlights: [], category_label: '' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { description: '', highlights: [], category_label: '' };
  }
  const o = parsed as Record<string, unknown>;
  const description = typeof o.description === 'string' ? o.description.slice(0, 5000) : '';
  const rawHighlights = Array.isArray(o.highlights) ? o.highlights : [];
  const highlights: string[] = [];
  for (const h of rawHighlights) {
    if (typeof h !== 'string') continue;
    const trimmed = h.slice(0, 200).trim();
    if (trimmed) highlights.push(trimmed);
    if (highlights.length >= 5) break;
  }
  const category_label =
    typeof o.category_label === 'string' ? o.category_label.slice(0, 80).trim() : '';
  return { description, highlights, category_label };
}

// ─────────────────────────────────────────────────────────────────────
// Phase 8.2 — visualSearch
// ─────────────────────────────────────────────────────────────────────

export interface VisualSearchMatch {
  product: CatalogProductWithImages;
  /** The model's ranking. 0 = best, higher = worse. */
  rank: number;
}

export interface VisualSearchResult {
  /** Resolved product matches in order of confidence. */
  matches: VisualSearchMatch[];
  /** Names the model returned that we couldn't map to a product. */
  unmatched: string[];
  /** Echo of the input hint, if any. */
  hint: string | null;
}

/**
 * Visual product search. Accepts an image (as a base64 data URL or
 * a publicly accessible URL) and returns the top 1-3 catalog
 * products the model thinks match.
 *
 * Public route — no auth required. Catalog browsing is anonymous.
 *
 * Image input: either `data:image/jpeg;base64,...` (recommended
 * for user uploads) or `https://...` (for already-hosted images).
 *
 * The model can only return names that exist in the catalog — the
 * prompt constrains the output space and we do a strict name match
 * server-side. Anything the model returns that doesn't exist in
 * the catalog is surfaced in `unmatched` for debugging.
 */
export async function searchByImage(input: {
  imageUrl: string;
  hint?: string;
}): Promise<{ data?: VisualSearchResult; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  if (!input.imageUrl) return { error: 'imageUrl is required' };
  // Sanity: the input must look like a data URL or http(s) URL.
  // Anything else is almost certainly an injection attempt.
  if (
    !/^data:image\/(jpeg|png|webp|gif);base64,/i.test(input.imageUrl) &&
    !/^https?:\/\//i.test(input.imageUrl)
  ) {
    return { error: 'imageUrl must be a base64 data URL (image/jpeg, image/png, image/webp, image/gif) or an http(s) URL' };
  }
  if (input.hint && input.hint.length > 200) {
    return { error: 'hint is too long (max 200 chars)' };
  }

  // 1) Fetch the visible catalog — names only, the model doesn't
  //    need descriptions / prices for matching.
  const supabase = await createServerSupabaseClient();
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description')
    .eq('is_visible_in_catalog', true)
    .gt('stock_level', 0)
    .order('name', { ascending: true })
    .limit(100); // hard cap; see comment in visual-search.ts prompt

  if (productsError) return { error: productsError.message };
  if (!products || products.length === 0) {
    return { data: { matches: [], unmatched: [], hint: input.hint ?? null } };
  }

  // 2) Call Groq vision.
  let response;
  try {
    response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: visualSearch.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: visualSearch.buildUserMessage({
              productNames: (products as Array<{ name: string }>).map((p) => p.name),
              hint: input.hint,
            }) },
            { type: 'image_url', image_url: { url: input.imageUrl } },
          ] as Array<{ type: string; text?: string; image_url?: { url: string } }>,
        },
      ] as never,
      model: visualSearch.meta.model,
      temperature: visualSearch.meta.temperature,
      max_tokens: visualSearch.meta.maxTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Couldn't reach the AI (${msg}). Please try again.` };
  }

  const usage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  // 3) Parse the model's JSON array of names.
  const content = response.choices[0]?.message?.content?.trim() || '';
  const matchedNames = parseVisualSearchNames(content);

  // 4) Map names to product rows. Case-insensitive exact match
  //    first; fall back to a simple includes() for fuzzy matching.
  const matched: VisualSearchMatch[] = [];
  const matchedIds = new Set<string>();
  const unmatched: string[] = [];
  type ProductRow = {
    id: string;
    name: string;
    selling_price: number;
    catalog_price?: number | null;
    image_url: string | null;
    image_urls: string[] | null;
    stock_level: number;
    description?: string | null;
  };
  const allRows = (products ?? []) as unknown as ProductRow[];
  const productsByNameLower = new Map<string, ProductRow>();
  for (const p of allRows) {
    productsByNameLower.set(p.name.toLowerCase(), p);
  }
  for (let i = 0; i < matchedNames.length; i++) {
    const name = matchedNames[i];
    const exact = productsByNameLower.get(name.toLowerCase());
    let productRow: ProductRow | undefined = exact;
    if (!productRow) {
      // Fuzzy: pick the first product whose name contains the
      // search term OR vice versa.
      for (const p of allRows) {
        const pname = p.name.toLowerCase();
        const lname = name.toLowerCase();
        if (pname.includes(lname) || lname.includes(pname)) {
          productRow = p;
          break;
        }
      }
    }
    if (productRow && !matchedIds.has(productRow.id)) {
      matchedIds.add(productRow.id);
      matched.push({
        product: {
          ...productRow,
          description: productRow.description ?? undefined,
          selling_price: productRow.catalog_price ?? productRow.selling_price,
          images: productRow.image_urls && productRow.image_urls.length > 0
            ? productRow.image_urls
            : productRow.image_url
              ? [productRow.image_url]
              : [],
        },
        rank: i,
      });
    } else if (!productRow) {
      unmatched.push(name);
    }
    if (matched.length >= 3) break; // Top 3 only.
  }

  return { data: { matches: matched, unmatched, hint: input.hint ?? null }, usage };
}

// ─────────────────────────────────────────────────────────────────────
// Phase 8.3 — getRelatedProducts
// ─────────────────────────────────────────────────────────────────────

export type RelatedReason = 'co_purchase' | 'category' | 'fallback';

export interface RelatedProduct {
  product: CatalogProductWithImages;
  reason: RelatedReason;
  /** For 'co_purchase': number of shared buyers. For 'category' / 'fallback': 0. */
  score: number;
}

/**
 * Returns the products most likely to be useful as "You may also
 * like" recommendations for the given product.
 *
 * Algorithm (3 tiers, in priority order):
 *
 *   1. CO-PURCHASE — find clients who bought this product; count
 *      which other products those same clients bought; return the
 *      top ones. This is the classic "people who bought X also
 *      bought Y" recommender.
 *
 *   2. CATEGORY — if we don't have enough co-purchase data, fall
 *      back to products in the same category (excluding the
 *      current one). Useful for new / niche products.
 *
 *   3. FALLBACK — if even the category has too few products, return
 *      other in-stock products. Better than an empty section.
 *
 * Sales in this app are single-product rows, so the "frequently
 * bought together" pattern is approximated by "clients who bought
 * X also bought Y" across time. Not as tight as a same-cart signal
 * but still useful at this scale.
 */
export async function getRelatedProducts(
  productId: string,
  limit = 6
): Promise<{ data?: RelatedProduct[]; error?: string }> {
  if (!productId) return { error: 'productId is required' };
  limit = Math.max(1, Math.min(20, limit));

  const supabase = await createServerSupabaseClient();

  // 1) Load the current product.
  const { data: current, error: currentError } = await supabase
    .from('products')
    .select('id, name, category_id, is_visible_in_catalog, stock_level, deleted_at')
    .eq('id', productId)
    .is('deleted_at', null)
    .maybeSingle();

  if (currentError) return { error: currentError.message };
  if (!current) return { data: [] };

  const currentRow = current as {
    id: string;
    name: string;
    category_id: string | null;
    is_visible_in_catalog?: boolean;
    stock_level: number;
  };

  // 2) Tier 1: co-purchase. Find clients who bought this product,
  //    then aggregate the OTHER products those clients bought.
  const { data: sharedClientRows, error: sharedError } = await supabase
    .from('sales')
    .select('client_id')
    .eq('product_id', productId)
    .is('deleted_at', null);

  if (!sharedError && sharedClientRows && sharedClientRows.length > 0) {
    const clientIds = Array.from(
      new Set(
        (sharedClientRows as Array<{ client_id: string | null }>)
          .map((r) => r.client_id)
          .filter((id): id is string => !!id)
      )
    );

    if (clientIds.length > 0) {
      const { data: otherSales, error: otherError } = await supabase
        .from('sales')
        .select('product_id')
        .in('client_id', clientIds)
        .neq('product_id', productId)
        .is('deleted_at', null);

      if (!otherError && otherSales) {
        // Count occurrences per product.
        const counts = new Map<string, number>();
        for (const s of otherSales as Array<{ product_id: string | null }>) {
          if (!s.product_id) continue;
          counts.set(s.product_id, (counts.get(s.product_id) ?? 0) + 1);
        }
        const topIds = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit * 2) // over-fetch in case some are out of stock
          .map(([id]) => id);

        if (topIds.length > 0) {
          const { data: topProducts, error: topError } = await supabase
            .from('products')
            .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description, is_visible_in_catalog, deleted_at')
            .in('id', topIds)
            .eq('is_visible_in_catalog', true)
            .gt('stock_level', 0)
            .is('deleted_at', null);

          if (!topError && topProducts && topProducts.length > 0) {
            const enriched: RelatedProduct[] = (topProducts as unknown as CatalogProductWithImages[] & Array<{ id: string; image_url: string | null; image_urls: string[] | null; catalog_price?: number | null }>)
              .map((p) => ({
                product: {
                  ...p,
                  selling_price: p.catalog_price ?? p.selling_price,
                  images: p.image_urls && p.image_urls.length > 0
                    ? p.image_urls
                    : p.image_url
                      ? [p.image_url]
                      : [],
                },
                reason: 'co_purchase' as const,
                score: counts.get(p.id) ?? 0,
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);

            if (enriched.length > 0) return { data: enriched };
          }
        }
      }
    }
  }

  // 3) Tier 2: same category.
  if (currentRow.category_id) {
    const { data: sameCat, error: catError } = await supabase
      .from('products')
      .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description, is_visible_in_catalog, deleted_at')
      .eq('category_id', currentRow.category_id)
      .neq('id', productId)
      .eq('is_visible_in_catalog', true)
      .gt('stock_level', 0)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    if (!catError && sameCat && sameCat.length > 0) {
      return {
        data: (sameCat as unknown as CatalogProductWithImages[] & Array<{ image_url: string | null; image_urls: string[] | null; catalog_price?: number | null }>).map((p) => ({
          product: {
            ...p,
            selling_price: p.catalog_price ?? p.selling_price,
            images: p.image_urls && p.image_urls.length > 0
              ? p.image_urls
              : p.image_url
                ? [p.image_url]
                : [],
          },
          reason: 'category' as const,
          score: 0,
        })),
      };
    }
  }

  // 4) Tier 3: fallback — other visible, in-stock products.
  const { data: fallback, error: fallbackError } = await supabase
    .from('products')
    .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description, is_visible_in_catalog, deleted_at')
    .neq('id', productId)
    .eq('is_visible_in_catalog', true)
    .gt('stock_level', 0)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit);

  if (fallbackError) return { error: fallbackError.message };
  return {
    data: (fallback ?? []).map((p) => {
      const row = p as unknown as CatalogProductWithImages & { image_url: string | null; image_urls: string[] | null; catalog_price?: number | null };
      return {
        product: {
          ...row,
          selling_price: row.catalog_price ?? row.selling_price,
          images: row.image_urls && row.image_urls.length > 0
            ? row.image_urls
            : row.image_url
              ? [row.image_url]
              : [],
        },
        reason: 'fallback' as const,
        score: 0,
      };
    }),
  };
}

function parseVisualSearchNames(content: string): string[] {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  // Find the first JSON array.
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayMatch[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed && trimmed.length <= 200) out.push(trimmed);
    if (out.length >= 5) break;
  }
  return out;
}