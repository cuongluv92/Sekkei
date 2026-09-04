-- OKU-pro — 選定 > kW基準の電動機分岐選定。
-- 三菱電機・富士電機の公開一次資料を「参考基準」、会社入力を「社内基準」として分離する。
-- 数値や型式を資料で直接確認できない欄は空欄のままにし、推測で埋めない。
-- 特にMCCB/NVは必要遮断容量(Icu/Ics)で型式・定格が変わるため、固定の1機種に決め打ちしない。

create table if not exists motor_kw_selection_rows (
  id uuid primary key default gen_random_uuid(),
  basis_kind text not null check (basis_kind in ('mitsubishi','fuji','company')),
  manufacturer_id uuid references manufacturers(id) on delete set null,
  phase text not null default 'three' check (phase in ('single','three')),
  voltage_class text not null check (voltage_class in ('100V','200V','400V')),
  start_method text not null check (start_method in ('direct','starDelta','inverter')),
  motor_kw numeric not null check (motor_kw > 0),
  rated_current_a numeric,
  starting_current_a numeric,
  breaker_model text,
  breaker_rated_a numeric,
  breaker_condition text,
  contactor_model text,
  thermal_model text,
  thermal_setting_a numeric,
  inverter_model text,
  wire_size text,
  ct_model text,
  am_range text,
  naisen_basis text,
  jis_basis text,
  association_basis text,
  source_id uuid references selection_sources(id) on delete set null,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motor_kw_selection_lookup_idx
  on motor_kw_selection_rows(phase, voltage_class, start_method, motor_kw, basis_kind, sort_order);

create unique index if not exists motor_kw_selection_reference_identity_idx
  on motor_kw_selection_rows(basis_kind, phase, voltage_class, start_method, motor_kw)
  where basis_kind in ('mitsubishi','fuji');

alter table motor_kw_selection_rows enable row level security;
drop policy if exists anon_all on motor_kw_selection_rows;
create policy anon_all on motor_kw_selection_rows for all to anon using (true) with check (true);

-- ===== 根拠資料 =====
insert into selection_sources (manufacturer_id,title,url,document_no,published_label,verified_at,remarks)
select m.id,
  '三菱 WS-V 低圧遮断器総合カタログ 24B版',
  'https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/lvcb/yn-c-0701/y0701y2412.pdf',
  '表4-13 / 表4-14', '24B版', date '2026-09-04',
  'AC200/220V・AC400/440V 三相誘導電動機用。遮断器は必要遮断容量(Icu)別に選定が変わる。'
from manufacturers m where m.name='三菱電機'
and not exists (select 1 from selection_sources where title='三菱 WS-V 低圧遮断器総合カタログ 24B版');

insert into selection_sources (manufacturer_id,title,url,document_no,published_label,verified_at,remarks)
select m.id,
  '三菱 FREQROL-E800 カタログ',
  'https://www.mitsubishielectric.co.jp/fa/document/catalog/inv/l-06130/l060130j.pdf',
  'L(名)06130', '2025版', date '2026-09-04',
  'FR-E820(三相200V) / FR-E840(三相400V) の容量系列。実設備では負荷特性・過負荷定格・周辺機器条件も確認する。'
from manufacturers m where m.name='三菱電機'
and not exists (select 1 from selection_sources where title='三菱 FREQROL-E800 カタログ');

insert into selection_sources (manufacturer_id,title,url,document_no,published_label,verified_at,remarks)
select m.id,
  '富士 モータスタータ選定アプリ MSスケール SC-NEXT',
  'https://f-net.fujielectric.co.jp/Catalog/FCS_appli/MSScale_SC-NEXT/MSScale_SC-NEXT.html',
  'MSScale SC-NEXT', 'V20250331', date '2026-09-04',
  '現行SC-NEXT。三相200V/400Vの直入・スターデルタ。JIS C 8201-1 表9A、内線規程3705-1表/3表等の適用条件を明記。'
from manufacturers m where m.name='富士電機'
and not exists (select 1 from selection_sources where title='富士 モータスタータ選定アプリ MSスケール SC-NEXT');

insert into selection_sources (manufacturer_id,title,url,document_no,published_label,verified_at,remarks)
select m.id,
  '富士 IE3 電動機分岐回路 直入始動10秒選定表',
  'https://www.fujielectric.co.jp/fcs/pdf/news/forIE3_general_breaker-10_20151221.pdf',
  'IE3用選定表', '2015-12-21', date '2026-09-04',
  '旧公式選定表。定格/始動電流の参考として保持。旧SC/NeoSC器具型式は現行SC-NEXTへの置換確認が必要。'
from manufacturers m where m.name='富士電機'
and not exists (select 1 from selection_sources where title='富士 IE3 電動機分岐回路 直入始動10秒選定表');

insert into selection_sources (manufacturer_id,title,url,document_no,published_label,verified_at,remarks)
select m.id,
  '富士 FRENIC-Ace(E2) 形式一覧',
  'https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-ace_specification.html',
  'FRENIC-Ace E2', '現行Web仕様', date '2026-09-04',
  'HHD仕様の標準適用モータ容量に対応する形式。用途・過負荷定格・周辺機器は個別条件で再確認する。'
from manufacturers m where m.name='富士電機'
and not exists (select 1 from selection_sources where title='富士 FRENIC-Ace(E2) 形式一覧');

-- 規程・規格のトレーサビリティ。これらは機器型式を直接決める表ではない。
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select '内線規程 第14版','https://store.denki.or.jp/products/%E5%86%85%E7%B7%9A%E8%A6%8F%E7%A8%8B-%E7%AC%AC14%E7%89%88','JEAC8001-2022','2022-12-25',date '2026-09-04','低圧電動機分岐の配線設計条件を確認するための国内規程。'
where not exists (select 1 from selection_sources where title='内線規程 第14版');
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select 'JIS C 8201-1:2024','https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+8201-1%3A2024','JIS C 8201-1:2024','有効',date '2026-09-04','低圧開閉装置及び制御装置 通則。'
where not exists (select 1 from selection_sources where title='JIS C 8201-1:2024');
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select 'JIS C 8201-2-1:2021','https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+8201-2-1%3A2021','JIS C 8201-2-1:2021','有効',date '2026-09-04','配線用遮断器及びその他の回路遮断器。'
where not exists (select 1 from selection_sources where title='JIS C 8201-2-1:2021');
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select 'JIS C 8201-4-1:2023','https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+8201-4-1%3A2023','JIS C 8201-4-1:2023','有効',date '2026-09-04','電気機械式接触器及びモータスタータ。'
where not exists (select 1 from selection_sources where title='JIS C 8201-4-1:2023');
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select 'JSIA 210:2020','https://www.jsia.or.jp/wp-content/uploads/jsia_admin/media/2023/02/JSIA-210-2020.03-%E9%96%8B%E6%94%BE%E5%BD%A2%E9%AB%98%E5%9C%A7%E5%8F%97%E9%9B%BB%E8%A8%AD%E5%82%99Rev1.pdf','JSIA 210:2020','2020',date '2026-09-04','開放形高圧受電設備の規格。引用規格として遮断器JIS C 8201-2-1、交流電磁開閉器JIS C 8201-4-1等を確認できる。'
where not exists (select 1 from selection_sources where title='JSIA 210:2020');
insert into selection_sources (title,url,document_no,published_label,verified_at,remarks)
select 'JEM 1195:2018','https://www.jema-net.or.jp/engineering/JEM_JEM-TR/JEM1195.html','JEM 1195:2018','2026-02-20確認',date '2026-09-04','現行確認で電磁接触器の引用規格を旧JEM1038からJIS C 8201-4-1へ変更済み。'
where not exists (select 1 from selection_sources where title='JEM 1195:2018');

-- ===== 三菱：直入れ 200V (WS-V 24B 表4-13) =====
with src as (select id from selection_sources where title='三菱 WS-V 低圧遮断器総合カタログ 24B版' limit 1),
     maker as (select id from manufacturers where name='三菱電機' limit 1),
     d(kw,amps,ms,heater,ord) as (values
       (0.75::numeric,3.6::numeric,'T10～T21',3.6::numeric,10),(1.5,6.4,'T10～T25',6.6,20),
       (2.2,9.4,'T10～T35',9,30),(3.7,15,'T20～T35',15,40),(5.5,22.3,'T25～T65',22,50),
       (7.5,29.1,'T35～T80',29,60),(11,41.6,'T50～T100',42,70),(15,57.1,'T65・T100・N125',54,80),
       (18.5,68.2,'T80・T100・N125',67,90),(22,81.4,'T100・N125・N150',82,100),
       (30,110,'N125～N220',105,110),(37,136,'N150～N220',125,120),(45,167,'N180～N400',150,130),(55,202,'N220～N400',180,140)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,rated_current_a,breaker_model,breaker_condition,contactor_model,thermal_setting_a,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'mitsubishi',maker.id,'three','200V','direct',d.kw,d.amps,'WS-V（Icu選択後）','必要遮断容量(Icu sym)により型式・定格が変わるため固定しない',d.ms,d.heater,
       'JEAC8001-2022：配線条件は設備条件に合わせ別途確認','MCCB: JIS C 8201-2-1 / MS: JIS C 8201-4-1','JSIA 210:2020の関連引用規格 / JEM1195:2018',src.id,
       '4極AC200/220V三相誘導電動機。メーカー表の全負荷電流・MS適用形名・ヒータ称呼。',d.ord
from d cross join src cross join maker on conflict do nothing;

-- ===== 三菱：直入れ 400V (WS-V 24B 表4-14) =====
with src as (select id from selection_sources where title='三菱 WS-V 低圧遮断器総合カタログ 24B版' limit 1),
     maker as (select id from manufacturers where name='三菱電機' limit 1),
     d(kw,amps,ms,heater,ord) as (values
       (0.75::numeric,1.8::numeric,'T10～T21',1.7::numeric,210),(1.5,3.2,'T10～T21',3.6,220),
       (2.2,4.7,'T10～T21',5,230),(3.7,7.5,'T12～T35',6.6,240),(5.5,11.2,'T20～T25',11,250),
       (7.5,14.6,'T20～T50',15,260),(11,20.8,'T25～T65',22,270),(15,28.6,'T35～T80',29,280),
       (18.5,34.1,'T50～T100',35,290),(22,40.7,'T50～T100',42,300),(30,55,'T65～T100・N125',54,310),
       (37,68,'T80・T100・N125・N150',67,320),(45,83.5,'T100・N125・N150',82,330),(55,101,'N125～N220',105,340)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,rated_current_a,breaker_model,breaker_condition,contactor_model,thermal_setting_a,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'mitsubishi',maker.id,'three','400V','direct',d.kw,d.amps,'WS-V（Icu選択後）','必要遮断容量(Icu sym)により型式・定格が変わるため固定しない',d.ms,d.heater,
       'JEAC8001-2022：配線条件は設備条件に合わせ別途確認','MCCB: JIS C 8201-2-1 / MS: JIS C 8201-4-1','JSIA 210:2020の関連引用規格 / JEM1195:2018',src.id,
       '4極AC400/440V三相誘導電動機。メーカー表の全負荷電流・MS適用形名・ヒータ称呼。',d.ord
from d cross join src cross join maker on conflict do nothing;

-- ===== 三菱：スター・デルタ参考 =====
-- 同じメーカー表のY-Δ欄を根拠に、全負荷電流だけを登録する。
-- 接触器構成/OLR設定は取付位置・始動条件で変わるため直入値を流用しない。
with src as (select id from selection_sources where title='三菱 WS-V 低圧遮断器総合カタログ 24B版' limit 1),
     maker as (select id from manufacturers where name='三菱電機' limit 1),
     d(voltage,kw,amps,ord) as (values
       ('200V',5.5::numeric,22.3::numeric,410),('200V',7.5,29.1,420),('200V',11,41.6,430),('200V',15,57.1,440),('200V',18.5,68.2,450),('200V',22,81.4,460),('200V',30,110,470),('200V',37,136,480),('200V',45,167,490),('200V',55,202,500),
       ('400V',5.5,11.2,510),('400V',7.5,14.6,520),('400V',11,20.8,530),('400V',15,28.6,540),('400V',18.5,34.1,550),('400V',22,40.7,560),('400V',30,55,570),('400V',37,68,580),('400V',45,83.5,590),('400V',55,101,600)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,rated_current_a,breaker_model,breaker_condition,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'mitsubishi',maker.id,'three',d.voltage,'starDelta',d.kw,d.amps,'WS-V（Icu・始動条件選択後）','Y-Δ始動欄。Icuと始動条件で遮断器選定が変わる',
       'JEAC8001-2022：Y-Δ配線条件を確認','MCCB: JIS C 8201-2-1 / 接触器: JIS C 8201-4-1','JEM1195:2018では接触器規格をJIS C 8201-4-1へ更新',src.id,
       '接触器3台・OLRの具体構成はこの行では自動推定しない。',d.ord
from d cross join src cross join maker on conflict do nothing;

-- ===== 三菱：インバータ FREQROL-E800 =====
with src as (select id from selection_sources where title='三菱 FREQROL-E800 カタログ' limit 1),
     maker as (select id from manufacturers where name='三菱電機' limit 1),
     d(voltage,kw,model,ord) as (values
       ('200V',0.1::numeric,'FR-E820-0.1K',710),('200V',0.2,'FR-E820-0.2K',720),('200V',0.4,'FR-E820-0.4K',730),('200V',0.75,'FR-E820-0.75K',740),('200V',1.5,'FR-E820-1.5K',750),('200V',2.2,'FR-E820-2.2K',760),('200V',3.7,'FR-E820-3.7K',770),('200V',5.5,'FR-E820-5.5K',780),('200V',7.5,'FR-E820-7.5K',790),('200V',11,'FR-E820-11K',800),('200V',15,'FR-E820-15K',810),('200V',18.5,'FR-E820-18.5K',820),('200V',22,'FR-E820-22K',830),
       ('400V',0.4,'FR-E840-0.4K',840),('400V',0.75,'FR-E840-0.75K',850),('400V',1.5,'FR-E840-1.5K',860),('400V',2.2,'FR-E840-2.2K',870),('400V',3.7,'FR-E840-3.7K',880),('400V',5.5,'FR-E840-5.5K',890),('400V',7.5,'FR-E840-7.5K',900),('400V',11,'FR-E840-11K',910),('400V',15,'FR-E840-15K',920),('400V',18.5,'FR-E840-18.5K',930),('400V',22,'FR-E840-22K',940)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,inverter_model,breaker_condition,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'mitsubishi',maker.id,'three',d.voltage,'inverter',d.kw,d.model,'入力側MCCB/MC・リアクトル・配線は電源容量/条件によりカタログ選定',
       'JEAC8001-2022：入力/出力配線条件を設備条件に合わせ確認','周辺開閉器はJIS C 8201系列の該当規格を確認','メーカー現行カタログを優先',src.id,
       '標準容量系列。負荷特性、過負荷定格、加減速、周囲温度等を別途確認。',d.ord
from d cross join src cross join maker on conflict do nothing;

-- ===== 富士：直入れ参考 (2015公式IE3 10秒選定表) =====
-- 現行SC-NEXTの器具型式はMSScaleで再確認するため、旧SC/NeoSC型式を自動結果には入れない。
with src as (select id from selection_sources where title='富士 IE3 電動機分岐回路 直入始動10秒選定表' limit 1),
     maker as (select id from manufacturers where name='富士電機' limit 1),
     d(voltage,kw,amps,startamps,ord) as (values
       ('200V',0.75::numeric,3.5::numeric,23::numeric,2010),('200V',1.5,6.9,56,2020),('200V',2.2,9.5,77,2030),('200V',3.7,15.5,139,2040),('200V',5.5,21,203,2050),('200V',7.5,27.5,258,2060),('200V',11,40,380,2070),('200V',15,54,516,2080),('200V',18.5,67,548,2090),('200V',22,79,670,2100),('200V',30,107,921,2110),('200V',37,137,1170,2120),('200V',45,166,1380,2130),('200V',55,200,1670,2140),
       ('400V',0.75,1.8,11.5,2210),('400V',1.5,3.5,28,2220),('400V',2.2,4.8,39,2230),('400V',3.7,7.8,70,2240),('400V',5.5,10.5,102,2250),('400V',7.5,13.5,129,2260),('400V',11,20,190,2270),('400V',15,27,258,2280),('400V',18.5,34,274,2290),('400V',22,40,335,2300),('400V',30,54,461,2310),('400V',37,69,585,2320),('400V',45,83,690,2330),('400V',55,100,835,2340)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,rated_current_a,starting_current_a,breaker_model,breaker_condition,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'fuji',maker.id,'three',d.voltage,'direct',d.kw,d.amps,d.startamps,'G-TWIN（短絡容量選択後）','2015 IE3 10秒表。短絡容量別にMCCB形式/定格が変わる。現行器具はMSScale SC-NEXTで再確認',
       '現行MSScale: 内線規程3705-1表・3表を下回らないことを確認','現行MSScale: JIS C 8201-1 表9A / MCCB JIS C 8201-2-1 / MS JIS C 8201-4-1','JEM1195:2018で現行接触器規格JIS C 8201-4-1を確認',src.id,
       '定格/始動電流は富士公式2015 IE3表。旧SC/NeoSC型式は表示せず、現行SC-NEXTアプリで再選定する。',d.ord
from d cross join src cross join maker on conflict do nothing;

-- ===== 富士：インバータ FRENIC-Ace(E2) HHD標準容量 =====
with src as (select id from selection_sources where title='富士 FRENIC-Ace(E2) 形式一覧' limit 1),
     maker as (select id from manufacturers where name='富士電機' limit 1),
     d(voltage,kw,model,ord) as (values
       ('200V',0.1::numeric,'FRN0.1E2S-2J',3010),('200V',0.2,'FRN0.2E2S-2J',3020),('200V',0.4,'FRN0.4E2S-2J',3030),('200V',0.75,'FRN0.75E2S-2J',3040),('200V',1.5,'FRN1.5E2S-2J',3050),('200V',2.2,'FRN2.2E2S-2J',3060),('200V',3.7,'FRN3.7E2S-2J',3070),('200V',5.5,'FRN5.5E2S-2J',3080),('200V',7.5,'FRN7.5E2S-2J',3090),('200V',11,'FRN11E2S-2J',3100),('200V',15,'FRN15E2S-2J',3110),('200V',18.5,'FRN18.5E2S-2J',3120),('200V',22,'FRN22E2S-2J',3130),
       ('400V',0.4,'FRN0.4E2S-4J',3140),('400V',0.75,'FRN0.75E2S-4J',3150),('400V',1.5,'FRN1.5E2S-4J',3160),('400V',2.2,'FRN2.2E2S-4J',3170),('400V',3.7,'FRN3.7E2S-4J',3180),('400V',5.5,'FRN5.5E2S-4J',3190),('400V',7.5,'FRN7.5E2S-4J',3200),('400V',11,'FRN11E2S-4J',3210),('400V',15,'FRN15E2S-4J',3220),('400V',18.5,'FRN18.5E2S-4J',3230),('400V',22,'FRN22E2S-4J',3240)
     )
insert into motor_kw_selection_rows
(basis_kind,manufacturer_id,phase,voltage_class,start_method,motor_kw,inverter_model,breaker_condition,naisen_basis,jis_basis,association_basis,source_id,remarks,sort_order)
select 'fuji',maker.id,'three',d.voltage,'inverter',d.kw,d.model,'入力MCCB/ELCB・MC・DCR有無で選定が変わるため周辺機器を固定しない',
       'JEAC8001-2022：配線条件は実設備条件で確認','周辺開閉器はJIS C 8201系列の該当規格を確認','メーカー現行仕様を優先',src.id,
       'HHD仕様の標準適用モータ容量。負荷特性・過負荷定格・周囲温度等を確認。',d.ord
from d cross join src cross join maker on conflict do nothing;
