-- Live training registrations. Run after 0001_members.sql in the Supabase SQL editor.
-- Registering for a session creates a VIDIKSHA account (Supabase Auth) and stores the form answers here.

alter table public.profiles
  add column if not exists whatsapp      text,
  add column if not exists profession    text,
  add column if not exists qualification text;

create table if not exists public.training_registrations (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,
  session_slug  text not null,
  session_title text not null,
  session_date  date,
  full_name     text not null,
  email         text not null,
  whatsapp      text,
  profession    text,
  qualification text,
  created_at    timestamptz not null default now(),
  unique (user_id, session_slug)
);

create index if not exists training_registrations_session on public.training_registrations (session_slug, created_at desc);

alter table public.training_registrations enable row level security;

create policy "members register themselves"
  on public.training_registrations for insert with check (auth.uid() = user_id);

create policy "members see their own registrations"
  on public.training_registrations for select using (auth.uid() = user_id);

-- The sign-up form passes everything as user metadata. The trigger fills the profile and, when the sign-up came from a
-- registration form, records the registration too, so it works even before the email is confirmed (no session yet).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, organisation, role, whatsapp, profession, qualification)
  values (
    new.id, new.email,
    nullif(m ->> 'full_name', ''), nullif(m ->> 'organisation', ''),
    coalesce(nullif(m ->> 'role', ''), nullif(m ->> 'profession', '')),
    nullif(m ->> 'whatsapp', ''), nullif(m ->> 'profession', ''), nullif(m ->> 'qualification', '')
  )
  on conflict (id) do nothing;

  if coalesce(m ->> 'register_session', '') <> '' then
    insert into public.training_registrations (user_id, session_slug, session_title, session_date, full_name, email, whatsapp, profession, qualification)
    values (
      new.id, m ->> 'register_session', coalesce(m ->> 'register_session_title', m ->> 'register_session'),
      nullif(m ->> 'register_session_date', '')::date,
      coalesce(nullif(m ->> 'full_name', ''), new.email), new.email,
      nullif(m ->> 'whatsapp', ''), nullif(m ->> 'profession', ''), nullif(m ->> 'qualification', '')
    )
    on conflict (user_id, session_slug) do nothing;
  end if;
  return new;
end;
$$;

-- Dashboard view: one row per registration with the member's current profile.
create or replace view public.registration_overview
with (security_invoker = true) as
select r.id, r.created_at, r.session_slug, r.session_title, r.session_date,
       r.full_name, r.email, r.whatsapp, r.profession, r.qualification,
       (u.email_confirmed_at is not null) as email_confirmed
from public.training_registrations r
left join auth.users u on u.id = r.user_id;
