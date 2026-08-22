-- oku-pro — 重量計算材質 curated seed for 電気盤 work (idempotent, safe to re-run)
--
-- weight_materials started empty on purpose (0010) so nothing was guessed.
-- The user has now confirmed a concrete 10-material list with exact 比重
-- values to use as the working defaults (still editable per-row in 設定 or
-- per-calculation on the 重量計算 screen itself). This migration seeds/
-- updates exactly those rows without ever creating a duplicate, and folds
-- any old split copper entry (previously "銅（Cu）" at 8.96, added before
-- this list was confirmed) into the single canonical "銅" row at 8.94.

-- 1) Fold any old copper-grade entries into the canonical "銅" row. Deleted
--    outright (not renamed) — the canonical row is (re)created by the
--    upsert below regardless of whether one already existed.
delete from weight_materials
where name <> '黄銅（C2600）'
  and name like '%銅%'
  and (density = 8.96 or name in ('銅（Cu）', '銅(Cu)', 'C1100', 'C1020', '銅　C1100', '銅　C1020'));

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
--    is always safe: existing rows just get their 比重/order refreshed to
--    the confirmed values, nothing is duplicated.
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
