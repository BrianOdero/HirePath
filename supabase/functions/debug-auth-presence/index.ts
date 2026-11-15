// Temp diagnostic v2 — deploy, probe, then DELETE. Reports key shapes
// (length + 5-char prefix only) and getUser() result per candidate key.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

function firstEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) return '';
  return value.split(',')[0].trim();
}

function shape(value: string): { length: number; prefix: string } {
  return { length: value.length, prefix: value.slice(0, 5) };
}

async function tryGetUser(url: string, key: string, authHeader: string | null): Promise<{ ok: boolean; message: string }> {
  const supabase: SupabaseClient = createClient(url, key, {
    global: { headers: { Authorization: authHeader ?? '' } },
  });
  const { error } = await supabase.auth.getUser();
  return { ok: !error, message: error ? error.message : 'ok' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL') ?? '';

  const pluralPub = firstEnv('SUPABASE_PUBLISHABLE_KEYS');
  const anon = firstEnv('SUPABASE_ANON_KEY');
  const pluralSec = firstEnv('SUPABASE_SECRET_KEYS');
  const serviceRole = firstEnv('SUPABASE_SERVICE_ROLE_KEY');

  return json({
    shapes: {
      SUPABASE_PUBLISHABLE_KEYS_first: shape(pluralPub),
      SUPABASE_ANON_KEY: shape(anon),
      SUPABASE_SECRET_KEYS_first: shape(pluralSec),
      SUPABASE_SERVICE_ROLE_KEY: shape(serviceRole),
    },
    getUser: {
      withPluralPublishable: pluralPub ? await tryGetUser(url, pluralPub, authHeader) : null,
      withAnon: anon ? await tryGetUser(url, anon, authHeader) : null,
    },
  });
});
