-- Every batch has an enrolment window. The website's Enrol now button and the payment function follow the open
-- batch's window: before enrol_from or after enrol_until, enrolment is closed. Run after 0013.

alter table public.batches
  add column if not exists enrol_from  date,
  add column if not exists enrol_until date;   -- last date to enrol, inclusive (IST)

-- Existing open batches: open from their start date (or today) with no end date until staff set one.
update public.batches set enrol_from = coalesce(starts_on, current_date) where is_open and enrol_from is null;

-- What the public website reads (anon) to decide whether Enrol now is active. One row per course: its open batch.
create or replace view public.open_enrolment as
select course_slug, id as batch_id, name as batch_name, starts_on, enrol_from, enrol_until,
       (coalesce(enrol_from, current_date) <= (now() at time zone 'Asia/Kolkata')::date
        and (enrol_until is null or enrol_until >= (now() at time zone 'Asia/Kolkata')::date)) as enrolling
from public.batches where is_open;
grant select on public.open_enrolment to anon, authenticated;

-- Server-side check used by the payment function.
create or replace function public.enrolment_window(slug text) returns table (batch_name text, enrol_from date, enrol_until date, enrolling boolean, has_batch boolean)
language sql stable security definer set search_path = public as $$
  select b.name, b.enrol_from, b.enrol_until,
         (coalesce(b.enrol_from, current_date) <= (now() at time zone 'Asia/Kolkata')::date and (b.enrol_until is null or b.enrol_until >= (now() at time zone 'Asia/Kolkata')::date)),
         true
  from public.batches b where b.course_slug = slug and b.is_open
  union all
  select null, null, null, true, false where not exists (select 1 from public.batches where course_slug = slug and is_open)
  limit 1;
$$;
