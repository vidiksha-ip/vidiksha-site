-- Private storage bucket for the Research data (index shards, full-text shards, judgment text).
-- Run after 0002 in the Supabase SQL editor. Members read it with their session; nobody else can.
-- Uploads are done with the service key by scripts/research-upload.py, which bypasses these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('research', 'research', false, 52428800, array['application/json'])
on conflict (id) do update set public = false;

create policy "members read the research data"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'research');
