-- OKU-pro — 選定 > TB（端子台）
-- ユーザー指定により東洋技研の CT / PT シリーズのみを参考選定対象とする。
-- 参考値は東洋技研の日本国内公式製品ページ・公式カタログに掲載された一般仕様のみ。
-- 既存の社内基準(company)は削除せず保持する。

-- 旧AT参考値は選定対象外のため reference のみ削除。
delete from terminal_block_selections
where basis_kind = 'reference'
  and series not in ('CT', 'PT');

-- CTシリーズ（東洋技研公式・一般仕様/JIS欄）
insert into terminal_block_selections
  (basis_kind, manufacturer, series, model, rated_current_a, max_wire_mm2, screw_size, voltage_label, source_title, source_url, remarks, sort_order)
values
  ('reference','東洋技研','CT','CT-15',  15,  2,   'M3',   '600V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/609/','一般仕様（JIS電線サイズ）',10),
  ('reference','東洋技研','CT','CT-30',  30,  5.5, 'M4',   '600V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/610/','一般仕様（JIS電線サイズ）',20),
  ('reference','東洋技研','CT','CT-100',132, 60,  'M8',   '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/601/','一般仕様の最大JIS電線サイズ時',30),
  ('reference','東洋技研','CT','CT-150',175, 60,  'M8',   '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/602/','一般仕様の最大JIS電線サイズ時',40),
  ('reference','東洋技研','CT','CT-200',240,100,  'M10',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/603/','一般仕様の最大JIS電線サイズ時',50),
  ('reference','東洋技研','CT','CT-300',310,150,  'M10',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/604/','一般仕様の最大JIS電線サイズ時',60),
  ('reference','東洋技研','CT','CT-400',400,200,  'M12',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/626/','一般仕様の最大JIS電線サイズ時',70),
  ('reference','東洋技研','CT','CT-600',600,325,  'M16',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/794/','一般仕様の最大JIS電線サイズ時',80)
on conflict (basis_kind, manufacturer, series, model) do update set
  rated_current_a = excluded.rated_current_a,
  max_wire_mm2 = excluded.max_wire_mm2,
  screw_size = excluded.screw_size,
  voltage_label = excluded.voltage_label,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  remarks = excluded.remarks,
  sort_order = excluded.sort_order;

-- PTシリーズ（東洋技研公式・一般仕様/JIS欄）
insert into terminal_block_selections
  (basis_kind, manufacturer, series, model, rated_current_a, max_wire_mm2, screw_size, voltage_label, source_title, source_url, remarks, sort_order)
values
  ('reference','東洋技研','PT','PT-20',  22,  2,   'M3.5','800V', '東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/583/','一般仕様（JIS電線サイズ）',110),
  ('reference','東洋技研','PT','PT-30',  30,  3.5, 'M4',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/584/','一般仕様（JIS電線サイズ）',120),
  ('reference','東洋技研','PT','PT-40',  40,  5.5, 'M4',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/585/','一般仕様（JIS電線サイズ）',130),
  ('reference','東洋技研','PT','PT-80',  75, 14,   'M5',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/586/','一般仕様の最大JIS電線サイズ時',140),
  ('reference','東洋技研','PT','PT-150',175, 60,   'M8',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/588/','一般仕様の最大JIS電線サイズ時',150),
  ('reference','東洋技研','PT','PT-200',240,100,   'M10', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/589/','一般仕様の最大JIS電線サイズ時',160),
  ('reference','東洋技研','PT','PT-300',310,150,   'M10', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/590/','一般仕様の最大JIS電線サイズ時',170),
  ('reference','東洋技研','PT','PT-400',400,200,   'M12', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/591/','一般仕様の最大JIS電線サイズ時',180),
  ('reference','東洋技研','PT','PT-600',600,325,   'M16', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/592/','一般仕様の最大JIS電線サイズ時',190)
on conflict (basis_kind, manufacturer, series, model) do update set
  rated_current_a = excluded.rated_current_a,
  max_wire_mm2 = excluded.max_wire_mm2,
  screw_size = excluded.screw_size,
  voltage_label = excluded.voltage_label,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  remarks = excluded.remarks,
  sort_order = excluded.sort_order;
