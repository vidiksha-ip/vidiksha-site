-- Live training sessions are managed in the control panel (add, edit, hide, remove) and published to the website
-- like courses. Registrations stay in training_registrations, keyed by session slug. Run after 0010.

create table if not exists public.training_sessions (
  slug                  text primary key,
  title                 text not null,
  summary               text,
  format                text,
  certificate           text,
  area                  text,
  starts_at             timestamptz not null,
  duration_min          integer not null default 180,
  price_inr             integer not null default 0,
  platform              text not null default 'Microsoft Teams',
  replay_url            text,
  external_register_url text,
  published_on_site     boolean not null default false,
  site_published_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.training_sessions enable row level security;
create policy "staff manage training sessions" on public.training_sessions for all using (public.is_staff()) with check (public.is_staff());
create policy "anyone reads published sessions" on public.training_sessions for select using (published_on_site);

create or replace view public.training_session_overview with (security_invoker = true) as
select s.*, (select count(*) from public.training_registrations r where r.session_slug = s.slug) as registrations
from public.training_sessions s;

-- Seed from content/training/*.json (the sessions already on the website).
insert into public.training_sessions (slug, title, summary, format, certificate, area, starts_at, duration_min, price_inr, replay_url, external_register_url, published_on_site, site_published_at)
values ('2026-10-25-exam-report-responses-trademark-prosecution', 'Preparation of Exam Report Responses (Trademark Prosecution)', 'A three-hour live training on examination report responses, worked on a real Registry examination report: reading the report, choosing the route for Section 9 and Section 11 objections, structuring the reply and assembling the evidence index, then drafting the response live on screen. Bring your own examination report and we will work through two or three.', 'Real Registry examination report + live drafting', 'Certificate of Training on successful completion', 'Trademark', '2026-10-25T16:00:00+05:30', 180, 0, null, null, true, now())
on conflict (slug) do update set title = excluded.title, summary = excluded.summary, format = excluded.format, certificate = excluded.certificate, area = excluded.area, starts_at = excluded.starts_at, duration_min = excluded.duration_min, price_inr = excluded.price_inr, published_on_site = true;

insert into public.training_sessions (slug, title, summary, format, certificate, area, starts_at, duration_min, price_inr, replay_url, external_register_url, published_on_site, site_published_at)
values ('2026-11-12-your-first-patent-hearing', 'Your first patent hearing: written submissions that survive the hearing officer', 'A three-hour live training from the Rule 28 hearing notice to the fifteen-day written submission, worked on a real First Examination Report and hearing notice: what to concede, what to amend, how to structure the submission, and what hearing officers actually decide on. Bring your own hearing notice.', 'Real examination report and hearing notice + live drafting', 'Certificate of Training on successful completion', 'Patent', '2026-11-12T16:00:00+05:30', 180, 499, null, null, true, now())
on conflict (slug) do update set title = excluded.title, summary = excluded.summary, format = excluded.format, certificate = excluded.certificate, area = excluded.area, starts_at = excluded.starts_at, duration_min = excluded.duration_min, price_inr = excluded.price_inr, published_on_site = true;

