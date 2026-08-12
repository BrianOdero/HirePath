// stk-query — transaction-status fallback (doc §5). Queries Daraja for
// the outcome of a CheckoutRequestID when no callback arrived (~90s).
// Authoritative when a callback is missing: ResultCode 0 => paid + Pro
// activated; any other result => failed. Idempotent.

import { createAuthedClient } from '../_shared/supabase.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { accessToken, DARAJA, env, stkPassword, timestampEat } from '../_shared/daraja.ts';
import { activatePro } from '../_shared/subscription.ts';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  checkoutRequestId: z.string().min(1, 'checkoutRequestId required'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabase = createAuthedClient(req.headers.get('Authorization'));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    const { checkoutRequestId } = BodySchema.parse(await req.json().catch(() => null));

    const shortcode = env('MPESA_SHORTCODE');
    const passkey = env('MPESA_PASSKEY');
    const ts = timestampEat();

    const res = await fetch(`${DARAJA}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: stkPassword(shortcode, passkey, ts),
        Timestamp: ts,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (String(body.ResponseCode ?? body.errorCode ?? '') !== '0' && !('ResultCode' in body)) {
      return json({ error: 'daraja_query_failed', detail: body }, 502);
    }

    // ---- locate the user's own payment
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();

    if (findError) return json({ error: 'payment_lookup_failed' }, 500);
    if (!payment) return json({ error: 'payment_not_found' }, 404);

    if (payment.status === 'paid') return json({ payment: { status: 'paid', alreadyProcessed: true } });
    if (payment.status !== 'pending') {
      return json({ payment: { status: payment.status, alreadyProcessed: true } });
    }

    const resultCode = String(body.ResultCode ?? '');
    const resultDesc = String(body.ResultDesc ?? body.ResponseDescription ?? '');

    // No authoritative result yet — leave the row pending so a late
    // callback can still settle it (never dead-end a payment).
    if (resultCode === '') {
      return json({ payment: { status: 'pending', message: 'no_result_yet' } });
    }

    const success = resultCode === '0';

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: success ? 'paid' : 'failed',
        result_code: resultCode || null,
        result_desc: resultDesc || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) return json({ error: 'payment_update_failed' }, 500);

    if (success) {
      await activatePro(supabase, user.id);
    }

    return json({
      payment: {
        id: payment.id,
        checkoutRequestId,
        status: success ? 'paid' : 'failed',
        resultCode: resultCode || null,
        resultDesc: resultDesc || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return json({ error: message }, 500);
  }
});