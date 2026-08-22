-- oku-pro — 母線銅帯 > 銅帯選定マスタ (company-preferred busbar dimensions: t × W)
--
-- Backs 母線銅帯's Auto-mode candidate search — starts empty on purpose,
-- same policy as weight_materials (0010): this is company preference data
-- (社内選定マスタ per spec), never seeded with an assumed size. Every row
-- is entered via 設定 > 銅帯選定マスタ. Additive: create table if not
-- exists, safe to re-run.

create table if not exists busbar_sizes (
  id uuid primary key default gen_random_uuid(),
  thickness_mm numeric not null,
  width_mm numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists busbar_sizes_sort_idx on busbar_sizes(sort_order);

alter table busbar_sizes enable row level security;
drop policy if exists anon_all on busbar_sizes;
create policy anon_all on busbar_sizes for all to anon using (true) with check (true);
