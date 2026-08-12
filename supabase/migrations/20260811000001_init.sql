-- ============================================================
-- 20260811000001_init.sql — HirePath core schema
-- Idempotent: safe to re-run (SQL Editor) or apply via `supabase db push`.
-- Tables: profiles, interview_sessions, session_messages,
--         subscriptions, payments
-- RLS enabled everywhere; users only touch their own rows.
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create / sync profile from auth.users (name stored in user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url;

  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- interview_sessions (questions stored as JSONB)
-- ------------------------------------------------------------
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  company text not null default '',
  job_description text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.interview_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.interview_sessions;
create policy "sessions_select_own" on public.interview_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.interview_sessions;
create policy "sessions_insert_own" on public.interview_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.interview_sessions;
create policy "sessions_update_own" on public.interview_sessions
  for update using (auth.uid() = user_id);
drop policy if exists "sessions_delete_own" on public.interview_sessions;
create policy "sessions_delete_own" on public.interview_sessions
  for delete using (auth.uid() = user_id);

create index if not exists sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

-- ------------------------------------------------------------
-- session_messages (feedback chat; question_id points into the
-- JSONB array stored on interview_sessions.questions)
-- ------------------------------------------------------------
create table if not exists public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question_id uuid not null,
  role text not null check (role in ('user', 'coach')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.session_messages enable row level security;

drop policy if exists "messages_select_own" on public.session_messages;
create policy "messages_select_own" on public.session_messages
  for select using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
drop policy if exists "messages_insert_own" on public.session_messages;
create policy "messages_insert_own" on public.session_messages
  for insert with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create index if not exists messages_question_idx
  on public.session_messages (session_id, question_id, created_at);

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  status text not null default 'none' check (status in ('none', 'paying', 'active', 'expired')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "subs_update_own" on public.subscriptions;
create policy "subs_update_own" on public.subscriptions
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- payments (M-Pesa / Daraja STK Push)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_request_id text unique,
  merchant_request_id text,
  amount integer not null,
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);
drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments
  for insert with check (auth.uid() = user_id);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

-- ------------------------------------------------------------
-- Realtime: push chat + payment/subscription changes to clients
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('session_messages', 'payments', 'subscriptions')
  ) then
    alter publication supabase_realtime add table
      public.session_messages, public.payments, public.subscriptions;
  end if;
end $$;