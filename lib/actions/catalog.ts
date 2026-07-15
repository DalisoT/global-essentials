'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import groq from '@/lib/groq';
import { productDescription } from '@/lib/ai/prompts';

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