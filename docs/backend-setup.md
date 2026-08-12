# ============================================================
# HirePath — Backend Setup on the Supabase Platform
# No local Supabase CLI required for the database part: paste SQL
# into the dashboard SQL Editor. Edge Functions are the only piece
# that needs the CLI (one-time, documented in Step 4).
#
# Project ref: vdrdistisykdigqilnpc
# Project URL: https://vdrdistisykdigqilnpc.supabase.co
# ============================================================

## Step 1 — Create the schema (SQL Editor)

1. Open https://supabase.com/dashboard/project/vdrdistisykdigqilnpc/sql
2. Paste the ENTIRE contents of `supabase/migrations/20260811000001_init.sql`
3. Run it. Expected output: `Success. No rows returned`.

Creates: `profiles` (+ trigger that auto-creates it from auth.users on
signup), `interview_sessions`, `session_messages`, `subscriptions`,
`payments` — all with RLS, and enables Realtime on
session_messages / payments / subscriptions.

## Step 2 — Schedule the Pro renewal job (SQL Editor or CLI)

Paste `supabase/scripts/enable-renewals-cron.sql` in the SQL Editor (or
`supabase db query --linked -f supabase/scripts/enable-renewals-cron.sql`).

Enables pg_cron and creates a nightly 02:00 job that directly downgrades
expired Pro subscriptions to free (the pg_cron role bypasses RLS, so no
service-role key is stored anywhere; the client paywall then re-prompts).
No longer uses pg_net/vault.

> Status on this repo's project (vdrdistisykdigqilnpc): **already applied**.

## Step 3 — Edge Function secrets

The hosted functions read their secrets from the platform. All are set via
CLI (or the Edge Functions dashboard):

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...   # done on this project
supabase secrets set OPENROUTER_MODEL=openai/gpt-4o-mini   # optional override
supabase secrets set MPESA_CONSUMER_KEY=...         # Phase D only
supabase secrets set MPESA_CONSUMER_SECRET=...      # Phase D only
supabase secrets set MPESA_SHORTCODE=174379         # sandbox PayBill
supabase secrets set MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
# ^ the shared sandbox test-app passkey for shortcode 174379 (public test
#   credential from the Daraja portal; replace with your app's real one
#   for production — your app's Consumer Key/Secret stay private).
supabase secrets set MPESA_PRICE=1   # KES 1 for testing; restore 250 before shipping
# SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically.
```

- `OPENROUTER_API_KEY` — required by generate-questions + feedback.
  OpenRouter is OpenAI-compatible; the functions default to the free-tier
  `nvidia/nemotron-3-super-120b-a12b:free` model — override with
  `OPENROUTER_MODEL` (e.g. `openai/gpt-4o-mini`) once you top up credits.
  (`OPENAI_API_KEY` also works as an alternative provider.)
- `MPESA_*` secrets power the live M-Pesa STK integration: `stk-push`
  (initiates the prompt; JWT-authed), `mpesa-callback` (Safaricom → our
  public edge URL; activates Pro + persists result codes), `stk-query`
  (status-query fallback when the callback is slow; JWT-authed) and
  `generate-report` (PDF archive). Test numbers from the Daraja sandbox
  portal are required for prompts to actually fire.

## Step 4 — Deploy Edge Functions (CLI, one-time)

## Step 4 — Deploy Edge Functions (CLI, one-time)

The dashboard cannot deploy functions; this requires the Supabase CLI
(`npm install -D supabase`). Status on this repo's project: **already
deployed** — the migration, cron job, and all 5 functions are live, and
`OPENROUTER_API_KEY` is set. To redeploy after code changes:

```bash
supabase link --project-ref vdrdistisykdigqilnpc
supabase db push                   # applies the migrations (idempotent — safe
                                   # even if already run via SQL Editor)

supabase functions deploy generate-questions
supabase functions deploy feedback
supabase functions deploy stk-push
supabase functions deploy stk-query
supabase functions deploy generate-report
supabase functions deploy mpesa-callback --no-verify-jwt
supabase functions deploy mpesa-renewals --no-verify-jwt
```

Or run `./scripts/backend-setup.sh` which does all of the above (update
the values at the top of the file first).

Verify: the Edge Functions dashboard lists 7 functions, each with a
`gpt-4o-mini`/`Function created` deploy log.

## Step 5 — Check the full loop locally

```bash
npm run dev    # http://localhost:5173
```

Sign up with a fresh email (confirmation is enabled — click the link in
the inbox), paste a job description, and generate. Sessions land in the
`interview_sessions` table; feedback lands in `session_messages`.

## Step 6 — Password recovery (email + password accounts)

The app supports "Forgot password?" (`/forgot-password` → sends a reset
email) and `/reset-password` (landing page of the reset link).

One-time setup on the Supabase dashboard:

1. **Auth > URL configuration**: make sure the Site URL matches the
   deployed origin and that Redirect URLs includes
   `http://localhost:5173/reset-password` **and**
   `<deployed-origin>/reset-password`.
2. **Auth > Email > SMTP**: configure a custom SMTP provider. The default
   `no-reply@supabase.co` sender works but is shared across projects and
   is rate-limited; branded emails are more likely to reach the inbox.

> **Native (Capacitor) caveat**: the reset email link opens in the phone's
> browser, not the app — the same limitation as the Google OAuth redirect
> (`VITE_SITE_URL/login`). Deep-link handling (custom URL scheme /
> Universal Links via the Capacitor App plugin) is deferred; until then,
> native users complete password recovery in a mobile browser.

## Step 7 — M-Pesa payment + PDF reports (testing flow)

1. The `20260812000002_payment_reports.sql` migration auto-creates the
   private `payments-reports` storage bucket with path-based RLS
   (each user only touches `payments-reports/<their user id>/`), plus the
   `payments.result_code` / `result_desc` columns from
   `20260812000001_payments_result.sql`.
2. Starting an STK push from the app calls `stk-push` (EAT timestamps,
   cached OAuth token). The payment row is created as `pending`; the
   result arrives either via `mpesa-callback` (Safaricom POSTs to
   `https://vdrdistisykdigqilnpc.supabase.co/functions/v1/mpesa-callback` —
   public HTTPS, per the Daraja doc) or, after ~90s, via `stk-query`.
3. On success the subscription flips to Pro (30 days) and Realtime
   instantly updates the Practice/Profile screens and the /payments page.
4. **PDF report**: /payments → *Download PDF report* → the app POSTs to
   the `generate-report` edge function with its own JWT. The function
   verifies the caller, loads the user's payments with the **service
   role key** (server-side only, strictly scoped to `user_id`), archives
   the PDF into `payments-reports/<user id>/`, and returns the PDF bytes
   directly — the client never touches storage, so no RLS rules apply to
   the download path.
5. Sandbox testing requires Daraja portal test phone numbers and the
   sandbox shortcode/passkey secrets set via Step 3.
