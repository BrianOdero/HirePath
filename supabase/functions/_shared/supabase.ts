import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Deno env: ${name}`);
  return value;
}

/**
 * First non-empty env value (comma-split safe).
 *
 * NOTE on this project's platform injection (verified empirically via the
 * debug-auth-presence probe, 2026-11-15): SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY hold the NEW sb_publishable_/sb_secret_ values,
 * while SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS hold JSON
 * key-definition documents (JWK-style), which are NOT valid API keys.
 * Resolution must therefore prefer the legacy names.
 */
function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value.split(',')[0].trim();
  }
  return '';
}

/**
 * Supabase client bound to the authenticated user from the incoming
 * request Authorization header (validated via getUser()).
 */
export function createAuthedClient(authHeader: string | null) {
  if (!authHeader) throw new Error('Missing authorization header');
  const url = env('SUPABASE_URL');
  const key = firstEnv('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');
  if (!key) throw new Error('Missing SUPABASE_ANON_KEY (publishable) or SUPABASE_PUBLISHABLE_KEY');
  return createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
  });
}
