-- Feedback can only be submitted with consent to publish it. Run after 0015.
alter table public.training_feedback drop constraint if exists training_feedback_consent;
alter table public.training_feedback add constraint training_feedback_consent check (consent_publish) not valid;
