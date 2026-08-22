-- oku-pro — Storage-backed Excel/DWG template management
--
-- Templates (⑦設計依頼書/⑧製作依頼書/②図面管理台帳/③④設計依頼書目次/⑤工程表/
-- ⑥仕入原価工数, plus a generic DWG template) are no longer bundled as static
-- files in the app — they live in Supabase Storage (bucket oku-pro-files,
-- under templates/<kind>/), and this table tracks upload history + which
-- version is currently active per kind. Uploading a new version deactivates
-- the previous one rather than deleting it, so a bad upload can be rolled
-- back from 設定 without re-uploading the old file.
-- Additive: create table if not exists, safe to re-run.

create table if not exists design_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  version integer not null,
  file_name text not null,
  storage_path text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint,
  active boolean not null default true,
  uploaded_at timestamptz not null default now()
);
create index if not exists design_templates_kind_idx on design_templates(kind);
create unique index if not exists design_templates_kind_version_idx on design_templates(kind, version);

alter table design_templates enable row level security;
drop policy if exists anon_all on design_templates;
create policy anon_all on design_templates for all to anon using (true) with check (true);
