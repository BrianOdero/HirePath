#!/usr/bin/env bash
# ============================================================
# HirePath — Supabase backend deploy script (CLI route).
# Run from the repo root:  ./scripts/backend-setup.sh
#
# Prereqs: supabase CLI installed + logged in
#   npm install -g supabase && supabase login
# ============================================================
set -euo pipefail

PROJECT_REF="vdrdistisykdigqilnpc"

# ---- secrets (fill in; OpenAI is required, MPESA only for Phase D)
if [ -n "${OPENAI_API_KEY:-}" ] || [ -f .env ]; then
  : # .env is a fallback source below
fi

set_secret() {
  local name="$1"
  local value="$2"
  [ -z "$value" ] && return 0
  echo "supabase secrets set ${name}=***"
  supabase secrets set "${name}=${value}" --project-ref "$PROJECT_REF"
}

# Prefer env vars, then .env, then ask interactively
read_env() {
  grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true
}

set_secret OPENAI_API_KEY "${OPENAI_API_KEY:-$(read_env OPENAI_API_KEY)}"
set_secret MPESA_CONSUMER_KEY "${MPESA_CONSUMER_KEY:-$(read_env MPESA_CONSUMER_KEY)}"
set_secret MPESA_CONSUMER_SECRET "${MPESA_CONSUMER_SECRET:-$(read_env MPESA_CONSUMER_SECRET)}"
set_secret MPESA_SHORTCODE "${MPESA_SHORTCODE:-$(read_env MPESA_SHORTCODE)}"
set_secret MPESA_PASSKEY "${MPESA_PASSKEY:-$(read_env MPESA_PASSKEY)}"
set_secret MPESA_PRICE "${MPESA_PRICE:-250}"

echo "==> Linking project $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF" --yes

echo "==> Pushing migrations (no-op if already applied via SQL Editor)"
supabase db push --linked

echo "==> Deploying edge functions"
supabase functions deploy generate-questions --project-ref "$PROJECT_REF"
supabase functions deploy feedback --project-ref "$PROJECT_REF"
supabase functions deploy stk-push --project-ref "$PROJECT_REF"
supabase functions deploy mpesa-callback --project-ref "$PROJECT_REF" --no-verify-jwt
supabase functions deploy mpesa-renewals --project-ref "$PROJECT_REF" --no-verify-jwt

echo "==> Done. Verify in the Edge Functions dashboard."
