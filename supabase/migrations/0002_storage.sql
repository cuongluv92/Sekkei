-- oku-pro — Storage bucket for DWG/PDF/catalog/template files.
-- One public bucket, organized by folder prefix per owner type
-- (part-data/<id>/..., part-drawing/<id>/..., catalog/<id>/...,
-- templates/..., backups/...). `file_assets.storage_path` stores the exact
-- path within this bucket. Additive/idempotent — safe to re-run.

insert into storage.buckets (id, name, public)
values ('oku-pro-files', 'oku-pro-files', true)
on conflict (id) do nothing;

drop policy if exists anon_all_oku_pro_files on storage.objects;
create policy anon_all_oku_pro_files
  on storage.objects
  for all
  to anon
  using (bucket_id = 'oku-pro-files')
  with check (bucket_id = 'oku-pro-files');
