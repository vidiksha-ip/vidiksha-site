-- The control panel reads sessions through training_session_overview, which was created before the "days" column
-- existed and therefore never returned it: editing a two-day session showed one day and saving wrote one day back.
-- Recreate the view so it carries every column, including days. Run after 0018.

drop view if exists public.training_session_overview;
create view public.training_session_overview with (security_invoker = true) as
select s.*, (select count(*) from public.training_registrations r where r.session_slug = s.slug) as registrations,
       public.session_ends_at(s) as ends_at
from public.training_sessions s;
