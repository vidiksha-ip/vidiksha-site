-- VIDIKSHA member database. Run once in the Supabase SQL editor of the project that backs the Research tab.
-- Supabase Auth owns the accounts (auth.users: email, hashed password, confirmation, resets). This adds a profile
-- row per member, filled from the sign-up form, and a log of research logins. Everything is protected by row level
-- security so a member can only ever read or change their own rows; the dashboard (service role) sees everything.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  organisation  text,
  role          text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.profiles enable row level security;

create policy "members read their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "members update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Copy the sign-up form fields into profiles the moment Auth creates the account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, organisation, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'organisation', ''),
    nullif(new.raw_user_meta_data ->> 'role', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step if a member changes their email in Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- One row per login to the Research tab.
create table if not exists public.research_logins (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  at         timestamptz not null default now(),
  user_agent text
);

create index if not exists research_logins_user_at on public.research_logins (user_id, at desc);

alter table public.research_logins enable row level security;

create policy "members log their own logins"
  on public.research_logins for insert with check (auth.uid() = user_id);

create policy "members read their own logins"
  on public.research_logins for select using (auth.uid() = user_id);

-- A convenient view for the dashboard: who signed up, when, and when they last used the repository.
create or replace view public.member_overview
with (security_invoker = true) as
select p.id, p.email, p.full_name, p.organisation, p.role, p.created_at, p.last_login_at,
       (select count(*) from public.research_logins l where l.user_id = p.id) as login_count
from public.profiles p;
