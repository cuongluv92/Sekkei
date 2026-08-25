-- oku-pro — 耐震計算 (JSIA-T1018:2012 準拠) のアンカーボルト許容引抜荷重
-- (Ta) 社内選定マスタ。
--
-- JSIA-T1018 自身も「本書では『建築センター指針』の値を採用する」とする
-- だけで、コンクリート強度・施工方法・埋込み長さで変わる汎用の Ta 値表は
-- 持たない (5.2節)。実在するアンカーボルト製品のカタログ値に依存する
-- データなので、weight_materials (0010)/busbar_sizes (0017) と同じ方針で
-- 空のまま作成し、設定画面から会社が実際に使う分だけ手入力する。

create table if not exists seismic_anchor_bolt_allowables (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references manufacturers(id) on delete cascade,
  method text not null, -- 施工方法 (例: 埋込式LA形アンカーボルト、あと施工金属拡張アンカーボルト)
  bolt_diameter text not null, -- M8〜M24
  concrete_thickness_mm numeric not null,
  allowable_pullout_kn numeric not null, -- Ta (kN)
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists seismic_anchor_bolt_allowables_lookup_idx
  on seismic_anchor_bolt_allowables(manufacturer_id, method, bolt_diameter, concrete_thickness_mm);

alter table seismic_anchor_bolt_allowables enable row level security;
drop policy if exists anon_all on seismic_anchor_bolt_allowables;
create policy anon_all on seismic_anchor_bolt_allowables for all to anon using (true) with check (true);
