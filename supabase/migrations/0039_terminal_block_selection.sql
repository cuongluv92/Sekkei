-- OKU-pro — 選定 > TB（端子台）選定
-- 東洋技研 ATシリーズの公開カタログ値を reference として保持し、
-- 会社採用値は company として別管理する。

create table if not exists terminal_block_selections (
  id uuid primary key default gen_random_uuid(),
  basis_kind text not null check (basis_kind in ('reference', 'company')),
  manufacturer text not null default '東洋技研',
  series text not null default 'AT',
  model text not null,
  rated_current_a numeric not null check (rated_current_a > 0),
  max_wire_mm2 numeric not null check (max_wire_mm2 > 0),
  screw_size text not null,
  voltage_label text,
  source_title text,
  source_url text,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (basis_kind, manufacturer, series, model)
);

create index if not exists terminal_block_selections_lookup_idx
  on terminal_block_selections(basis_kind, rated_current_a, sort_order);

alter table terminal_block_selections enable row level security;
drop policy if exists anon_all on terminal_block_selections;
create policy anon_all on terminal_block_selections
  for all to anon using (true) with check (true);

-- 東洋技研 ATシリーズ 公式カタログ（JIS側の最大適合電線/最大定格電流）
-- https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf
insert into terminal_block_selections
  (basis_kind, manufacturer, series, model, rated_current_a, max_wire_mm2, screw_size, voltage_label, source_title, source_url, remarks, sort_order)
values
  ('reference','東洋技研','AT','AT-10', 20, 2,   'M3.5','600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',10),
  ('reference','東洋技研','AT','AT-15L',30,3.5, 'M4',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',20),
  ('reference','東洋技研','AT','AT-20', 40,5.5, 'M4',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',30),
  ('reference','東洋技研','AT','AT-30', 50,8,   'M5',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',40),
  ('reference','東洋技研','AT','AT-60', 90,22,  'M6',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',50),
  ('reference','東洋技研','AT','AT-100',130,38, 'M8',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',60),
  ('reference','東洋技研','AT','AT-150',160,60, 'M8',  '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',70),
  ('reference','東洋技研','AT','AT-200',200,100,'M10', '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',80),
  ('reference','東洋技研','AT','AT-300',300,150,'M10', '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',90),
  ('reference','東洋技研','AT','AT-400',400,200,'M12', '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',100),
  ('reference','東洋技研','AT','AT-500',500,250,'M16', '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',110),
  ('reference','東洋技研','AT','AT-600',600,325,'M16', '600V','東洋技研 ATシリーズ 公式カタログ','https://www.togi.co.jp/pdf_file/terminalblock/series/AT-Series.pdf','接続可能電線の最大値を表示',120)
on conflict (basis_kind, manufacturer, series, model) do update set
  rated_current_a = excluded.rated_current_a,
  max_wire_mm2 = excluded.max_wire_mm2,
  screw_size = excluded.screw_size,
  voltage_label = excluded.voltage_label,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  remarks = excluded.remarks,
  sort_order = excluded.sort_order;
