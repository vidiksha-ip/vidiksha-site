-- Every student belongs to exactly one batch per course; a course can have many batches and one of them is
-- "open": new enrolments and grants land in it automatically. Staff create batches, choose the open one and move
-- students between batches in the control panel. Announcements can target a batch. Run after 0009.

alter table public.batches
  add column if not exists is_open  boolean not null default false,
  add column if not exists capacity integer;
create unique index if not exists batches_one_open_per_course on public.batches (course_slug) where is_open;

alter table public.course_grants add column if not exists batch_id uuid references public.batches (id) on delete set null;

-- The open batch of a course, created as "Batch 1" (or the next number) when the course has none.
create or replace function public.ensure_open_batch(slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid; n integer;
begin
  select id into bid from public.batches where course_slug = slug and is_open limit 1;
  if bid is not null then return bid; end if;
  select count(*) + 1 into n from public.batches where course_slug = slug;
  insert into public.batches (course_slug, name, starts_on, is_open) values (slug, 'Batch ' || n, current_date, true) returning id into bid;
  return bid;
end; $$;

-- Puts a student in one batch of a course (leaving any other batch of the same course). Staff, or the server.
create or replace function public.assign_batch(uid uuid, slug text, bid uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not (public.is_staff() or auth.role() = 'service_role' or current_user = 'postgres') then raise exception 'Staff only'; end if;
  target := coalesce(bid, public.ensure_open_batch(slug));
  if not exists (select 1 from public.batches where id = target and course_slug = slug) then raise exception 'That batch does not belong to this course'; end if;
  delete from public.batch_members m using public.batches b where m.batch_id = b.id and m.user_id = uid and b.course_slug = slug and b.id <> target;
  insert into public.batch_members (batch_id, user_id) values (target, uid) on conflict do nothing;
  return target;
end; $$;

-- Marks one batch of a course as the open one.
create or replace function public.set_open_batch(bid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare slug text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select course_slug into slug from public.batches where id = bid;
  update public.batches set is_open = false where course_slug = slug and is_open;
  update public.batches set is_open = true where id = bid;
end; $$;

-- Automatic assignment: a paid enrolment with an account, or a new grant, joins the course's open batch
-- (or the batch chosen on the grant) unless the student is already in a batch of that course.
create or replace function public.auto_assign_batch() returns trigger
language plpgsql security definer set search_path = public as $$
declare slug text; uid uuid; chosen uuid;
begin
  if tg_table_name = 'course_enrolments' then
    if new.status <> 'paid' or new.user_id is null then return new; end if;
    slug := new.course_slug; uid := new.user_id; chosen := null;
  else
    slug := new.course_slug; uid := new.user_id; chosen := new.batch_id;
  end if;
  if chosen is null and exists (select 1 from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = uid and b.course_slug = slug) then return new; end if;
  perform public.assign_batch(uid, slug, chosen);
  return new;
end; $$;
drop trigger if exists enrolment_batch on public.course_enrolments;
create trigger enrolment_batch after insert or update of status, user_id on public.course_enrolments
  for each row execute function public.auto_assign_batch();
drop trigger if exists grant_batch on public.course_grants;
create trigger grant_batch after insert on public.course_grants
  for each row execute function public.auto_assign_batch();

-- Backfill: everyone who already has a course joins its open batch.
do $$
declare r record;
begin
  for r in (select distinct user_id, course_slug from public.course_enrolments where status = 'paid' and user_id is not null
            union select user_id, course_slug from public.course_grants) loop
    if not exists (select 1 from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = r.user_id and b.course_slug = r.course_slug) then
      perform public.assign_batch(r.user_id, r.course_slug, null);
    end if;
  end loop;
end $$;

-- What a student sees about their own batches.
create or replace view public.my_batches with (security_invoker = true) as
select b.id, b.course_slug, b.name, b.starts_on, b.ends_on, b.notes, m.added_at
from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid();

-- Roster with the batch each student is in.
drop view if exists public.course_roster;
create view public.course_roster with (security_invoker = true) as
select r.*, bb.id as batch_id, bb.name as batch_name from (
  select e.course_slug, e.user_id, 'paid' as via, e.paid_at as since, coalesce(e.access_until, e.paid_at + interval '2 months') as until,
         (e.suspended_at is not null) as suspended, e.email, e.full_name
    from public.course_enrolments e where e.status = 'paid' and e.user_id is not null
  union all
  select g.course_slug, g.user_id, 'grant', g.created_at, coalesce(g.expires_at, 'infinity'::timestamptz), (g.suspended_at is not null), p.email, p.full_name
    from public.course_grants g join public.profiles p on p.id = g.user_id
) r left join lateral (
  select b.id, b.name from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = r.user_id and b.course_slug = r.course_slug limit 1
) bb on true;

-- Announcements can be addressed to a batch: audience = 'batch:<batch id>'.
drop policy if exists "students read announcements for them" on public.announcements;
create policy "students read announcements for them" on public.announcements for select
  using (audience = 'all' or public.has_course_access(audience)
         or (audience like 'batch:%' and exists (select 1 from public.batch_members m where m.user_id = auth.uid() and m.batch_id::text = substr(audience, 7))));
