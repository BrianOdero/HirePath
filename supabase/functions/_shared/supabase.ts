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
  const anonKey = env('SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}
