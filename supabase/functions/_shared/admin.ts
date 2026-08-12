import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Supabase client bound to the service role key. Bypasses RLS entirely,
 * so it must ONLY run server-side (edge functions). The key must never
 * be shipped in client bundles. Callers MUST scope every query by the
 * authenticated user's id — that scope is the only guard once RLS is
 * bypassed.
 */
export function createServiceRoleClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}