-- oku-pro — 重量計算材質 curated seed for 電気盤 work (idempotent, safe to re-run)
--
-- Supersedes 0011_weight_material_seed.sql: that migration's verbose,
-- d-engineer.com-style names (一般構造用圧延鋼材（SS400）, ステンレス鋼（SUS304）,
-- 鉄（Fe）, separate アルミニウム（Al）/アルミニウム合金（A2017）, 銅（Cu）8.96, 銅合金・
-- 黄銅（C2600）, チタン（Ti）, 亜鉛（Zn）) predate the user's confirmed, simpler
-- 10-material working list — this migration replaces those exact rows with
-- the confirmed short names/values below, and folds the old split-copper
-- row (銅（Cu） at 8.96, also matched defensively by density=8.96 in case of
-- a manually-added variant) into the single canonical "銅" row at 8.94.
-- 鋳鉄（FC200） is already spelled identically in both lists, so it's simply
-- refreshed to the confirmed density in place — no duplicate created.
--
-- Any other custom material the user has added themselves (anything not in
-- either seed list) is left untouched.

-- 1) Remove the specific old-seed rows this migration supersedes, by exact
--    name (0011's rows) plus a density=8.96 fallback for a manually-typed
--    "銅（Cu）"-style variant — never touches 黄銅（C2600） or a user's own
--    custom materials.
delete from weight_materials
where name in (
  '一般構造用圧延鋼材（SS400）',
  'ステンレス鋼（SUS304）',
  '鉄（Fe）',
  'アルミニウム（Al）',
  'アルミニウム合金（A2017）',
  '銅（Cu）',
  '銅合金・黄銅（C2600）',
  'チタン（Ti）',
  '亜鉛（Zn）'
)
or (name <> '黄銅（C2600）' and name like '%銅%' and density = 8.96);

-- 2) Defensive general cleanup: collapse any accidental same-name duplicates
--    (e.g. a double-submit from the 設定 UI) before the unique index below,
--    keeping the earliest row of each name.
delete from weight_materials a
using weight_materials b
where a.name = b.name and a.id > b.id;

-- 3) Names are now safe to make unique — required for the idempotent
--    upsert in step 4, and prevents future duplicate adds too.
create unique index if not exists weight_materials_name_idx on weight_materials(name);

-- 4) Seed/update the confirmed 10-material list. Re-running this migration
--    (or 0011) again is always safe: rows just get their 比重/order
--    refreshed to the confirmed values, nothing is duplicated.
insert into weight_materials (name, density, sort_order) values
  ('鉄', 7.87, 0),
  ('SS400', 7.85, 1),
  ('SUS304', 7.90, 2),
  ('アルミ', 2.70, 3),
  ('銅', 8.94, 4),
  ('黄銅（C2600）', 8.40, 5),
  ('鋳鉄（FC200）', 7.30, 6),
  ('チタン', 4.51, 7),
  ('亜鉛', 7.14, 8),
  ('合板（ベニヤ板）', 0.60, 9)
on conflict (name) do update set density = excluded.density, sort_order = excluded.sort_order;
