# AI Interview Coach — BRD, PRD & TRD (Ionic Vue)

**Purpose of this document:** Complete, self-contained context for implementing AI Interview Coach — an Ionic Vue (`@ionic/vue`) cross-platform mobile application that generates tailored interview questions and AI feedback from a pasted job description, using Supabase, native Google Sign-In via Capacitor, and Safaricom's Daraja API (M-Pesa). Written to be handed directly to an AI coding agent with no other context required. **This version has been aligned with the current state of the local `hire-path/` repository** (Capacitor 8.x, npm, existing Ionic starter scaffold) — see TRD §3 "Current Repository State".

**Build type:** **Capacitor Native Build Required.** Running native Google Sign-In via native account pickers requires native Android (Android Studio) build environments generated via the Capacitor CLI. Browser execution can be used for UI testing, but native credentials require the native wrapper. 

---

# PART 1 — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Business Objective

Ship a portfolio-quality AI product that demonstrates an end-to-end freemium subscription flow using a Kenya-relevant payment rail (M-Pesa) alongside a native sign-in experience using Vue 3 and Ionic Framework.

## 2. Problem Statement

Job seekers preparing for interviews typically rely on generic question banks that aren't tailored to the specific role they are applying for. Pasting a job description to obtain relevant practice questions — and receiving feedback on custom responses — provides a tailored practice flow for candidates.

## 3. Target Market

Job seekers in Kenya (extensible to other M-Pesa markets) applying to roles with published job descriptions, who prefer paying via M-Pesa and signing in with an existing Google account.

## 4. Monetization Strategy

Freemium subscription: 3 free practice sessions per month; a paid Pro tier unlocks unlimited sessions plus AI coaching feedback on user-submitted answers. Billed via M-Pesa STK Push and renewed monthly through a scheduled re-prompt.

## 5. Success Metrics

- Free → Pro conversion rate
- Retained monthly subscriptions
- Session completion rate
- Google Sign-In vs. email/password conversion rate

## 6. Assumptions & Constraints

- Kenya-first: single currency (KES), M-Pesa as the primary payment rail.
- Hybrid Mobile Stack: `@ionic/vue` 8, Capacitor 8.x, Vite, Vue 3 Composition API (`<script setup>`).
- Text-only interaction in v1 (no audio/video interview simulation).
- English-language job descriptions and question generation for v1.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI feedback mistaken for authoritative career advice | Persistent disclaimer in the UI |
| AI hallucination of unlisted company details | Ground prompts strictly within the pasted job description text |
| M-Pesa STK Push failure, timeout, or cancellation | Explicit UI states for pending, failed, and expired transactions |
| Native Google Sign-In setup issues (SHA-1 fingerprint mismatch) | Verify SHA-1 fingerprints in Google Cloud Console against the local Android debug keystore |
| Free-tier limit bypass via re-registration | Acceptable risk for initial prototype scope |

---

# PART 2 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Vision

Paste a job description to instantly receive tailored interview questions and sample answers. Sign in using Google in one tap. Upgrade to Pro to submit answers and receive AI coaching feedback.

## 2. Target User

A job seeker with a specific job description who wants focused interview practice without creating manual credentials.

## 3. Core Features

| Feature | Tier | Description |
|---|---|---|
| Sign In | All | Email/password or native Google Sign-In via Capacitor |
| Generate Session | Free (3/month) & Pro (unlimited) | Paste job description → AI generates tailored questions and sample answers |
| Session History | All | Browse and review all previously generated sessions |
| Answer Feedback | Pro only | Submit custom responses to receive targeted AI coaching feedback |
| Subscription | — | M-Pesa STK Push with scheduled renewal prompts |

## 4. User Stories

1. **As a new user**, I can sign up with email/password or tap "Sign in with Google" to select my account via the native account picker.
2. **As a free user**, I can paste a job description and generate tailored interview questions up to 3 times per month.
3. **As a free user at the limit**, I am prompted with a paywall to upgrade to Pro.
4. **As a subscriber**, I enter my M-Pesa PIN when prompted, and my Pro access unlocks automatically upon payment confirmation.
5. **As a Pro user**, I can submit my own interview responses to receive AI feedback and follow-up coaching questions.
6. **As a Pro subscriber near renewal**, I receive an M-Pesa renewal prompt; declining reverts my tier to Free at period end.
7. **As any user**, I can review cached and past sessions at any time.

## 5. Explicitly Out of Scope (v1)

- Voice or video interview simulation
- Store in-app purchases (Daraja M-Pesa only)
- Multi-language support
- Push notifications

---

# PART 3 — TECHNICAL REQUIREMENTS DOCUMENT (TRD)

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`), Ionic Vue (`@ionic/vue`), Vue Router |
| Build Tool | Vite |
| Runtime/Execution | npm for package management (existing `package-lock.json`); Node 20+ |
| Native Runtime | Capacitor CLI — `@capacitor/core` 8.5.0 already installed; `@capacitor/android` must be added via `npm install @capacitor/android` then `npx cap add android` |
| Auth | Supabase Auth (`@supabase/supabase-js`) — email/password + native Google ID token exchange |
| Database | Supabase Postgres with Row Level Security (RLS) |
| Real-time Sync | Supabase Realtime (`postgres_changes`) for payment/subscription updates |
| Payments | Safaricom Daraja API — Lipa Na M-Pesa Online (STK Push) |
| Backend API | Supabase Edge Functions (Deno / TypeScript) |
| AI Integration | Vercel AI SDK / OpenAI API hosted in Edge Functions |
| Client State | Pinia |
| Data Fetching | `@tanstack/vue-query` |

## 3. Dependencies

| Package | Purpose | Native Plugin? |
|---|---|---|
| `@capacitor/android` | Android native runtime platform (must be installed and added via `npx cap add android`) | Yes (native platform) |
| `@ionic/vue`, `@ionic/vue-router` | Ionic UI components and routing for Vue 3 | Web / Native |
| `@supabase/supabase-js` | Supabase client for auth, database queries, and Realtime | No |
| `@capawesome/capacitor-google-sign-in` | Native Google Sign-In plugin returning signed ID tokens (replaces the archived, Capacitor-8-incompatible `@capacitor-community/google-auth`) | **Yes** |
| `@capacitor/preferences` | Key-value storage for persistent auth tokens | Yes (Capacitor core) |
| `@capacitor-community/sqlite` | Local SQLite caching for offline session history | Yes |
| `pinia` | State management for user sessions and active interview state | No |
| `@tanstack/vue-query` | Async state management and data fetching | No |
| `zod` | Structured schema validation for AI outputs | No |

## 3. Current Repository State

The frontend is feature-complete against a mock-data service seam; the Supabase backend code is written and ready to deploy. Key facts:

- **Stack**: Ionic 8 + Vue 3 + Vite 5 + TypeScript, Capacitor 8.5.0 (`capacitor.config.ts`, appId `io.ionic.starter`, appName `HirePath`, **no native Android project generated yet**), npm scripts: `dev`, `build`, `preview`, `test:e2e`, `test:unit`, `lint`
- **Deps installed**: `@supabase/supabase-js` 2.112.3, `pinia` 4.0.2, `@tanstack/vue-query` 5.101.4, `zod` 4.4.3, `@capacitor/preferences` 8.0.1, `@capacitor-community/sqlite` 8.1.1, `@capawesome/capacitor-google-sign-in` 0.1.2, `@capacitor/android` 8.5.0 (platform not added yet)
- **Hosted Supabase project**: `vdrdistisykdigqilnpc` — keys in `.env` (gitignored, `.env.example` committed); email confirmation enabled; Site URL/Redirect URLs include `http://localhost:5173`
- **Backend code ready**: `supabase/migrations/20260811000001_init.sql` (idempotent; profiles + trigger, interview_sessions, session_messages, subscriptions, payments, RLS, Realtime), `supabase/functions/{generate-questions,feedback,stk-push,mpesa-callback,mpesa-renewals}`, `supabase/scripts/enable-renewals-cron.sql` (pg_cron nightly renewals — direct SQL update, no keys stored), `docs/backend-setup.md` (runbook; status on the live project: migration + cron + 5 functions **deployed**), `scripts/backend-setup.sh` (CLI deploy helper)
- **App code**: Pinia + Vue Query wired; auth (email + Google) via `useAuthStore`/`useGoogleAuth`; screens Practice/History/Profile/Session detail/Paywall + M-Pesa modal; data access behind `src/core/services/interviewApi.ts` seam — currently wired to `supabaseInterviewApi` (Edge Functions), swap to `mockInterviewApi` for offline demos
- Testing harnesses: Cypress (`tests/e2e`, checks `/login`) and Vitest (`tests/unit`, tests `parseJobDescription`)
- **Backend DEPLOYED (live)**: migration + pg_cron renewals apply; all 5 edge functions ACTIVE on `vdrdistisykdigqilnpc`; secrets set: `OPENROUTER_API_KEY` (AI provider — defaults to a free-tier OpenRouter model, override with `OPENROUTER_MODEL`); `MPESA_*` secrets pending (Phase D). Verified end-to-end: real `generate-questions` + `feedback` calls returned grounded questions/critique.
- **Phase C pending (user steps, documented in `docs/google-signin-setup.md`)**: create Google Cloud OAuth *Web application* client (redirect `http://localhost:5173/login`), enable Google provider in Supabase dashboard, set `VITE_GOOGLE_WEB_CLIENT_ID` in `.env`.

## 4. Directory Structure (Feature-First Approach)

```text
hire-path/
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── router/
│   │   └── index.ts                   # replace placeholder tabs with feature routes
│   ├── features/
│   │   ├── authentication/
│   │   │   ├── components/            # GoogleSignInButton.vue, AuthForm.vue
│   │   │   ├── composables/           # useAuth.ts, useGoogleAuth.ts
│   │   │   ├── stores/                # useAuthStore.ts (Pinia)
│   │   │   └── views/                 # LoginView.vue
│   │   ├── interview/
│   │   │   ├── components/            # QuestionCard.vue, FeedbackChat.vue
│   │   │   ├── composables/           # useInterviewSession.ts
│   │   │   ├── stores/                # useInterviewStore.ts
│   │   │   └── views/                 # SessionView.vue, HistoryView.vue
│   │   ├── subscription/
│   │   │   ├── components/            # ProBanner.vue
│   │   │   ├── composables/           # useSubscription.ts
│   │   │   └── views/                 # PaywallView.vue
│   │   └── payments/
│   │       ├── components/            # MpesaModal.vue
│   │       └── composables/           # useMpesa.ts
│   ├── core/
│   │   ├── services/
│   │   │   ├── supabase.ts
│   │   │   └── sqlite.ts              # Local SQLite cache integration
│   │   ├── utils/
│   │   │   └── formatters.ts
│   │   └── types/
│   │       └── index.ts
│   └── shared/
│       └── components/                # Global UI components
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260811000001_init.sql
│   ├── scripts/
│   │   └── enable-renewals-cron.sql   # pg_cron + pg_net + vault (SQL Editor)
│   └── functions/
│       ├── _shared/                   # cors.ts, supabase.ts (authed client)
│       ├── generate-questions/index.ts
│       ├── feedback/index.ts
│       ├── stk-push/index.ts
│       ├── mpesa-callback/index.ts
│       └── mpesa-renewals/index.ts
├── scripts/
│   └── backend-setup.sh               # CLI deploy helper (link, secrets, deploy)
├── docs/
│   └── backend-setup.md               # platform runbook: paste SQL, deploy, verify
├── capacitor.config.ts
├── vite.config.ts
├── package-lock.json                 # npm lockfile (not bun.lockb)
└── .env