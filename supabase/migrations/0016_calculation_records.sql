-- oku-pro — generic per-Project calculation persistence.
--
-- One row per (project_id, calculation_type): 基本重量計算 saves one row per
-- shape (calculation_type = 'weight-basic-angle', 'weight-basic-channel',
-- 'weight-basic-flatBar', 'weight-basic-hat'); 盤重量計算/換気計算/耐震計算/
-- 他計算 modules each save one row (calculation_type = 'weight-panel',
-- 'ventilation', 'seismic', 'busbar', 'earth-wire', ...). input/result are
-- jsonb so each calculation type's own shape can differ without new columns
-- or new tables — this is what keeps 盤重量計算 (not fully implemented yet)
-- forward-compatible without a later migration. No version history: saving
-- again just replaces the row for that (project, type). Uses the existing
-- `projects` table (0001_init.sql) — no separate per-calculation Project
-- system.

create table if not exists calculation_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  calculation_type text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists calculation_records_project_type_idx
  on calculation_records(project_id, calculation_type);

alter table calculation_records enable row level security;
drop policy if exists anon_all on calculation_records;
create policy anon_all on calculation_records for all to anon using (true) with check (true);
