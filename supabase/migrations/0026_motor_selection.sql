-- oku-pro — 選定 (低圧電動機回路 選定): motor_starter_selections /
-- main_breaker_selections
--
-- 選定 ページの新しいフロー: kW または A を入力するだけで、直入れ／スター
-- デルタ／インバーターの各回路方式・AC100V/200V/400V の各電圧クラス・
-- メーカー(三菱電機/富士電機からまず対応)ごとに、ブレーカー→CT→AM→電磁
-- 開閉器・電磁接触器(またはインバーター)→電線サイズ の組み合わせを一括で
-- 選定する。
--
-- これは会社が実際に採用している機器の組み合わせであり、メーカーカタログを
-- 丸ごと取り込むと現場で使わない型式まで大量に混ざって手入力の手間が増える
-- だけなので (使う分だけ登録した方が早い、という現場判断) — weight_materials
-- (0010)/busbar_sizes (0017)/earth_wire_sizes・earth_bar_sizes (0019) と
-- 同じ方針で空のまま作成し、設定 (社内選定マスタ) から必要な行だけを手入力
-- する。
--
-- motor_starter_selections: 1行 = 「あるメーカー・電圧クラス・回路方式で、
-- ある出力(kW)/定格電流(A)の電動機に対して使う機器一式」。kW から探す場合も
-- A から探す場合もあるので両方を持つ。マッチングはアプリ側 (「入力値以上で
-- 最小の行」を採用 = 次の標準サイズに切り上げ) で行う。
--
-- main_breaker_selections: 一次側(幹線)の総電流から主開閉器を選ぶための
-- 別マスタ。電動機ごとの行ではなく、定格電流(A)だけで引く単純な表。

create table if not exists motor_starter_selections (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references manufacturers(id) on delete cascade,
  voltage_class text not null, -- '100V' | '200V' | '400V'
  circuit_type text not null, -- 'direct' | 'starDelta' | 'inverter'
  motor_kw numeric not null,
  rated_current numeric not null, -- 電動機定格電流 (A)
  breaker_model text,
  breaker_rated_current numeric,
  ct_model text,
  ct_ratio text,
  am_range text,
  contactor_model text, -- 電磁開閉器・電磁接触器 (direct/starDelta用)
  inverter_model text, -- インバーター (circuit_type='inverter'用)
  wire_size text,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists motor_starter_selections_lookup_idx
  on motor_starter_selections(manufacturer_id, voltage_class, circuit_type, motor_kw);

alter table motor_starter_selections enable row level security;
drop policy if exists anon_all on motor_starter_selections;
create policy anon_all on motor_starter_selections for all to anon using (true) with check (true);

create table if not exists main_breaker_selections (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references manufacturers(id) on delete cascade,
  voltage_class text not null, -- '100V' | '200V' | '400V'
  rated_current numeric not null, -- 主幹ブレーカー定格電流 (A) — この値以上の最小行を採用
  breaker_model text not null,
  poles text,
  wire_size text,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists main_breaker_selections_lookup_idx
  on main_breaker_selections(manufacturer_id, voltage_class, rated_current);

alter table main_breaker_selections enable row level security;
drop policy if exists anon_all on main_breaker_selections;
create policy anon_all on main_breaker_selections for all to anon using (true) with check (true);
