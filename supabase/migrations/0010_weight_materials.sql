-- oku-pro — 重量計算 > 基本重量計算 材質 master (材質名 + 比重)
--
-- Backs the 材質 dropdown in 基本重量計算 (アングル/チャンネル/フラットバー) — starts
-- empty on purpose, same policy as selection_rules: every row is entered
-- via 設定 > 重量計算材質設定, never seeded with an invented density value.
-- Additive: create table if not exists, safe to re-run.

create table if not exists weight_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  density numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists weight_materials_sort_idx on weight_materials(sort_order);

alter table weight_materials enable row level security;
drop policy if exists anon_all on weight_materials;
create policy anon_all on weight_materials for all to anon using (true) with check (true);
