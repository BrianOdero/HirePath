import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Resolves the admin (server-only) key: prefers the new SUPABASE_SECRET_KEY,
 * falls back to the legacy SUPABASE_SERVICE_ROLE_KEY the platform still
 * auto-injects until the project finishes migrating. Both bypass RLS entirely
 * and must NEVER reach client bundles.
 */
export function adminKey(): string {
  return Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

/**
 * Supabase client bound to the admin key. Bypasses RLS entirely,
 * so it must ONLY run server-side (edge functions). Callers MUST scope every
 * query by the authenticated user's id — that scope is the only guard once
 * RLS is bypassed.
 */
export function createServiceRoleClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = adminKey();
  if (!url || !key) throw new Error('Missing SUPABASE_URL/SUPABASE_SECRET_KEY');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
