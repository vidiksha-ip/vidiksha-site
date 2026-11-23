-- VIDIKSHA learning portal (portal.vidiksha.in) and control panel (control.vidiksha.in).
-- Run after 0005 in the Supabase SQL editor. Then make yourself an admin:
--   select public.make_admin('you@example.com');
--
-- Students sign in with the account created at purchase. Staff are ordinary accounts listed in public.staff.
-- Every table is protected by row level security: students see their own rows and the published content of the
-- courses they have access to; staff see and edit everything. Files live in private storage buckets.

-- ---------------------------------------------------------------- staff and roles
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  full_name  text,
  added_at   timestamptz not null default now(),
  added_by   uuid
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid()); $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin'); $$;

create policy "staff see the staff list" on public.staff for select using (public.is_staff());
create policy "admins manage staff" on public.staff for all using (public.is_admin()) with check (public.is_admin());

-- Run from the SQL editor (service role) to bootstrap the first admin; admins can add more from the control panel.
create or replace function public.make_admin(addr text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; nm text;
begin
  select id, raw_user_meta_data ->> 'full_name' into uid, nm from auth.users where lower(email) = lower(addr);
  if uid is null then return 'No account with that email. Create it first (sign up on the site or register for a session).'; end if;
  insert into public.staff (user_id, role, full_name) values (uid, 'admin', nm)
    on conflict (user_id) do update set role = 'admin';
  return 'Admin: ' || addr;
end; $$;
revoke all on function public.make_admin(text) from public, anon, authenticated;

-- Admins add staff from the control panel by email.
create or replace function public.add_staff_by_email(addr text, new_role text default 'staff') returns text
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; nm text;
begin
  if not public.is_admin() then raise exception 'Only admins can add staff'; end if;
  if new_role not in ('admin', 'staff') then raise exception 'Role must be admin or staff'; end if;
  select id, raw_user_meta_data ->> 'full_name' into uid, nm from auth.users where lower(email) = lower(addr);
  if uid is null then return 'No account with that email. Ask them to create one on vidiksha.in first.'; end if;
  insert into public.staff (user_id, role, full_name, added_by) values (uid, new_role, nm, auth.uid())
    on conflict (user_id) do update set role = excluded.role;
  return 'Added ' || addr || ' as ' || new_role;
end; $$;

-- ---------------------------------------------------------------- staff can read the member data
create policy "staff read all profiles" on public.profiles for select using (public.is_staff());
create policy "staff update profiles" on public.profiles for update using (public.is_staff()) with check (public.is_staff());
create policy "staff read enrolments" on public.course_enrolments for select using (public.is_staff());
create policy "staff read registrations" on public.training_registrations for select using (public.is_staff());
create policy "staff read research logins" on public.research_logins for select using (public.is_staff());
create policy "staff manage course prices" on public.course_prices for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------- course access
-- A student has a course through a paid enrolment (2 months from payment) or a manual grant (optionally time-limited).
create table if not exists public.course_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_slug text not null,
  expires_at  timestamptz,
  note        text,
  granted_by  uuid,
  created_at  timestamptz not null default now()
);
alter table public.course_grants enable row level security;
create policy "students see their own grants" on public.course_grants for select using (auth.uid() = user_id);
create policy "staff manage grants" on public.course_grants for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.course_access_until(slug text, uid uuid default auth.uid()) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(u) from (
    select paid_at + interval '2 months' as u from public.course_enrolments where user_id = uid and course_slug = slug and status = 'paid'
    union all
    select coalesce(expires_at, 'infinity'::timestamptz) from public.course_grants where user_id = uid and course_slug = slug
  ) t;
$$;

create or replace function public.has_course_access(slug text) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.course_access_until(slug, auth.uid()) > now(), false); $$;

create or replace view public.my_courses with (security_invoker = true) as
select course_slug, max(course_title) as course_title, min(since) as since, max(until) as until
from (
  select course_slug, course_title, paid_at as since, paid_at + interval '2 months' as until
    from public.course_enrolments where user_id = auth.uid() and status = 'paid'
  union all
  select g.course_slug, coalesce(p.title, g.course_slug), g.created_at, coalesce(g.expires_at, 'infinity'::timestamptz)
    from public.course_grants g left join public.course_prices p on p.slug = g.course_slug where g.user_id = auth.uid()
) t group by course_slug;

-- ---------------------------------------------------------------- batches
create table if not exists public.batches (
  id          uuid primary key default gen_random_uuid(),
  course_slug text not null,
  name        text not null,
  starts_on   date,
  ends_on     date,
  notes       text,
  created_at  timestamptz not null default now()
);
create table if not exists public.batch_members (
  batch_id  uuid not null references public.batches (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (batch_id, user_id)
);
alter table public.batches enable row level security;
alter table public.batch_members enable row level security;
create policy "students see their batches" on public.batches for select using (exists (select 1 from public.batch_members m where m.batch_id = id and m.user_id = auth.uid()));
create policy "students see their membership" on public.batch_members for select using (auth.uid() = user_id);
create policy "staff manage batches" on public.batches for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage batch members" on public.batch_members for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------- course content
create table if not exists public.lectures (
  id           uuid primary key default gen_random_uuid(),
  course_slug  text not null,
  position     integer not null default 1,
  title        text not null,
  description  text,
  video_url    text,            -- YouTube (unlisted), Vimeo or any embeddable page
  video_path   text,            -- or a file in the lms-videos bucket: <course_slug>/<file>
  duration_min integer,
  published    boolean not null default false,
  release_at   timestamptz,     -- optional drip date; null = available as soon as published
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lectures_course on public.lectures (course_slug, position);

create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  course_slug text not null,
  lecture_id  uuid references public.lectures (id) on delete set null,
  title       text not null,
  file_path   text,             -- lms-materials bucket: <course_slug>/<file>
  url         text,             -- or an external link
  created_at  timestamptz not null default now()
);

create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  course_slug  text not null,
  lecture_id   uuid references public.lectures (id) on delete set null,
  title        text not null,
  instructions text,
  due_at       timestamptz,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  body          text,
  file_path     text,            -- lms-submissions bucket: <user_id>/<file>
  submitted_at  timestamptz not null default now(),
  grade         text,
  feedback      text,
  graded_at     timestamptz,
  graded_by     uuid,
  unique (assignment_id, user_id)
);

create table if not exists public.lecture_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  seconds    integer not null default 0,
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lecture_id)
);

alter table public.lectures enable row level security;
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.lecture_progress enable row level security;

create policy "students see released lectures of their courses" on public.lectures for select
  using (published and (release_at is null or release_at <= now()) and public.has_course_access(course_slug));
create policy "students see materials of their courses" on public.materials for select using (public.has_course_access(course_slug));
create policy "students see published assignments of their courses" on public.assignments for select
  using (published and public.has_course_access(course_slug));
create policy "students manage their own submissions" on public.submissions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id and graded_at is null);
create policy "students track their own progress" on public.lecture_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "staff manage lectures" on public.lectures for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage materials" on public.materials for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage assignments" on public.assignments for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage submissions" on public.submissions for all using (public.is_staff()) with check (public.is_staff());
create policy "staff read progress" on public.lecture_progress for select using (public.is_staff());

-- ---------------------------------------------------------------- announcements, messages, activity
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  audience   text not null default 'all',   -- 'all' or a course_slug
  title      text not null,
  body       text,
  pinned     boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,   -- the student
  from_staff boolean not null default true,
  sender_id  uuid,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists messages_user on public.messages (user_id, created_at desc);
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  event      text not null,                  -- 'portal_login', 'lecture_completed', 'submission', ...
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_user on public.activity_log (user_id, created_at desc);

alter table public.announcements enable row level security;
alter table public.messages enable row level security;
alter table public.activity_log enable row level security;

create policy "students read announcements for them" on public.announcements for select
  using (audience = 'all' or public.has_course_access(audience));
create policy "staff manage announcements" on public.announcements for all using (public.is_staff()) with check (public.is_staff());
create policy "students read their messages" on public.messages for select using (auth.uid() = user_id);
create policy "students mark messages read and reply" on public.messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "students send replies" on public.messages for insert with check (auth.uid() = user_id and from_staff = false and sender_id = auth.uid());
create policy "staff manage messages" on public.messages for all using (public.is_staff()) with check (public.is_staff());
create policy "students log their own activity" on public.activity_log for insert with check (auth.uid() = user_id);
create policy "students see their own activity" on public.activity_log for select using (auth.uid() = user_id);
create policy "staff read activity" on public.activity_log for select using (public.is_staff());

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('lms-videos', 'lms-videos', false, null), ('lms-materials', 'lms-materials', false, 104857600), ('lms-submissions', 'lms-submissions', false, 26214400)
on conflict (id) do update set public = false;

-- paths are <course_slug>/<file> for videos and materials, <user_id>/<file> for submissions
create policy "students stream videos of their courses" on storage.objects for select to authenticated
  using (bucket_id = 'lms-videos' and public.has_course_access((storage.foldername(name))[1]));
create policy "students download materials of their courses" on storage.objects for select to authenticated
  using (bucket_id = 'lms-materials' and public.has_course_access((storage.foldername(name))[1]));
create policy "students upload their own submissions" on storage.objects for insert to authenticated
  with check (bucket_id = 'lms-submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "students read their own submissions" on storage.objects for select to authenticated
  using (bucket_id = 'lms-submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "staff manage lms files" on storage.objects for all to authenticated
  using (bucket_id in ('lms-videos', 'lms-materials', 'lms-submissions') and public.is_staff())
  with check (bucket_id in ('lms-videos', 'lms-materials', 'lms-submissions') and public.is_staff());

-- ---------------------------------------------------------------- joins to profiles
-- PostgREST embeds (e.g. submissions -> profiles) need a declared foreign key to public.profiles, not only to auth.users.
alter table public.staff            add constraint staff_profile_fk            foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.submissions      add constraint submissions_profile_fk      foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.lecture_progress add constraint lecture_progress_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.messages         add constraint messages_profile_fk         foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.batch_members    add constraint batch_members_profile_fk    foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.course_grants    add constraint course_grants_profile_fk    foreign key (user_id) references public.profiles (id) on delete cascade;

-- ---------------------------------------------------------------- dashboard helpers for staff
create or replace view public.student_overview with (security_invoker = true) as
select p.id, p.email, p.full_name, p.whatsapp, p.profession, p.organisation, p.qualification, p.created_at, p.last_login_at,
       (select count(*) from public.course_enrolments e where e.user_id = p.id and e.status = 'paid') as paid_courses,
       (select count(*) from public.course_grants g where g.user_id = p.id) as grants,
       (select count(*) from public.training_registrations r where r.user_id = p.id) as registrations,
       (select count(*) from public.research_logins l where l.user_id = p.id) as research_logins,
       (select max(created_at) from public.activity_log a where a.user_id = p.id and a.event = 'portal_login') as last_portal_login
from public.profiles p;

create or replace view public.course_roster with (security_invoker = true) as
select course_slug, user_id, 'paid' as via, paid_at as since, paid_at + interval '2 months' as until, email, full_name
  from public.course_enrolments where status = 'paid' and user_id is not null
union all
select g.course_slug, g.user_id, 'grant', g.created_at, coalesce(g.expires_at, 'infinity'::timestamptz), p.email, p.full_name
  from public.course_grants g join public.profiles p on p.id = g.user_id;
