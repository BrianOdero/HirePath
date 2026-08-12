-- ============================================================
-- enable-renewals-cron.sql
-- Run in Supabase Dashboard > SQL Editor, or:
--   supabase db query --linked -f supabase/scripts/enable-renewals-cron.sql
--
-- Prereq: pg_cron extension enabled (Database > Extensions > pg_cron,
-- or granted via `create extension` below). No secrets needed: the cron
-- job runs as the postgres role, so it can update subscriptions directly
-- (BYPASSRLS) without an API call or stored service-role key.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;

-- Every night at 02:00, downgrade expired pro subscriptions to free.
-- The client paywall then re-prompts for payment on next open
-- (push notifications are out of scope per the BRD).
select cron.unschedule('hirepath-renewals') where exists (
  select 1 from cron.job where jobname = 'hirepath-renewals'
);

select cron.schedule(
  'hirepath-renewals',
  '0 2 * * *',
  $$
  update public.subscriptions
  set tier = 'free',
      status = 'expired',
      updated_at = now()
  where tier = 'pro'
    and current_period_end is not null
    and current_period_end < now();
  $$
);

-- Sanity check (should return 1 row):
select jobid, jobname, schedule from cron.job where jobname = 'hirepath-renewals';