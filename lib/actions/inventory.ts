'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

export async function getInventory(options?: { limit?: number; offset?: number }) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: [], error: auth.error };
  const supabase = auth.supabase;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  return { data: data || [], error, count };
}

export async function createProduct(product: {
  name: string;
  cost_price: number;
  selling_price: number;
  stock_level: number;
  image_urls?: string[];
  is_visible_in_catalog?: boolean;
  catalog_price?: number | null;
}) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  if (!product.name?.trim()) return { data: null, error: 'Product name is required' };
  if (isNaN(product.cost_price) || product.cost_price < 0) return { data: null, error: 'Invalid cost price' };
  if (isNaN(product.selling_price) || product.selling_price < 0) return { data: null, error: 'Invalid selling price' };
  if (isNaN(product.stock_level) || product.stock_level < 0) return { data: null, error: 'Invalid stock level' };

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name: product.name.trim(),
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      stock_level: product.stock_level,
      image_urls: product.image_urls || null,
      is_visible_in_catalog: product.is_visible_in_catalog ?? true,
      catalog_price: product.catalog_price ?? null,
    }])
    .select()
    .single();

  return { data, error };
}

export async function updateProduct(
  id: string,
  product: {
    name?: string;
    cost_price?: number;
    selling_price?: number;
    stock_level?: number;
    image_urls?: string[];
    is_visible_in_catalog?: boolean;
    catalog_price?: number | null;
  }
) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  if (product.stock_level !== undefined && (isNaN(product.stock_level) || product.stock_level < 0)) {
    return { data: null, error: 'Stock level cannot be negative' };
  }
  if (product.cost_price !== undefined && (isNaN(product.cost_price) || product.cost_price < 0)) {
    return { data: null, error: 'Cost price cannot be negative' };
  }
  if (product.selling_price !== undefined && (isNaN(product.selling_price) || product.selling_price < 0)) {
    return { data: null, error: 'Selling price cannot be negative' };
  }

  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteProduct(id: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error };
}

export async function uploadProductImages(imageDataArray: string[]) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  const results = await Promise.all(
    imageDataArray.map((imageData) => uploadProductImage(imageData, supabase))
  );

  const errors = results.filter((r) => r.error || !r.data);
  if (errors.length > 0) {
    return { data: null, error: errors[0].error || 'Upload failed' };
  }

  const uploadedUrls = results.map((r) => r.data!);
  return { data: uploadedUrls, error: null };
}

export async function uploadProductImage(imageData: string, supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  if (!supabase) {
    const auth = await requireAuth();
    if ('error' in auth) return { data: null, error: auth.error };
    supabase = auth.supabase;
  }
  try {
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { data: null, error: 'Invalid image data format' };
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const fileExt = extMap[mimeType] || 'jpg';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(mimeType)) {
      return { data: null, error: 'Invalid file type' };
    }

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { data: null, error: uploadError.message };
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return { data: data.publicUrl, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}