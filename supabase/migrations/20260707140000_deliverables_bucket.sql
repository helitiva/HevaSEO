-- Staff deliverables are work files (PDF/DOCX/XLSX/CSV/ZIP/images) — the order-media bucket only allows
-- image/video, so those uploads were rejected and the reviewer got nothing to download. Give deliverables
-- their own public bucket with no mime restriction (null = any type), own-uid-folder writes, public read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', true, 31457280, null)
on conflict (id) do nothing;

drop policy if exists "deliverables_public_read" on storage.objects;
create policy "deliverables_public_read" on storage.objects
  for select using (bucket_id = 'deliverables');

drop policy if exists "deliverables_own_write" on storage.objects;
create policy "deliverables_own_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'deliverables' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "deliverables_own_update" on storage.objects;
create policy "deliverables_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'deliverables' and (storage.foldername(name))[1] = auth.uid()::text);
