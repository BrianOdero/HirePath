// mpesa-renewals — scheduled job (pg_cron calls this via /jobs/v1/manual
// or a trigger). Reverts expired pro subscriptions to free so the client
// re-prompts for payment on next open. Push notifications are out of scope
// per the BRD; the in-app paywall handles the renewal prompt.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Deno env: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Invoked by pg_cron via pg_net with the service role key as Bearer token
  // (stored in Supabase Vault). verify_jwt is false for this function.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.replace(/^Bearer\s+/i, '') !== env('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: expired, error: findError } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('tier', 'pro')
    .lt('current_period_end', new Date().toISOString());

  if (findError) return json({ error: 'find_failed' }, 500);

  for (const sub of expired ?? []) {
    await supabase
      .from('subscriptions')
      .update({ tier: 'free', status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sub.id);
  }

  return json({ reverted: expired?.length ?? 0 });
});
