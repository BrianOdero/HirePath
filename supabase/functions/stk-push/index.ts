import { createAuthedClient } from '../_shared/supabase.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { accessToken, DARAJA, env, stkPassword, timestampEat } from '../_shared/daraja.ts';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  phone: z.string().regex(/^2547\d{8}$/, 'phone must be 2547XXXXXXXX'),
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

    const { phone } = BodySchema.parse(await req.json().catch(() => null));

    const shortcode = env('MPESA_SHORTCODE');
    const passkey = env('MPESA_PASSKEY');
    const amount = Number(env('MPESA_PRICE')) || 1;
    // SUPABASE_URL is injected by the edge runtime: https://<ref>.supabase.co
    const callbackUrl = `${env('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    // Daraja password + timestamp (same EAT timestamp in both)
    const ts = timestampEat();
    const password = stkPassword(shortcode, passkey, ts);

    const payment = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: 'HirePathPro',
      TransactionDesc: 'HirePathPro',
    };

    const res = await fetch(`${DARAJA}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    const daraja = await res.json();

    if (daraja.ResponseCode !== '0') {
      return json({ error: 'daraja_push_failed', detail: daraja }, 502);
    }

    const { data: row, error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        checkout_request_id: daraja.CheckoutRequestID,
        merchant_request_id: daraja.MerchantRequestID ?? null,
        amount,
        phone,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError || !row) return json({ error: 'payment_insert_failed' }, 500);

    return json({
      payment: {
        id: row.id,
        checkoutRequestId: row.checkout_request_id,
        amount: row.amount,
        status: row.status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return json({ error: message }, 500);
  }
});