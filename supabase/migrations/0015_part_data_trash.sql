-- oku-pro — soft delete (ゴミ箱/trash) for 部品データ・部品図.
--
-- Adds deleted_at so removing a row from the UI moves it to the trash
-- (recoverable) instead of losing it outright; a separate "purge" action
-- (not this migration) does the real permanent delete later, from the
-- ゴミ箱 screen. Every existing query needs `deleted_at is null` added on
-- the app side — this migration only prepares the schema and, once ready,
-- moves the original demo/sample 部品データ rows (seeded in 0004_seed.sql,
-- never real user data) into the trash so real imports aren't mixed in
-- with placeholder examples. They land in the recoverable trash, not a
-- hard delete, so nothing is lost if that turns out to be wrong.

alter table part_data add column if not exists deleted_at timestamptz;
alter table part_drawings add column if not exists deleted_at timestamptz;

-- 0001_init.sql's `unique (model)` on part_data is wrong — 型式 alone isn't
-- unique (e.g. NF32-CVF legitimately repeats with a different 定格・仕様
-- per row), and the app's import matching was already fixed to key on
-- メーカー+品名+型式+定格・仕様 instead. Without this, that fix still
-- couldn't actually insert a second row sharing a 型式: the DB would
-- reject it. Replace the too-strict constraint with a partial unique
-- index on the real identity, scoped to `deleted_at is null` so a
-- trashed row's identity frees up for a fresh re-import.
alter table part_data drop constraint if exists part_data_model_key;
create unique index if not exists part_data_identity_idx
  on part_data (manufacturer_id, category, model, specification)
  where deleted_at is null;

with demo_rows (mfr_name, model, specification) as (
  values
    ('三菱電機', 'NF63-CV', '3P 50A 定格遮断容量2.5kA'),
    ('三菱電機', 'NF125-SV', '3P 100A 定格遮断容量5kA'),
    ('富士電機', 'SW-05', 'AC200V 3.7kW用'),
    ('日東工業', 'TB-20', '20極 600V 20A'),
    ('三菱電機', 'S-N20', 'AC200V 20A 3a'),
    ('パナソニック', 'BJW3403', '3P 30A'),
    ('富士電機', 'AH22-P', 'AC200V 赤'),
    ('三菱電機', 'NF32-SV', '3P 20A 定格遮断容量2.5kA')
)
update part_data pd
set deleted_at = now()
from demo_rows d
join manufacturers m on m.name = d.mfr_name
where pd.manufacturer_id = m.id
  and pd.model = d.model
  and pd.specification = d.specification
  and pd.deleted_at is null;
