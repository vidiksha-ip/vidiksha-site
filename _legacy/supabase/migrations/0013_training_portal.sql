-- Live training in the learning portal. Registering on the website creates the registrant's VIDIKSHA account (no course
-- access). After the session they watch the recording, must leave feedback with their LinkedIn profile and consent to
-- publication, and can then download a participation certificate. Run after 0012.

alter table public.training_sessions
  add column if not exists recording_path text;          -- lms-videos bucket: training/<slug>/<file>

alter table public.training_registrations
  add column if not exists attended              boolean not null default true,
  add column if not exists certificate_no        text unique,
  add column if not exists certificate_issued_at timestamptz;

create table if not exists public.training_feedback (
  id              uuid primary key default gen_random_uuid(),
  session_slug    text not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  rating          integer not null check (rating between 1 and 5),
  feedback        text not null,
  linkedin_url    text not null,
  consent_publish boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (session_slug, user_id)
);
alter table public.training_feedback enable row level security;
create policy "registrants manage their own feedback" on public.training_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "staff manage feedback" on public.training_feedback for all using (public.is_staff()) with check (public.is_staff());

-- A registrant may read the sessions they registered for, shown on the website or not.
create policy "registrants read their sessions" on public.training_sessions for select
  using (exists (select 1 from public.training_registrations r where r.session_slug = slug
                 and (r.user_id = auth.uid() or lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', '')))));
-- and their own registration rows even when made before the account existed
drop policy if exists "members see their own registrations" on public.training_registrations;
create policy "members see their own registrations" on public.training_registrations for select
  using (auth.uid() = user_id or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Recordings uploaded to lms-videos/training/<slug>/... stream to that session's registrants.
create policy "registrants stream training recordings" on storage.objects for select to authenticated
  using (bucket_id = 'lms-videos' and (storage.foldername(name))[1] = 'training'
         and exists (select 1 from public.training_registrations r where r.session_slug = (storage.foldername(name))[2]
                     and (r.user_id = auth.uid() or lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', '')))));

-- Consecutive certificate numbers per financial year: VID/CERT/26-27/0001.
create table if not exists public.certificate_counters (fy text primary key, last integer not null default 0);
alter table public.certificate_counters enable row level security;
create or replace function public.assign_certificate_number(reg_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare existing text; fy_label text; n integer; now_ist timestamptz := now() at time zone 'Asia/Kolkata'; y integer := extract(year from now_ist);
begin
  select certificate_no into existing from training_registrations where id = reg_id;
  if existing is not null then return existing; end if;
  if extract(month from now_ist) < 4 then y := y - 1; end if;
  fy_label := to_char(y % 100, 'FM00') || '-' || to_char((y + 1) % 100, 'FM00');
  insert into certificate_counters (fy, last) values (fy_label, 1) on conflict (fy) do update set last = certificate_counters.last + 1 returning last into n;
  existing := 'VID/CERT/' || fy_label || '/' || to_char(n, 'FM0000');
  update training_registrations set certificate_no = existing, certificate_issued_at = now() where id = reg_id;
  return existing;
end; $$;
revoke all on function public.assign_certificate_number(bigint) from public, anon, authenticated;

-- What a signed-in registrant sees: their sessions with recording, feedback and certificate state.
create or replace view public.my_training with (security_invoker = true) as
select r.id as registration_id, r.session_slug, coalesce(s.title, r.session_title) as title, s.summary, s.starts_at, s.duration_min, s.platform,
       s.replay_url, s.recording_path, s.whatsapp_group_url, r.attended, r.certificate_no, r.created_at as registered_at,
       (s.starts_at + make_interval(mins => coalesce(s.duration_min, 180))) < now() as finished,
       (f.id is not null) as feedback_given
from public.training_registrations r
left join public.training_sessions s on s.slug = r.session_slug
left join public.training_feedback f on f.session_slug = r.session_slug and f.user_id = auth.uid()
where r.user_id = auth.uid() or lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''));

-- Staff view of feedback with the registrant's details, for the control panel and for publishing testimonials.
create or replace view public.training_feedback_overview with (security_invoker = true) as
select f.*, p.full_name, p.email, p.profession, p.organisation, s.title as session_title, s.starts_at
from public.training_feedback f join public.profiles p on p.id = f.user_id left join public.training_sessions s on s.slug = f.session_slug;
