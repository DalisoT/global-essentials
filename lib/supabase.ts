import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client (anon-key). Same lazy-init pattern as
 * `lib/groq.ts` — we don't want the client to be constructed at
 * module-load time, because (a) `next build` evaluates modules for
 * prerender even when the route never uses the client, and (b) the
 * Supabase SDK throws if the URL/key env vars are missing.
 *
 * Usage is unchanged: `import { supabase } from '@/lib/supabase'`
 * or `import supabase from '@/lib/supabase'`. The Proxy forwards
 * every property access to the real client, constructed on first use.
 */
type SupabaseClient = ReturnType<typeof createClient>;

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    );
  }
  _client = createClient(url, key);
  return _client;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { supabase };
export default supabase;
