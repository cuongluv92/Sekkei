-- oku-pro — starter/demo data
-- Additive and idempotent: every insert is guarded (ON CONFLICT DO NOTHING or
-- WHERE NOT EXISTS), so re-running this file never duplicates or overwrites
-- rows. Safe to run once, right after 0001_init.sql, so the app has
-- something to show immediately after connecting real Supabase credentials.
--
-- This is starter data for verification purposes only — it mirrors the
-- previous localStorage mock seed 1:1 so behavior is comparable before/after
-- the backend switch. No file attachments are seeded here (see file_assets):
-- the old mock only had placeholder file *names*, never real binary content,
-- and per "no mock/placeholder in production" this migration will not create
-- file_assets rows that point at Storage objects that don't actually exist.
-- Real files get attached once the upload UI is wired to Supabase Storage.

-- ---------------------------------------------------------------------
-- manufacturers (メーカー)
-- ---------------------------------------------------------------------

insert into manufacturers (name, name_vi)
values
  ('三菱電機', 'Mitsubishi Electric'),
  ('富士電機', 'Fuji Electric'),
  ('パナソニック', 'Panasonic'),
  ('日東工業', 'Nitto Kogyo'),
  ('日立産機システム', 'Hitachi Industrial'),
  ('三和電機', 'Sanwa Electric')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 設計管理: sample project + 3 design cases + their 盤①
-- ---------------------------------------------------------------------

insert into projects (name, created_at)
select 'サンプルプロジェクト', '2026-01-06'::timestamptz
where not exists (select 1 from projects where name = 'サンプルプロジェクト');

insert into design_cases (
  project_id, year, sequence_no, drawing_number, request_type, management_number,
  construction_number, orderer, customer_contact, project_name, design_remarks,
  created_at, updated_at
)
select
  (select id from projects where name = 'サンプルプロジェクト' limit 1),
  v.year, v.sequence_no, v.drawing_number, v.request_type, v.management_number,
  v.construction_number, v.orderer, v.customer_contact, v.project_name, '',
  v.created_at::timestamptz, v.created_at::timestamptz
from (values
  (2026, 1, '26-001', '新規', 'A260101', 'R123456', 'サンプル電機株式会社', '山田', '本社ビル電気設備改修', '2026-01-06'),
  (2026, 2, '26-002', '新規', 'A260102', 'V1123456', 'サンプル電機株式会社', '鈴木', '工場ライン増設', '2026-02-10'),
  (2026, 3, '26-003', '変更', 'A260103', 'R223344', 'サンプル電機株式会社', '山田', '倉庫照明更新', '2026-03-02')
) as v(year, sequence_no, drawing_number, request_type, management_number, construction_number, orderer, customer_contact, project_name, created_at)
on conflict (year, sequence_no) do nothing;

insert into case_panels (
  case_id, panel_no, panel_name, panel_structure, face_count,
  design_estimated_hours, design_actual_hours
)
select (select id from design_cases where drawing_number = v.drawing_number limit 1),
  1, v.panel_name, v.panel_structure, 1, v.design_estimated_hours, v.design_actual_hours
from (values
  ('26-001', '動力盤', '自立盤', 8, 6),
  ('26-002', '制御盤', '壁掛盤', 5, null),
  ('26-003', '照明盤', '壁掛盤', 3, 3)
) as v(drawing_number, panel_name, panel_structure, design_estimated_hours, design_actual_hours)
on conflict (case_id, panel_no) do nothing;

-- ---------------------------------------------------------------------
-- 設計管理設定: starter master list values (editable from 設定 afterward)
-- ---------------------------------------------------------------------

insert into master_list_items (list_key, value, sort_order)
select v.list_key, v.value, v.sort_order
from (values
  ('requestType', '新規', 0), ('requestType', '変更', 1), ('requestType', '追加', 2),
  ('panelStructure', '自立盤', 0), ('panelStructure', '壁掛盤', 1), ('panelStructure', 'キュービクル形', 2),
  ('location', '屋内', 0), ('location', '屋外', 1),
  ('installation', '床置', 0), ('installation', '壁掛', 1),
  ('structure', '自立', 0), ('structure', '壁掛', 1),
  ('material', '鋼板', 0), ('material', 'ステンレス', 1),
  ('color', 'マンセル 5Y7/1', 0), ('color', '指定なし', 1),
  ('gloss', '半艶', 0), ('gloss', '艶消し', 1),
  ('handleLocation', '前面', 0), ('handleLocation', '側面', 1),
  ('handleType', 'レバーハンドル', 0), ('handleType', 'ハンドル錠付', 1),
  ('keyNo', 'No.1', 0), ('keyNo', 'No.2', 1),
  ('wireEntry', '上入線', 0), ('wireEntry', '下入線', 1),
  ('opening', 'あり', 0), ('opening', 'なし', 1),
  ('blankPlate', 'あり', 0), ('blankPlate', 'なし', 1),
  ('electricalMethod', '三相3線式', 0), ('electricalMethod', '単相2線式', 1),
  ('powerSource', '自家発', 0), ('powerSource', '商用', 1),
  ('voltage', '200V', 0), ('voltage', '400V', 1),
  ('terminalBlock', 'あり', 0), ('terminalBlock', 'なし', 1)
) as v(list_key, value, sort_order)
on conflict (list_key, value) do nothing;

-- ---------------------------------------------------------------------
-- 工程色設定: default legend palette
-- ---------------------------------------------------------------------

insert into schedule_colors (category, color)
values
  ('sheetMetal', '#92d050'),
  ('box', '#92d050'),
  ('accessory', '#ffe699'),
  ('production', '#a5a5a5'),
  ('inspection', '#00b0f0'),
  ('witness', '#ffc000'),
  ('shipping', '#f4b183')
on conflict (category) do nothing;

-- ---------------------------------------------------------------------
-- 部品データ (8 rows)
-- ---------------------------------------------------------------------

insert into part_data (symbol, category, manufacturer_id, model, specification, quantity, remarks, source, updated_at)
select null, v.category, (select id from manufacturers where name = v.mfr_name limit 1), v.model, v.specification,
  v.quantity, v.remarks, v.source, v.updated_at::timestamptz
from (values
  ('配線用遮断器', '三菱電機', 'NF63-CV', '3P 50A 定格遮断容量2.5kA', 1, '盤内主幹用', '社内部品DB', '2026-06-02'),
  ('配線用遮断器', '三菱電機', 'NF125-SV', '3P 100A 定格遮断容量5kA', 1, '', '社内部品DB', '2026-05-20'),
  ('電磁開閉器', '富士電機', 'SW-05', 'AC200V 3.7kW用', 1, '熱動継電器付', 'メーカーカタログ取込', '2026-04-11'),
  ('端子台', '日東工業', 'TB-20', '20極 600V 20A', 2, '', '社内部品DB', '2026-03-30'),
  ('電磁接触器', '三菱電機', 'S-N20', 'AC200V 20A 3a', 1, '補助接点2a2b', '社内部品DB', '2026-02-14'),
  ('配線用遮断器', 'パナソニック', 'BJW3403', '3P 30A', 1, '漏電遮断器', '社内部品DB', '2026-01-25'),
  ('表示灯', '富士電機', 'AH22-P', 'AC200V 赤', 3, '', '社内部品DB', '2025-12-18'),
  ('配線用遮断器', '三菱電機', 'NF32-SV', '3P 20A 定格遮断容量2.5kA', 1, '分岐用', '社内部品DB', '2025-11-09')
) as v(category, mfr_name, model, specification, quantity, remarks, source, updated_at)
on conflict (model) do nothing;

-- ---------------------------------------------------------------------
-- 部品図 (5 rows)
-- ---------------------------------------------------------------------

insert into part_drawings (category, manufacturer_id, model, specification, remarks, source, updated_at)
select v.category, (select id from manufacturers where name = v.mfr_name limit 1), v.model, v.specification,
  v.remarks, v.source, v.updated_at::timestamptz
from (values
  ('配線用遮断器', '三菱電機', 'NF63-CV', '外形図・取付寸法図', '盤設計標準図', '社内図面DB', '2026-06-05'),
  ('電磁接触器', '三菱電機', 'S-N20', '外形図', '', '社内図面DB', '2026-05-02'),
  ('盤筐体', '日東工業', 'CASE-800x600', '自立盤 800x600x2000', '標準キャビネット', '社内図面DB', '2026-04-28'),
  ('電磁開閉器', '富士電機', 'SW-05', '外形図', '', '社内図面DB', '2026-03-15'),
  ('配線用遮断器', '三菱電機', 'NF32-SV', '外形図・盤内配置図', '', '社内図面DB', '2026-01-30')
) as v(category, mfr_name, model, specification, remarks, source, updated_at)
on conflict (model) do nothing;

-- ---------------------------------------------------------------------
-- カタログ (4 rows)
-- ---------------------------------------------------------------------

insert into catalogs (manufacturer_id, category, model, file_name, updated_at)
select (select id from manufacturers where name = v.mfr_name limit 1), v.category, v.model, v.file_name, v.updated_at::timestamptz
from (values
  ('三菱電機', '配線用遮断器', 'NFシリーズ', 'NFseries_catalog_2026.pdf', '2026-04-01'),
  ('富士電機', '電磁開閉器', 'SWシリーズ', 'SWseries_catalog_2025.pdf', '2025-10-14'),
  ('日東工業', '盤筐体', 'キャビネット総合カタログ', 'cabinet_catalog_2026.pdf', '2026-02-20'),
  ('パナソニック', '配線用遮断器', 'BJWシリーズ', 'BJW_catalog_image.png', '2025-08-05')
) as v(mfr_name, category, model, file_name, updated_at)
where not exists (select 1 from catalogs c where c.file_name = v.file_name);
