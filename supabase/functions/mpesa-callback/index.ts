// M-Pesa / Daraja callback — invoked by Safaricom after STK push result.
// Marks the payment paid/failed (persisting result detail) and activates
// (or renews) Pro on success. Idempotent + quick HTTP 200 per the doc.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { activatePro } from '../_shared/subscription.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Deno env: ${name}`);
  return value;
}

function summarize(body: object): {
  checkoutRequestId?: string;
  code?: string;
  desc?: string;
} {
  const stk = (body as Record<string, unknown>).Body?.stkCallback;
  if (!stk) return {};
  return {
    checkoutRequestId: String(stk.CheckoutRequestID ?? ''),
    code: String(stk.ResultCode ?? ''),
    desc: String(stk.ResultDesc ?? ''),
  };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { checkoutRequestId, code, desc } = summarize(body);

    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

    // ---- locate payment (service role, no RLS)
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId ?? '')
      .maybeSingle();

    // Acknowledge even when payment unknown (replay-guard: idempotent).
    if (!payment || findError) {
      return json({ responseCode: '0', message: 'payment_not_found' });
    }

    if (payment.status !== 'pending') return json({ responseCode: '0', message: 'already_processed' });

    const success = code === '0';

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: success ? 'paid' : 'failed',
        result_code: code || null,
        result_desc: desc || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) return json({ responseCode: '1', message: 'payment_update_failed' });

    if (success) {
      await activatePro(supabase, payment.user_id);
    }

    return json({ responseCode: '0', message: 'ok' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return json({ responseCode: '1', message }, 200);
  }
});