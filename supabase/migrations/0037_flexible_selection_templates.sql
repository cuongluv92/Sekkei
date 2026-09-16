-- oku-pro — 選定を固定カラムの一覧表から、会社側で自由に組み替えられる
-- 「xương cá（系統樹）」型の選定マスタへ拡張するための additive schema。
--
-- 既存の motor_starter_selections / main_breaker_selections (0026) は削除・変更
-- しない。新しい画面が完成するまでは従来画面をそのまま使え、将来は旧マスタを
-- 新テンプレートへ変換できるように並存させる。
--
-- 設計方針:
-- 1) メーカー / 相数 / 電圧 / 始動方式をハードコードしない。
--    例: 三菱/富士、単相/三相、100/200/400V、直入/スター・デルタ/INV/
--    ユーザー独自方式などをテンプレートとして自由に増やせる。
-- 2) ブレーカ、CT、AM、電磁開閉器、電線、銅帯などの項目を「ノード」として
--    parent_id でつなぐ。ノード名・並び・親子関係・表示/非表示を後から変更可能。
-- 3) 選定データは固定列ではなく JSONB の conditions / outputs で保持し、
--    メーカー表・社内表・将来追加する任意項目に対応する。
-- 4) 根拠 URL / 文書番号 / 確認日を別テーブルで保持し、推測値を混ぜない。
-- 5) 幹線は「分岐の合計」「最大値」「係数」「参照表」等を rule_kind で表せる
--    ようにし、画面側では安全な構造化ルールのみを評価する（任意JSは保存しない）。

create table if not exists selection_sources (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid references manufacturers(id) on delete set null,
  title text not null,
  url text,
  document_no text,
  published_label text,
  verified_at date,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists selection_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null default 'branch' check (scope in ('branch', 'main')),
  manufacturer_id uuid references manufacturers(id) on delete set null,
  phase text not null default 'three',
  voltage_class text not null default '200V',
  start_method text not null default 'direct',
  source_id uuid references selection_sources(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists selection_templates_lookup_idx
  on selection_templates(scope, manufacturer_id, phase, voltage_class, start_method, is_active, sort_order);

create table if not exists selection_nodes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references selection_templates(id) on delete cascade,
  parent_id uuid references selection_nodes(id) on delete set null,
  node_key text not null,
  label text not null,
  role text not null default 'output' check (role in ('input', 'output', 'calculated', 'group')),
  value_type text not null default 'text' check (value_type in ('text', 'number', 'boolean', 'select')),
  unit text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  visible_default boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, node_key)
);
create index if not exists selection_nodes_tree_idx
  on selection_nodes(template_id, parent_id, sort_order);

create table if not exists selection_rule_rows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references selection_templates(id) on delete cascade,
  source_id uuid references selection_sources(id) on delete set null,
  rule_kind text not null default 'lookup' check (rule_kind in ('lookup', 'aggregate', 'formula')),
  input_unit text,
  input_min numeric,
  input_max numeric,
  conditions jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  expression jsonb,
  priority integer not null default 0,
  sort_order integer not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists selection_rule_rows_lookup_idx
  on selection_rule_rows(template_id, rule_kind, priority desc, sort_order);

create table if not exists selection_display_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references selection_templates(id) on delete cascade,
  visible_node_keys text[] not null default '{}'::text[],
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists selection_display_profiles_template_idx
  on selection_display_profiles(template_id, is_default desc, sort_order);

alter table selection_sources enable row level security;
alter table selection_templates enable row level security;
alter table selection_nodes enable row level security;
alter table selection_rule_rows enable row level security;
alter table selection_display_profiles enable row level security;

drop policy if exists anon_all on selection_sources;
create policy anon_all on selection_sources for all to anon using (true) with check (true);
drop policy if exists anon_all on selection_templates;
create policy anon_all on selection_templates for all to anon using (true) with check (true);
drop policy if exists anon_all on selection_nodes;
create policy anon_all on selection_nodes for all to anon using (true) with check (true);
drop policy if exists anon_all on selection_rule_rows;
create policy anon_all on selection_rule_rows for all to anon using (true) with check (true);
drop policy if exists anon_all on selection_display_profiles;
create policy anon_all on selection_display_profiles for all to anon using (true) with check (true);
