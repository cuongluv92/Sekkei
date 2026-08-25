-- oku-pro — 換気計算 (JSIA-T1016:2019「配電盤類の換気計算」準拠) の屋外
-- キュービクル設計用気象条件 (地域別の周囲温度to・上部温度tt・方位別相当
-- 外気温度・空気物性値) 社内選定マスタ。
--
-- JSIA-T1016 は「北海道から沖縄まで、設置地域別に算出できる」としているが、
-- 本アプリが直接参照できたのは同標準準拠の換気計算書 (JSIA HP 掲載の使用例)
-- に含まれる2地域 (東京・那覇) のみ。他の地域を計算する場合は JSIA-T1016
-- 原本または自社の設計基準にある値を確認のうえ、設定画面から追加登録する
-- こと (seismic_anchor_bolt_allowables 等と同じ社内選定マスタの方針)。

create table if not exists ventilation_climate_profiles (
  id uuid primary key default gen_random_uuid(),
  region text not null, -- 地域名 (例: 東京、那覇)
  ambient_temp_c numeric not null, -- 周囲温度 to (℃)
  top_temp_c numeric not null, -- 上部温度 tt (℃)
  equivalent_outside_temp_roof_c numeric not null, -- 相当外気温度 tSH (屋根/上面)
  equivalent_outside_temp_face1_c numeric not null, -- 相当外気温度 (側面1)
  equivalent_outside_temp_face2_c numeric not null, -- 相当外気温度 (側面2)
  equivalent_outside_temp_face3_c numeric not null, -- 相当外気温度 (側面3)
  equivalent_outside_temp_face4_c numeric not null, -- 相当外気温度 (側面4)
  air_specific_heat_kj_per_kg_k numeric not null, -- 空気の定圧比熱 CP
  air_density_kg_per_m3 numeric not null, -- 空気の密度 ρE
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table ventilation_climate_profiles enable row level security;
drop policy if exists anon_all on ventilation_climate_profiles;
create policy anon_all on ventilation_climate_profiles for all to anon using (true) with check (true);

-- 東京・那覇の2地域は、換気計算書 (JSIA-T1016:2019準拠、JSIA HP 掲載) の
-- 使用例からそのまま転記した検証済みの値 — 推測・捏造した値ではない。
insert into ventilation_climate_profiles (
  region, ambient_temp_c, top_temp_c,
  equivalent_outside_temp_roof_c, equivalent_outside_temp_face1_c,
  equivalent_outside_temp_face2_c, equivalent_outside_temp_face3_c, equivalent_outside_temp_face4_c,
  air_specific_heat_kj_per_kg_k, air_density_kg_per_m3, remarks, sort_order
) values
  ('東京', 31, 49, 11.9, 3.2, 7.6, 4.6, 3, 1.024, 1.146,
   '換気計算書 (JSIA-T1016:2019準拠) 使用例より転記 (50Hz地域の例)', 1),
  ('那覇', 32, 48, 13.4, 3.6, 5.8, 4.6, 3.5, 1.025, 1.141,
   '換気計算書 (JSIA-T1016:2019準拠) 使用例より転記 (60Hz地域の例)', 2)
on conflict do nothing;
