-- OKU-pro — 選定 > TB（端子台）公式データ補正。
-- 東洋技研の日本国内公式製品情報（2026-09-04確認）だけを根拠に、
-- CT / PT の一般仕様（JIS電線サイズ側）を全機種へ揃える。
-- 社内基準(company)は一切削除・上書きしない。

alter table terminal_block_selections
  add column if not exists max_wire_label text;

-- 旧referenceは不完全な機種構成だったため、CT/PT referenceだけを再作成する。
delete from terminal_block_selections
where basis_kind = 'reference'
  and manufacturer = '東洋技研'
  and series in ('CT', 'PT');

-- CTシリーズ（レール取付型・セルフアップ式）。
-- 公式シリーズ: https://www.togi.co.jp/series/terminalblock/121/
insert into terminal_block_selections
  (basis_kind, manufacturer, series, model, rated_current_a, max_wire_mm2, max_wire_label,
   screw_size, voltage_label, source_title, source_url, remarks, sort_order)
values
  ('reference','東洋技研','CT','CT-10S',  15,  1.25,'1.25 mm²','M3',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/595/','一般仕様/JIS電線サイズの最大掲載値',10),
  ('reference','東洋技研','CT','CT-15',   15,  2,   '2 mm²',   'M3',  '600V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/609/','一般仕様/JIS電線サイズの最大掲載値',20),
  ('reference','東洋技研','CT','CT-15R',  15,  2,   '2 mm²',   'M3.5','250V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/597/','ラッピング側を持つ機種。一般仕様/JIS電線サイズの最大掲載値',30),
  ('reference','東洋技研','CT','CT-15S',  20,  2,   '2 mm²',   'M3.5','660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/jp/product/terminalblock/596/','一般仕様/JIS電線サイズの最大掲載値',40),
  ('reference','東洋技研','CT','CT-30',   30,  5.5, '5.5 mm²', 'M4',  '600V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/series/terminalblock/121/','一般仕様/JIS電線サイズの最大掲載値',50),
  ('reference','東洋技研','CT','CT-25S',  40,  5.5, '5.5 mm²', 'M4',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/598/','一般仕様/JIS電線サイズの最大掲載値',60),
  ('reference','東洋技研','CT','CT-35S',  50,  8,   '8 mm²',   'M5',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/599/','一般仕様/JIS電線サイズの最大掲載値',70),
  ('reference','東洋技研','CT','CT-65S',  90,  22,  '22 mm²',  'M6',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/600/','一般仕様/JIS電線サイズの最大掲載値',80),
  ('reference','東洋技研','CT','CT-100', 132,  60,  '60 mm²',  'M8',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/601/','一般仕様/JIS電線サイズの最大掲載値',90),
  ('reference','東洋技研','CT','CT-150', 175,  60,  '60 mm²',  'M8',  '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/602/','一般仕様/JIS電線サイズの最大掲載値',100),
  ('reference','東洋技研','CT','CT-200', 240, 100,  '100 mm²', 'M10', '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/603/','一般仕様/JIS電線サイズの最大掲載値',110),
  ('reference','東洋技研','CT','CT-300', 310, 150,  '150 mm²', 'M10', '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/series/terminalblock/121/','一般仕様/JIS電線サイズの最大掲載値',120),
  ('reference','東洋技研','CT','CT-400', 400, 200,  '200 mm²', 'M12', '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/series/terminalblock/121/','一般仕様/JIS電線サイズの最大掲載値',130),
  ('reference','東洋技研','CT','CT-600', 600, 325,  '325 mm²', 'M16', '660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/series/terminalblock/121/','一般仕様/JIS電線サイズの最大掲載値',140),
  ('reference','東洋技研','CT','CT-800', 800, 200,  '200 mm² × 2','M16','660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/607/','一般仕様では200 mm²を2本で800A',150),
  ('reference','東洋技研','CT','CT-1000',1000,325, '325 mm² × 2','M16','660V','東洋技研 CTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/629/','一般仕様では325 mm²を2本で1000A',160);

-- PTシリーズ（DIN35mmレール・セルフアップ式）。
-- 公式シリーズ: https://www.togi.co.jp/series/terminalblock/119/
insert into terminal_block_selections
  (basis_kind, manufacturer, series, model, rated_current_a, max_wire_mm2, max_wire_label,
   screw_size, voltage_label, source_title, source_url, remarks, sort_order)
values
  ('reference','東洋技研','PT','PT-10',   16,  1.25,'1.25 mm²','M3',  '800V', '東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/3789/','一般仕様/JIS電線サイズの最大掲載値',210),
  ('reference','東洋技研','PT','PT-20',   22,  2,   '2 mm²',   'M3.5','800V', '東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/583/','一般仕様/JIS電線サイズの最大掲載値',220),
  ('reference','東洋技研','PT','PT-20H',  22,  2,   '2 mm²',   'M3.5','800V', '東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/3794/','一般仕様/JIS電線サイズの最大掲載値',230),
  ('reference','東洋技研','PT','PT-30',   30,  3.5, '3.5 mm²', 'M4',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/584/','一般仕様/JIS電線サイズの最大掲載値',240),
  ('reference','東洋技研','PT','PT-40',   40,  5.5, '5.5 mm²', 'M4',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/585/','一般仕様/JIS電線サイズの最大掲載値',250),
  ('reference','東洋技研','PT','PT-50',   50,  8,   '8 mm²',   'M5',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/jp/product/terminalblock/3795/','一般仕様/JIS電線サイズの最大掲載値',260),
  ('reference','東洋技研','PT','PT-80',   75, 14,   '14 mm²',  'M5',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/586/','一般仕様/JIS電線サイズの最大掲載値',270),
  ('reference','東洋技研','PT','PT-90',   95, 22,   '22 mm²',  'M6',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/jp/product/terminalblock/587/','一般仕様/JIS電線サイズの最大掲載値',280),
  ('reference','東洋技研','PT','PT-100', 132, 60,   '60 mm²',  'M8',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/3796/','一般仕様/JIS電線サイズの最大掲載値',290),
  ('reference','東洋技研','PT','PT-150', 175, 60,   '60 mm²',  'M8',  '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/588/','一般仕様/JIS電線サイズの最大掲載値',300),
  ('reference','東洋技研','PT','PT-200', 240,100,   '100 mm²', 'M10', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/589/','一般仕様/JIS電線サイズの最大掲載値',310),
  ('reference','東洋技研','PT','PT-300', 310,150,   '150 mm²', 'M10', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/590/','一般仕様/JIS電線サイズの最大掲載値',320),
  ('reference','東洋技研','PT','PT-400', 400,200,   '200 mm²', 'M12', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/591/','一般仕様/JIS電線サイズの最大掲載値',330),
  ('reference','東洋技研','PT','PT-600', 600,325,   '325 mm²', 'M16', '1000V','東洋技研 PTシリーズ 公式製品情報','https://www.togi.co.jp/product/terminalblock/592/','一般仕様/JIS電線サイズの最大掲載値',340);
