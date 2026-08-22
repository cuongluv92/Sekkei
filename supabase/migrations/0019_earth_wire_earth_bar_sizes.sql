-- oku-pro — 接地線選定マスタ (earth_wire_sizes) and アースバー選定マスタ
-- (earth_bar_sizes)
--
-- Two separate 社内選定マスタ tables, one per module:
--   * earth_wire_sizes backs 接地線's candidate search (single dimension:
--     断面積 mm², since 接地線 is a round/stranded conductor).
--   * earth_bar_sizes backs アースバー's candidate search (t × W, same shape
--     as busbar_sizes but intentionally a SEPARATE table — never reuse
--     busbar_sizes for this, per spec, since アースバー is a different
--     calculation/selection with its own applicable conditions even though
--     the geometry looks identical).
--
-- Both start empty on purpose, same policy as weight_materials (0010) and
-- busbar_sizes (0017): company preference data, never seeded with an
-- assumed size. Every row is entered via 設定. Additive: create table if
-- not exists, safe to re-run.

create table if not exists earth_wire_sizes (
  id uuid primary key default gen_random_uuid(),
  area_mm2 numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists earth_wire_sizes_sort_idx on earth_wire_sizes(sort_order);

alter table earth_wire_sizes enable row level security;
drop policy if exists anon_all on earth_wire_sizes;
create policy anon_all on earth_wire_sizes for all to anon using (true) with check (true);

create table if not exists earth_bar_sizes (
  id uuid primary key default gen_random_uuid(),
  thickness_mm numeric not null,
  width_mm numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists earth_bar_sizes_sort_idx on earth_bar_sizes(sort_order);

alter table earth_bar_sizes enable row level security;
drop policy if exists anon_all on earth_bar_sizes;
create policy anon_all on earth_bar_sizes for all to anon using (true) with check (true);
