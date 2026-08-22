-- oku-pro — default 材質 / 比重 master for 基本重量計算
--
-- Values are sourced from d-engineer.com's published material density table.
-- Numerically, density in g/cm^3 equals the specific gravity value used by the
-- existing 重量計算 formula. Additive/idempotent: only inserts a name when it
-- does not already exist, so user-edited rows are never overwritten.

insert into weight_materials (name, density, sort_order)
select v.name, v.density, v.sort_order
from (values
  ('一般構造用圧延鋼材（SS400）', 7.85::numeric, 0),
  ('ステンレス鋼（SUS304）',      7.90::numeric, 1),
  ('鉄（Fe）',                    7.87::numeric, 2),
  ('アルミニウム（Al）',          2.70::numeric, 3),
  ('アルミニウム合金（A2017）',   2.70::numeric, 4),
  ('銅（Cu）',                    8.96::numeric, 5),
  ('銅合金・黄銅（C2600）',       8.40::numeric, 6),
  ('鋳鉄（FC200）',               7.30::numeric, 7),
  ('チタン（Ti）',                4.51::numeric, 8),
  ('亜鉛（Zn）',                  7.14::numeric, 9)
) as v(name, density, sort_order)
where not exists (
  select 1 from weight_materials wm where wm.name = v.name
);
