-- Staff can pause, re-enable and extend a student's course access from the control panel.
-- Run after 0006 in the Supabase SQL editor.

alter table public.course_enrolments
  add column if not exists access_until     timestamptz,   -- overrides the default "2 months from payment" when set
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid;
alter table public.course_grants
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid;

-- Access = any live (not suspended) paid enrolment or grant. Enrolments run to access_until if set, else 2 months.
create or replace function public.course_access_until(slug text, uid uuid default auth.uid()) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(u) from (
    select coalesce(access_until, paid_at + interval '2 months') as u from public.course_enrolments
      where user_id = uid and course_slug = slug and status = 'paid' and suspended_at is null
    union all
    select coalesce(expires_at, 'infinity'::timestamptz) from public.course_grants
      where user_id = uid and course_slug = slug and suspended_at is null
  ) t;
$$;

drop view if exists public.my_courses;
create view public.my_courses with (security_invoker = true) as
select course_slug, max(course_title) as course_title, min(since) as since,
       max(until) filter (where not suspended) as until,
       bool_and(suspended) as suspended
from (
  select course_slug, course_title, paid_at as since, coalesce(access_until, paid_at + interval '2 months') as until, (suspended_at is not null) as suspended
    from public.course_enrolments where user_id = auth.uid() and status = 'paid'
  union all
  select g.course_slug, coalesce(p.title, g.course_slug), g.created_at, coalesce(g.expires_at, 'infinity'::timestamptz), (g.suspended_at is not null)
    from public.course_grants g left join public.course_prices p on p.slug = g.course_slug where g.user_id = auth.uid()
) t group by course_slug;

drop view if exists public.course_access;
create view public.course_access with (security_invoker = true) as
select user_id, email, course_slug, course_title, paid_at, invoice_no, coalesce(access_until, paid_at + interval '2 months') as until
from public.course_enrolments where status = 'paid' and suspended_at is null;

drop view if exists public.course_roster;
create view public.course_roster with (security_invoker = true) as
select e.course_slug, e.user_id, 'paid' as via, e.paid_at as since, coalesce(e.access_until, e.paid_at + interval '2 months') as until,
       (e.suspended_at is not null) as suspended, e.email, e.full_name
  from public.course_enrolments e where e.status = 'paid' and e.user_id is not null
union all
select g.course_slug, g.user_id, 'grant', g.created_at, coalesce(g.expires_at, 'infinity'::timestamptz), (g.suspended_at is not null), p.email, p.full_name
  from public.course_grants g join public.profiles p on p.id = g.user_id;

-- Staff actions. Enrolment rows stay otherwise read-only for staff (payment fields are never edited by hand).
create or replace function public.set_course_access(kind text, row_id uuid, enabled boolean, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if kind = 'enrolment' then
    update public.course_enrolments set suspended_at = case when enabled then null else now() end,
      suspended_reason = case when enabled then null else reason end, suspended_by = case when enabled then null else auth.uid() end
      where id = row_id;
  elsif kind = 'grant' then
    update public.course_grants set suspended_at = case when enabled then null else now() end,
      suspended_reason = case when enabled then null else reason end, suspended_by = case when enabled then null else auth.uid() end
      where id = row_id;
  else raise exception 'kind must be enrolment or grant'; end if;
end; $$;

create or replace function public.set_enrolment_access_until(enrolment_id uuid, until timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  update public.course_enrolments set access_until = until where id = enrolment_id;
end; $$;

-- Watching activity per student and session, for the member page.
create or replace view public.watch_activity with (security_invoker = true) as
select p.user_id, l.course_slug, l.id as lecture_id, l.position, l.title, l.duration_min, p.seconds, p.completed, p.updated_at as last_watched
from public.lecture_progress p join public.lectures l on l.id = p.lecture_id;
