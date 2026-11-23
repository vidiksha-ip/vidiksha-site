-- Feedback rules and the control panel's Feedbacks page. Run after 0014.

-- At least 100 words, and a LinkedIn profile address, enforced by the database as well as the form.
alter table public.training_feedback drop constraint if exists training_feedback_min_words;
alter table public.training_feedback add constraint training_feedback_min_words
  check (array_length(regexp_split_to_array(btrim(feedback), '\s+'), 1) >= 100);
alter table public.training_feedback drop constraint if exists training_feedback_linkedin;
alter table public.training_feedback add constraint training_feedback_linkedin
  check (linkedin_url ~* '^https?://([a-z0-9-]+\.)?linkedin\.com/');

-- Feedback with the participant, the session and the certificate issued for it.
drop view if exists public.training_feedback_overview;
create view public.training_feedback_overview with (security_invoker = true) as
select f.*, p.full_name, p.email, p.profession, p.organisation, p.whatsapp, s.title as session_title, s.starts_at,
       r.id as registration_id, r.certificate_no, r.certificate_issued_at, r.attended
from public.training_feedback f
join public.profiles p on p.id = f.user_id
left join public.training_sessions s on s.slug = f.session_slug
left join public.training_registrations r on r.session_slug = f.session_slug and (r.user_id = f.user_id or lower(r.email) = lower(p.email));
