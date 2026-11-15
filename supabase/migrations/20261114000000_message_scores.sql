-- ============================================================
-- 20261114000000_message_scores.sql
-- Persist AI coaching scores on session_messages so the Readiness
-- dashboard can aggregate real ratings across sessions.
--   rating: the overall 1-10 score the feedback function already
--           returns per answer (previously discarded).
--   scores: optional competency breakdown, e.g.
--           {"clarity":8,"structure":7,"depth":9,"communication":8}
-- Nullable: legacy messages keep NULL and the UI degrades gracefully.
-- RLS: no policy changes needed — existing policies cover the columns.
-- ============================================================

alter table public.session_messages
  add column if not exists rating smallint
    check (rating is null or (rating >= 1 and rating <= 10)),
  add column if not exists scores jsonb;
