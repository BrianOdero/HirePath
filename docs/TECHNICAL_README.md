# HirePath — Technical README

End-to-end technical walkthrough of the HirePath application: how every
piece works, the configuration it requires, and how the pieces connect.
Companion documents: [`backend-setup.md`](backend-setup.md) (platform
setup, step by step), [`ai-interview-coach-ionic.md`](ai-interview-coach-ionic.md)
(BRD/PRD/TRD), [`google-signin-setup.md`](google-signin-setup.md) (Phase C
OAuth), [`daraja-api-stk-push-documentation.md`](daraja-api-stk-push-documentation.md)
(Safaricom reference).

---

## 1. What the application is

HirePath is an AI interview coach for job seekers in Kenya:

1. The user pastes a **job description**.
2. An AI model (OpenRouter/OpenAI, invoked from a Supabase Edge Function)
   generates **3–5 tailored interview questions** with sample answers,
   stored as a practice session.
3. Free users get **3 sessions per month**. Upgrading to **Pro** via
   **M-Pesa STK Push** unlocks unlimited sessions plus **AI coaching
   feedback** on submitted answers (chat-style critique + follow-up).
4. Pro renews monthly; the **payment history** is shown on its own page
   and can be exported as a **PDF report**.

Stack: Ionic Vue 8 (Capacitor 8) SPA + Supabase (Postgres, Auth, Storage,
Realtime, Edge Functions) + Daraja (M-Pesa) + OpenRouter/OpenAI.

---

## 2. Architecture at a glance

```
┌─────────────────────────── CLIENT (Vue 3 + Ionic, src/) ───────────────────────────┐
│ Login / Practice / History / Paywall / M-Pesa modal / Profile / Payments           │
│ Pinia (auth, theme) · TanStack Vue Query (data) · Realtime channels (live UI)      │
└────────────┬──────────────────────────┬──────────────────────────┬─────────────────┘
             │ REST + JWT (RLS-enforced) │ supabase.functions.invoke │ storage
             ▼                          ▼                          ▼
┌────────────────────────── SUPABASE (project vdrdistisykdigqilnpc) ─────────────────┐
│ Postgres: profiles, interview_sessions, session_messages, subscriptions, payments │
│ Realtime publication (messages/payments/subscriptions) · Storage: payments-reports│
│ Edge Functions:                                                                    │
│   generate-questions · feedback      → OpenRouter / OpenAI (AI)                    │
│   stk-push · stk-query · mpesa-callback · mpesa-renewals → Daraja API (M-Pesa)     │
│   generate-report                    → storage archive + PDF bytes                 │
│ pg_cron nightly job (expired Pro → free)                                           │
└──────────────────────────────┬──────────────────────────────────────────────────────┘
                               │ HTTPS (Safaricom → mpesa-callback, public)
                               ▼
                  M-Pesa / Daraja sandbox (sandbox.safaricom.co.ke)
```

Every user-facing request is **JWT-authenticated** (`verify_jwt = true` in
`supabase/config.toml`); only the two machine-to-machine functions
(`mpesa-callback` — called by Safaricom, `mpesa-renewals` — called by the
scheduled job) are public, and each guards itself with the service role
key instead of a user JWT.

---

## 3. Required configuration (and where each value lives)

### 3.1 Client `.env` (Vite, `VITE_`-prefixed — copy `.env.example`)

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_PROJECT_URL` | `src/core/services/supabase.ts` (and report URL) | e.g. `https://vdrdistisykdigqilnpc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | supabase client | Either is accepted; never expose secrets here |
| `VITE_SITE_URL` | password-reset redirect | Defaults to `window.location.origin` |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Google sign-in (Phase C) | Web OAuth client from Google Cloud Console |

> **Never** put `SUPABASE_SERVICE_ROLE_KEY` (or any M-Pesa secret) in the
> client. The service role key runs **only** inside Edge Functions where
> the platform injects it automatically.

### 3.2 Supabase dashboard (one-time)

- **Auth → URL configuration**: Site URL + redirect URLs for
  `/reset-password` and the Google flow (`/login`).
- **Auth → Email**: SMTP provider for branded confirmation/reset mail
  (default `no-reply@supabase.co` also works).
- **Auth → Providers**: Google enabled with the Cloud Console web client
  ID + secret (see `docs/google-signin-setup.md`).
- **Database**: run the migrations (idempotent, re-runnable):
  - `supabase/migrations/20260811000001_init.sql` — schema + RLS +
    Realtime publication.
  - `supabase/migrations/20260812000001_payments_result.sql` — payment
    result columns.
  - `supabase/migrations/20260812000002_payment_reports.sql` — private
    `payments-reports` bucket + path-based storage RLS.
- **Cron**: `supabase/scripts/enable-renewals-cron.sql` — pg_cron nightly
  02:00 EAT job that downgrades expired Pro rows to free (the pg_cron
  role bypasses RLS, so no key is stored).

### 3.3 Edge Function secrets (`supabase secrets set`)

| Secret | Functions using it | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | generate-questions, feedback | AI provider (OpenAI-compatible) |
| `OPENROUTER_MODEL` (optional) | generate-questions, feedback | Defaults to free `nvidia/nemotron-3-super-120b-a12b:free` |
| `OPENAI_API_KEY` (fallback) | generate-questions, feedback | Alternative AI provider |
| `MPESA_CONSUMER_KEY` | stk-push, stk-query | Daraja OAuth client |
| `MPESA_CONSUMER_SECRET` | stk-push, stk-query | Daraja OAuth client |
| `MPESA_SHORTCODE` | stk-push, stk-query | PayBill (sandbox `174379`) |
| `MPESA_PASSKEY` | stk-push, stk-query | Daraja STK password |
| `MPESA_PRICE` | stk-push | KES 1 testing; restore real price before shipping |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all | Injected automatically by the platform (never set manually) |

### 3.4 Deployment commands (Supabase CLI)

```bash
supabase link --project-ref vdrdistisykdigqilnpc
supabase db push                          # idempotent migrations
supabase functions deploy generate-questions
supabase functions deploy feedback
supabase functions deploy stk-push
supabase functions deploy stk-query
supabase functions deploy generate-report
supabase functions deploy mpesa-callback --no-verify-jwt
supabase functions deploy mpesa-renewals --no-verify-jwt
```

`supabase/config.toml` pins `verify_jwt` per function and the cron
schedule (`0 2 * * *`). See `scripts/backend-setup.sh` for the one-shot
automation.

---

## 4. Data model (Postgres, all RLS-enforced)

| Table | Purpose | RLS model |
|---|---|---|
| `profiles` | Display name/avatar, auto-created from `auth.users` by the `handle_new_user()` trigger | user owns own row |
| `interview_sessions` | One per generated question set; `questions` is JSONB | select/insert/update/delete with `auth.uid() = user_id` |
| `session_messages` | Feedback chat (`user`/`coach` rows keyed by `question_id`) | select/insert iff the parent session belongs to the user |
| `subscriptions` | `tier` (`free`/`pro`) + `status`/`current_period_end`; row auto-created at signup | select/insert/update own |
| `payments` | Every STK push: `checkout_request_id` (unique), result codes/desc, `status` ∈ pending/paid/failed/expired | select/insert own (updates happen server-side) |

`payments.result_code` / `result_desc` are added by
`20260812000001_payments_result.sql`. Storage: private `payments-reports`
bucket, path `payments-reports/<user id>/<file>`; path-based policies let
a user touch only their own folder (no longer used by the report flow —
see §8 — but kept for folder-based access).

---

## 5. Authentication (start of the journey)

- **Email/password**: `useAuthStore` (`Pinia`) wraps
  `supabase.auth.signInWithPassword/signUpWithEmail`. Email confirmation
  is enabled. Profile + subscription rows are auto-seeded by the database
  trigger when the auth row appears.
- **Google**: `GoogleSignInButton` → `useGoogleAuth` (Capacitor plugin on
  Android, OAuth redirect on web) → ID token exchanged via
  `auth.signInWithIdToken` (`signInWithGoogleIdToken`).
- **Persistence**: `onAuthStateChange` keeps the store in sync; the router
  guard (`src/router/index.ts`) calls `ensureSession()` on every
  navigation and redirects unauthenticated users to `/login`.
- **Recovery**: `/forgot-password` → `resetPasswordForEmail` with
  `redirectTo = <VITE_SITE_URL>/reset-password` → `/reset-password` page
  completes `updateUser({ password })`.

Every later request rides on the same JWT: the supabase-js client attaches
`Authorization: Bearer <access_token>` to REST, `functions.invoke` (which
the Edge Function gateway validates), and Realtime subscriptions.

---

## 6. Free tier + Pro entitlements

- **Quota source of truth is server-side**: `generate-questions` counts
  `interview_sessions` rows created this month
  (`gte(created_at, '<YYYY-MM>-01T00:00:00Z')`) and allows 3 for tier
  `free`, else returns `402 free_limit_reached` — the client maps this to
  a paywall prompt.
- The client mirrors the quota for display via `getPlan()`:
  `countSessionsThisMonth` + the `subscriptions` row.
- `activatePro()` (`_shared/subscription.ts`) upserts
  `tier=pro, status=active, current_period_end=now()+30d` — idempotent,
  called from the callback and the status-query fallback.
- **Auto-downgrade**: the nightly pg_cron job (or `mpesa-renewals` if
  invoked manually) flips `pro → free / active → expired` when
  `current_period_end < now()`. The paywall re-prompts on next use.

---

## 7. Practice flow (AI question generation + feedback)

1. **Practice** (`PracticeView` → `useInterviewQuery.generateQuestions`):
   posts the pasted job description to
   `POST /functions/v1/generate-questions` (JWT).
2. The function validates the caller, enforces the free quota (§6), then
   calls the AI with a strict system prompt (grounded only in the pasted
   text) requesting JSON; Zod-validates the response; inserts the session
   with `questions` as JSONB and returns it.
3. Each question card shows the question + sample answer
   (`QuestionCard.vue`).
4. Submitting an answer calls `POST /functions/v1/feedback`
   (sessionId, questionId, question, answer). The function inserts the
   user message, caps the thread at 12 messages
   (`conversation_limit`), asks the AI for a 1–10 rating, critique and a
   follow-up question (all grounded in the question + answer), then
   inserts the two `coach` messages. `FeedbackChat.vue` renders the
   thread; all inserts stream to other devices via Realtime.
5. `HistoryView` lists sessions (`getSessions`); `SessionDetailView`
   loads one + its threads (`getSession`); deleting removes the row
   (messages cascade by FK).

---

## 8. M-Pesa payment flow (the money path)

End to end via `/payments` and the paywall's `MpesaModal`:

1. **stk-push** — `POST /functions/v1/stk-push` with `{phone}` (JWT).
   `_shared/daraja.ts` provides: a cached OAuth `accessToken()` (Basic
   auth on consumer key/secret, refreshed before expiry), an
   **EAT timestamp** (`YYYYMMDDHHmmss`, UTC+3, no DST) and the base64
   `stkPassword(shortcode, passkey, ts)`. The function sends the
   `CustomerPayBillOnline` request to `sandbox.safaricom.co.ke`, then
   inserts a `payments` row (`status: pending`, Daraja
   `CheckoutRequestID` stored) and returns it.
2. The modal enters `pending` and subscribes to **Realtime** on that
   payment row (`filter: id=eq.<paymentId>`); a 90-second watchdog is
   armed.
3. **mpesa-callback** — Safaricom POSTs the result to
   `https://<ref>.supabase.co/functions/v1/mpesa-callback`
   (`verify_jwt = false`, public URL per the Daraja spec). It looks up the
   payment by `CheckoutRequestID` **with the service role key** (no RLS),
   ignores replays (`already_processed`), persists `status/result_code/
   result_desc`, and calls `activatePro` on success. Always acknowledges
   promptly with `responseCode: "0"`.
4. **stk-query fallback** — if no callback landed within ~90s the client
   calls `POST /functions/v1/stk-query` with the `CheckoutRequestID`;
   Daraja's `ResultCode` becomes authoritative (`0` → paid, anything else
   → failed). A row with no authoritative result yet stays `pending` so a
   late callback can still settle it — payments never dead-end.
5. **UI settle** — the Realtime event (or the query response) flips the
   modal to success/failed; `usePayments` invalidates its Vue Query cache,
   `PaymentsView` shows the updated list and the summary (total paid,
   status counts). `subscriptions` changes also arrive via Realtime, so
   Profile/Practice unlock instantly.
6. **PDF report** — `PaymentsView → generatePaymentReportPdf()` POSTs to
   `/functions/v1/generate-report` with the user's JWT. The function
   verifies the caller, then reads that user's payments **with the
   service role key, strictly scoped to `user_id`** (RLS is bypassed so
   this scope is the guard), builds an A4 PDF (pdf-lib: header, summary,
   per-transaction table with status colors, page numbers), archives it
   at `payments-reports/<user id>/<timestamp>-payment-report.pdf` using
   the service role, and **returns the PDF bytes directly**
   (`application/pdf` + `Content-Disposition`). The client saves the blob
   with an anchor click — it never touches storage, so RLS policies are
   irrelevant to the flow.

---

## 9. Realtime (live UI)

`session_messages`, `payments` and `subscriptions` are added to the
`supabase_realtime` publication by the init migration. `src/core/services/
realtime.ts` exposes `subscribeOnce` — an idempotent registry that reuses
one channel per concern (important because supabase-js returns the same
channel for a repeated topic, and re-`.on()` after `subscribe()` throws).
Consumers:

- `FeedbackChat`-adjacent views: live chat rows per session.
- `MpesaModal`: live payment-settled signal (plus the watchdog).
- `usePayments`: invalidates the payments query on any change.

---

## 10. Security model (summary)

| Layer | Mechanism |
|---|---|
| Postgres | RLS on every table; policies are `auth.uid() = owner` or parent-ownership subqueries |
| Storage | Private bucket; path-based RLS scoped to the user's folder |
| Edge Functions | `verify_jwt=true` gate (except the two public M2M functions); callers re-verified with `auth.getUser()` |
| Service role key | Exists only in Edge Functions (auto-injected env) and the Cypress test config; never in the client bundle |
| M2M trust | `mpesa-callback` accepts only Safaricom's URL + replies idempotently; `mpesa-renewals` requires the service role key as bearer |
| Secrets | `OPENROUTER_*`, `MPESA_*` live in dashboard secrets; client `.env` holds only `VITE_`-prefixed public values |

---

## 11. Testing & quality

```bash
npm run lint        # ESLint (vue + typescript configs)
npm run build       # vue-tsc typecheck + vite build
npm run test:unit   # vitest (jsdom)
npm run test:e2e    # Cypress — seeds a confirmed QA user via the service
                    # role key (see cypress.config.ts), tests tab flows
```

CI-visible verification used during development: lint + `vue-tsc --noEmit`
+ production build, plus a live E2E probe of `generate-report` (seed user
→ POST with JWT → assert `%PDF-` bytes + archive object → cleanup).

---

## 12. Project layout quick map

```
src/
  core/            supabase client, data-access seams (interviewApi,
                   paymentsApi, realtime), types, theme store
  features/
    authentication/  login, forgot/reset password, Google button, auth store
    interview/       practice, history, session detail, feedback chat
    subscription/    paywall modal + composable
    payments/        payments view, M-Pesa modal, pdfReport service
    settings/        profile view
  views/           tabs shell, router glue
supabase/
  migrations/      idempotent SQL (schema, result columns, report bucket)
  scripts/         pg_cron renewal job
  functions/
    generate-questions, feedback        (AI)
    stk-push, stk-query, mpesa-callback, mpesa-renewals  (Daraja)
    generate-report                     (PDF)
    _shared/        cors, supabase client factories, daraja, subscription,
                    admin (service role) helpers
docs/              backend setup, BRD/PRD/TRD, Google sign-in, Daraja doc
```