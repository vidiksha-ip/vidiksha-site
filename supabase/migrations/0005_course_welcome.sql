-- After a verified course payment the payments function creates the buyer's VIDIKSHA account,
-- numbers the invoice and sends the welcome email. Run after 0004 in the SQL editor.

alter table public.course_enrolments
  add column if not exists invoice_no       text unique,
  add column if not exists invoice_at       timestamptz,
  add column if not exists payment_method   text,
  add column if not exists account_status   text,          -- 'created' | 'existing'
  add column if not exists welcome_sent_at  timestamptz;

-- Consecutive invoice numbers, one sequence per Indian financial year: VID/26-27/0001.
create table if not exists public.invoice_counters (
  fy    text primary key,
  last  integer not null default 0
);
alter table public.invoice_counters enable row level security;   -- no policies: service role only

create or replace function public.assign_invoice_number(enrolment uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  fy_label text;
  n integer;
  now_ist timestamptz := now() at time zone 'Asia/Kolkata';
  y integer := extract(year from now_ist);
begin
  select invoice_no into existing from course_enrolments where id = enrolment;
  if existing is not null then return existing; end if;
  if extract(month from now_ist) < 4 then y := y - 1; end if;      -- FY runs April to March
  fy_label := to_char(y % 100, 'FM00') || '-' || to_char((y + 1) % 100, 'FM00');
  insert into invoice_counters (fy, last) values (fy_label, 1)
    on conflict (fy) do update set last = invoice_counters.last + 1
    returning last into n;
  existing := 'VID/' || fy_label || '/' || to_char(n, 'FM0000');
  update course_enrolments set invoice_no = existing, invoice_at = now() where id = enrolment;
  return existing;
end;
$$;
revoke all on function public.assign_invoice_number(uuid) from public, anon, authenticated;

-- Lets the function find an existing member by email without listing every user.
create or replace function public.find_user_id_by_email(addr text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(addr) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;

-- What the learning portal will read: who owns which course.
create or replace view public.course_access
with (security_invoker = true) as
select user_id, email, course_slug, course_title, paid_at, invoice_no
from public.course_enrolments
where status = 'paid';

drop view if exists public.enrolment_overview;
create view public.enrolment_overview
with (security_invoker = true) as
select id, created_at, paid_at, status, course_title, amount_inr, invoice_no, full_name, email, whatsapp, profession, organisation,
       concat_ws(', ', address_line, city, state, pincode) as delivery_address,
       razorpay_order_id, razorpay_payment_id, payment_method, account_status,
       (sheet_sent_at is not null) as in_sheet, (welcome_sent_at is not null) as welcomed
from public.course_enrolments;
