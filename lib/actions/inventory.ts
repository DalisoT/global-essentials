'use server';

import { supabase } from '@/lib/supabase';

export async function getInventory(options?: { limit?: number; offset?: number }) {
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
  image_url?: string;
}) {
  const { data, error } = await supabase
    .from('products')
    .insert([{
      name: product.name,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      stock_level: product.stock_level,
      image_url: product.image_url || null,
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
    image_url?: string;
  }
) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error };
}

export async function uploadProductImage(imageData: string) {
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