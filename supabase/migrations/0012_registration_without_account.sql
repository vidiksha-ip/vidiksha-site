-- Live training registrations no longer create accounts or send emails. The website posts them to the payments
-- function, which stores the row here (linked to an account only when the email already has one) and returns the
-- session's WhatsApp group link for the thank-you message. Run after 0011.

alter table public.training_sessions add column if not exists whatsapp_group_url text;

-- One registration per email per session, with or without an account.
create unique index if not exists training_registrations_email_session on public.training_registrations (lower(email), session_slug);

-- Registrations are inserted by the function (service role); the old "members register themselves" path stays for
-- signed-in members but is no longer used by the site.
