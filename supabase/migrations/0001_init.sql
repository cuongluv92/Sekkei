-- oku-pro — initial schema
-- Additive and idempotent: every statement uses IF NOT EXISTS / DROP+CREATE
-- POLICY, so re-running this file never deletes existing data. Safe to run
-- once in the Supabase SQL Editor after creating the project.
--
-- No Supabase Auth is used anywhere in this app (explicit product decision:
-- no login screen, no users/roles). Every table below has RLS enabled with
-- a permissive "allow everything to anon" policy so the browser can read
-- and write directly with the public anon key. This means anyone who has
-- the anon key (which is necessarily public — it ships in client JS) can
-- read/write this data. That is the accepted tradeoff of "no auth" for an
-- internal tool; tighten these policies later if auth is ever introduced.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 設計管理
-- ---------------------------------------------------------------------

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists design_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  year integer not null,
  sequence_no integer not null,
  drawing_number text not null,
  request_type text not null default '',
  management_number text not null default '',
  construction_number text not null default '',
  orderer text not null default '',
  customer_contact text not null default '',
  project_name text not null default '',
  specs jsonb not null default '{}'::jsonb,
  design_remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, sequence_no)
);
create index if not exists design_cases_project_id_idx on design_cases(project_id);
create index if not exists design_cases_year_idx on design_cases(year);

create table if not exists case_panels (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references design_cases(id) on delete cascade,
  panel_no integer not null check (panel_no between 1 and 7),
  panel_name text not null default '',
  panel_structure text not null default '',
  face_count integer,
  design_due_date date,
  design_estimated_hours numeric,
  design_actual_hours numeric,
  production_estimated_hours numeric,
  production_actual_hours numeric,
  electrical_method text not null default '',
  rated_voltage text not null default '',
  rated_current text not null default '',
  rated_breaking_capacity text not null default '',
  frequency text not null default '',
  control_voltage text not null default '',
  protection_rating text not null default '',
  unique (case_id, panel_no)
);
create index if not exists case_panels_case_id_idx on case_panels(case_id);

create table if not exists production_requests (
  case_id uuid primary key references design_cases(id) on delete cascade,
  production_notes text not null default '',
  inspection_sheet text not null default '',
  film_thickness text not null default '',
  earth_leakage text not null default '',
  earth_leakage_alarm text not null default '',
  withstand_voltage text not null default ''
);

create table if not exists case_schedules (
  case_id uuid primary key references design_cases(id) on delete cascade,
  sheet_metal_order_date date,
  sheet_metal_delivery_date date,
  box_order_date date,
  box_delivery_date date,
  accessory_order_date date,
  accessory_delivery_date date,
  production_start_date date,
  production_end_date date,
  inspection_start_date date,
  inspection_end_date date,
  witness_start_date date,
  witness_end_date date,
  shipping_start_date date,
  shipping_end_date date,
  delivery_date date
);

create table if not exists schedule_colors (
  category text primary key,
  color text not null
);

create table if not exists master_list_items (
  id uuid primary key default gen_random_uuid(),
  list_key text not null,
  value text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  unique (list_key, value)
);
create index if not exists master_list_items_list_key_idx on master_list_items(list_key);

-- ---------------------------------------------------------------------
-- 部品データ・部品図・カタログ
-- ---------------------------------------------------------------------

create table if not exists manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_vi text,
  unique (name)
);

create table if not exists part_data (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  category text not null default '',
  manufacturer_id uuid references manufacturers(id) on delete set null,
  model text not null,
  specification text not null default '',
  weight numeric,
  quantity numeric,
  remarks text,
  source text not null default '',
  updated_at timestamptz not null default now(),
  unique (model)
);

create table if not exists part_drawings (
  id uuid primary key default gen_random_uuid(),
  category text not null default '',
  manufacturer_id uuid references manufacturers(id) on delete set null,
  model text not null,
  specification text not null default '',
  remarks text,
  source text not null default '',
  updated_at timestamptz not null default now(),
  unique (model)
);

create table if not exists catalogs (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid references manufacturers(id) on delete set null,
  category text not null default '',
  model text not null default '',
  file_name text not null default '',
  updated_at timestamptz not null default now()
);

-- Binary files (DWG/PDF/image) live in Supabase Storage; this table only
-- holds metadata + the storage path, per "database stores metadata/path
-- only, never binary content".
create table if not exists file_assets (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('part_data', 'part_drawing', 'catalog', 'template')),
  owner_id uuid not null,
  kind text not null check (kind in ('dwg', 'pdf', 'image', 'excel')),
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  updated_at timestamptz not null default now()
);
create index if not exists file_assets_owner_idx on file_assets(owner_type, owner_id);

-- ---------------------------------------------------------------------
-- 選定
-- ---------------------------------------------------------------------

create table if not exists selection_rules (
  id uuid primary key default gen_random_uuid(),
  output_key text not null,
  unit text not null,
  min_value numeric not null,
  max_value numeric not null,
  result_value text not null,
  remarks text,
  sort_order integer not null default 0,
  enabled boolean not null default true
);

-- ---------------------------------------------------------------------
-- 部品製作
-- ---------------------------------------------------------------------

create table if not exists part_assembly_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  position integer not null default 0,
  symbol text not null default '',
  name text not null default '',
  manufacturer_id uuid references manufacturers(id) on delete set null,
  model text not null default '',
  specification text not null default '',
  weight numeric,
  quantity numeric not null default 1,
  remarks text,
  source_ref_id uuid,
  source_type text check (source_type in ('part-data', 'part-drawing', 'catalog')),
  case_id uuid references design_cases(id) on delete set null,
  panel_id uuid references case_panels(id) on delete set null
);
create index if not exists part_assembly_rows_project_id_idx on part_assembly_rows(project_id);

-- ---------------------------------------------------------------------
-- RLS — no Auth in this app: anon can do everything on every table above.
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'projects', 'design_cases', 'case_panels', 'production_requests',
      'case_schedules', 'schedule_colors', 'master_list_items',
      'manufacturers', 'part_data', 'part_drawings', 'catalogs',
      'file_assets', 'selection_rules', 'part_assembly_rows'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists anon_all on %I', t);
    execute format(
      'create policy anon_all on %I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;
