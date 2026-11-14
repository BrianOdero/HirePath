import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Deno env: ${name}`);
  return value;
}

/**
 * Supabase client bound to the authenticated user from the incoming
 * request Authorization header (validated via getUser()).
 */
export function createAuthedClient(authHeader: string | null) {
  if (!authHeader) throw new Error('Missing authorization header');
  const url = env('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!key) throw new Error('Missing SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY)');
  return createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
  });
}
