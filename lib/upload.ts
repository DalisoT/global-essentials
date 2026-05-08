'use client';

import { createBrowserClient } from '@supabase/ssr';

export async function uploadProductImageDirect(file: File): Promise<{ url: string; error: string | null }> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: '', error: 'Not authenticated' };

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

  // Direct browser upload via Supabase storage (no base64, no server action)
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return { url: '', error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl, error: null };
}