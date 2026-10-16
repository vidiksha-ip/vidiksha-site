-- Paid course enrolments through Razorpay. Run after 0003 in the Supabase SQL editor.
-- Prices live here so the Edge Function charges the server-side amount, never what the browser says.

create table if not exists public.course_prices (
  slug       text primary key,
  title      text not null,
  price_inr  integer not null check (price_inr > 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.course_prices (slug, title, price_inr) values
  ('trademark-prosecution-in-practice', 'Trademark Prosecution in Practice', 7999)
on conflict (slug) do update set title = excluded.title, price_inr = excluded.price_inr, updated_at = now();

alter table public.course_prices enable row level security;
create policy "anyone can read active course prices"
  on public.course_prices for select using (active);

create table if not exists public.course_enrolments (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  course_slug         text not null references public.course_prices (slug),
  course_title        text not null,
  amount_inr          integer not null,
  full_name           text not null,
  email               text not null,
  whatsapp            text,
  profession          text,
  organisation        text,
  address_line        text,
  city                text,
  state               text,
  pincode             text,
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  status              text not null default 'created' check (status in ('created', 'paid', 'failed')),
  paid_at             timestamptz,
  sheet_sent_at       timestamptz,
  user_id             uuid references auth.users (id) on delete set null
);

create index if not exists course_enrolments_email on public.course_enrolments (lower(email));
create index if not exists course_enrolments_status on public.course_enrolments (status, created_at desc);

-- Only the Edge Function (service role) writes here. Members can see their own paid enrolments.
alter table public.course_enrolments enable row level security;
create policy "members see their own enrolments"
  on public.course_enrolments for select
  using (auth.uid() = user_id or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Dashboard view: who paid for what, and whether the sheet has the row.
create or replace view public.enrolment_overview
with (security_invoker = true) as
select id, created_at, paid_at, status, course_title, amount_inr, full_name, email, whatsapp, profession, organisation,
       concat_ws(', ', address_line, city, state, pincode) as delivery_address,
       razorpay_order_id, razorpay_payment_id, (sheet_sent_at is not null) as in_sheet
from public.course_enrolments;
