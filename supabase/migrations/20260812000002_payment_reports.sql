-- ============================================================
-- 20260812000002_payment_reports.sql — PDF report archive bucket
-- Idempotent: safe to re-run (SQL Editor) or apply via `supabase db push`.
-- Private `payments-reports` bucket + path-based RLS: every user may
-- insert/select files only under payments-reports/<their user id>/,
-- which the generate-report edge function (user JWT) and the client's
-- storage.download() both rely on. No service role on devices.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('payments-reports', 'payments-reports', false)
on conflict (id) do nothing;

drop policy if exists "reports_select_own" on storage.objects;
create policy "reports_select_own" on storage.objects
  for select using (
    bucket_id = 'payments-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reports_insert_own" on storage.objects;
create policy "reports_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'payments-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );