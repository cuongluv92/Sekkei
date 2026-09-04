-- oku-pro — 選定 > 電線・銅帯選定。
-- A入力から、公開根拠付きの参考基準と会社が手入力する社内基準を並べて表示する。
-- 0037 の selection_sources を根拠管理に再利用し、既存の main_breaker_selections は削除しない。

create table if not exists wire_conductor_selection_rows (
  id uuid primary key default gen_random_uuid(),
  basis_kind text not null check (basis_kind in ('reference', 'company')),
  item_kind text not null check (item_kind in ('wire', 'busbar')),
  wire_type text,
  current_a numeric not null check (current_a > 0),
  result_value text not null,
  source_id uuid references selection_sources(id) on delete set null,
  condition_label text,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((item_kind = 'wire' and wire_type is not null) or (item_kind = 'busbar'))
);

create index if not exists wire_conductor_selection_lookup_idx
  on wire_conductor_selection_rows(basis_kind, item_kind, wire_type, current_a, sort_order);

create unique index if not exists wire_conductor_selection_identity_idx
  on wire_conductor_selection_rows(
    basis_kind,
    item_kind,
    coalesce(wire_type, ''),
    current_a,
    result_value
  );

alter table wire_conductor_selection_rows enable row level security;
drop policy if exists anon_all on wire_conductor_selection_rows;
create policy anon_all on wire_conductor_selection_rows for all to anon using (true) with check (true);

-- 参考元。JIS C 3307 は IV の製品規格だが、許容電流値そのものは布設条件等で変わる。
-- そのため IV の参考値は SWCC 技術資料「IV 許容電流 内線規程より」の条件を明記して使う。
insert into selection_sources (title, url, document_no, verified_at, remarks)
select
  'IV 許容電流（内線規程より / SWCC技術資料）',
  'https://www.swcc.co.jp/jpn/products/tec_information/pdf/kyoyou.pdf',
  'IV 許容電流',
  date '2026-09-04',
  'JIS C 3307適合のIV。許容電流は布設条件・周囲温度で変わるため、下記行はSWCC資料の明示条件に限定する。'
where not exists (
  select 1 from selection_sources where title = 'IV 許容電流（内線規程より / SWCC技術資料）'
);

insert into selection_sources (title, url, document_no, verified_at, remarks)
select
  'WL1系 600V EM-LMFC 許容電流（古河電工）',
  'https://www.furukawa.co.jp/product/catalogue/pdf/em-lmfc_d308.pdf',
  '600V EM-LMFC 許容電流表',
  date '2026-09-04',
  'WL1系の参考として古河電工EM-LMFCを使用。メーカー・製品・布設条件により許容電流は異なるため万能値として扱わない。'
where not exists (
  select 1 from selection_sources where title = 'WL1系 600V EM-LMFC 許容電流（古河電工）'
);

-- IV より線: 周囲温度30℃、同一の管・線ぴ・ダクト内に収める電線数3以下。
with src as (
  select id from selection_sources
  where title = 'IV 許容電流（内線規程より / SWCC技術資料）'
  order by created_at asc limit 1
), data(current_a, result_value, sort_order) as (
  values
    (18::numeric, '2 mm²', 10),
    (25, '3.5 mm²', 20),
    (34, '5.5 mm²', 30),
    (42, '8 mm²', 40),
    (61, '14 mm²', 50),
    (80, '22 mm²', 60),
    (113, '38 mm²', 70),
    (152, '60 mm²', 80),
    (208, '100 mm²', 90),
    (276, '150 mm²', 100),
    (328, '200 mm²', 110),
    (389, '250 mm²', 120),
    (455, '325 mm²', 130),
    (521, '400 mm²', 140),
    (589, '500 mm²', 150)
)
insert into wire_conductor_selection_rows (
  basis_kind, item_kind, wire_type, current_a, result_value, source_id, condition_label, sort_order
)
select
  'reference', 'wire', 'IV', d.current_a, d.result_value, src.id,
  '周囲温度30℃・より線・同一の管/線ぴ/ダクト内の電線数3以下', d.sort_order
from data d cross join src
on conflict do nothing;

-- WL1系参考: 古河電工 600V EM-LMFC、周囲温度40℃、導体温度110℃の許容電流。
with src as (
  select id from selection_sources
  where title = 'WL1系 600V EM-LMFC 許容電流（古河電工）'
  order by created_at asc limit 1
), data(current_a, result_value, sort_order) as (
  values
    (41::numeric, '2 mm²', 10),
    (56, '3.5 mm²', 20),
    (75, '5.5 mm²', 30),
    (93, '8 mm²', 40),
    (134, '14 mm²', 50),
    (175, '22 mm²', 60),
    (247, '38 mm²', 70),
    (331, '60 mm²', 80),
    (455, '100 mm²', 90),
    (604, '150 mm²', 100),
    (717, '200 mm²', 110),
    (850, '250 mm²', 120),
    (994, '325 mm²', 130)
)
insert into wire_conductor_selection_rows (
  basis_kind, item_kind, wire_type, current_a, result_value, source_id, condition_label, sort_order
)
select
  'reference', 'wire', 'WL1', d.current_a, d.result_value, src.id,
  '古河電工 600V EM-LMFC・周囲温度40℃・導体温度110℃（WL1系参考）', d.sort_order
from data d cross join src
on conflict do nothing;

-- 銅帯は会社採用寸法や設計条件の影響が大きいため、推測値をseedしない。
-- 社内基準(IV/WL1/銅帯)は設定画面から必要な行だけ手入力する。
