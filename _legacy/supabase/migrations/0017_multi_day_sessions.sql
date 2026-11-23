-- A live training session can run over several days (for example 25 and 26 October, 4 pm to 6 pm each day).
-- "days" holds one entry per sitting: [{"starts_at": "...", "duration_min": 120}, ...]. starts_at / duration_min on
-- the session stay as the first sitting, for sorting and older code. Run after 0016.

alter table public.training_sessions add column if not exists days jsonb not null default '[]'::jsonb;
update public.training_sessions
   set days = jsonb_build_array(jsonb_build_object('starts_at', starts_at, 'duration_min', duration_min))
 where days = '[]'::jsonb;

-- When the last sitting ends.
create or replace function public.session_ends_at(s public.training_sessions) returns timestamptz
language sql stable as $$
  select coalesce(
    (select max((d ->> 'starts_at')::timestamptz + make_interval(mins => coalesce((d ->> 'duration_min')::int, s.duration_min, 180)))
       from jsonb_array_elements(s.days) d),
    s.starts_at + make_interval(mins => coalesce(s.duration_min, 180)));
$$;

drop view if exists public.my_training;
create view public.my_training with (security_invoker = true) as
select r.id as registration_id, r.session_slug, coalesce(s.title, r.session_title) as title, s.summary, s.starts_at, s.duration_min, s.days, s.platform,
       s.replay_url, s.recording_path, s.whatsapp_group_url, r.attended, r.certificate_no, r.created_at as registered_at,
       public.session_ends_at(s) < now() as finished,
       (f.id is not null) as feedback_given
from public.training_registrations r
left join public.training_sessions s on s.slug = r.session_slug
left join public.training_feedback f on f.session_slug = r.session_slug and f.user_id = auth.uid()
where r.user_id = auth.uid() or lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
