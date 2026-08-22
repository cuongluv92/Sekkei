-- oku-pro — Storage-backed 部品製作 export templates (Excel/DWG)
--
-- Mirrors design_templates (0008) but simpler: 部品製作's Excel出力/DWG出力
-- templates only ever have one active file per kind, no version history —
-- matches the existing 設定 > 部品製作テンプレート panel, which only shows
-- "current file" with no rollback UI. Uploading again simply replaces the
-- row for that kind (and its Storage object, same path every time).
-- Additive: create table if not exists, safe to re-run.

create table if not exists part_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('excel', 'dwg')),
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);
create unique index if not exists part_templates_kind_idx on part_templates(kind);

alter table part_templates enable row level security;
drop policy if exists anon_all on part_templates;
create policy anon_all on part_templates for all to anon using (true) with check (true);
