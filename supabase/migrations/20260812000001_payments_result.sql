-- ============================================================
-- 20260812000001_payments_result.sql — payment outcome detail
-- Idempotent: safe to re-run (SQL Editor) or apply via `supabase db push`.
-- Adds the Daraja ResultCode/ResultDesc so the UI can explain why a
-- payment failed (cancelled / timeout / insufficient funds) and the
-- PDF report can include it.
-- ============================================================

alter table public.payments
  add column if not exists result_code text,
  add column if not exists result_desc text;