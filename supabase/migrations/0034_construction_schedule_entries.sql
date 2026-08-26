-- oku-pro — 工事工程 (現場作業工程) の手入力ログ
--
-- 新しい「工程表」タブ(工事工程セクション)用 — 既存の案件(design_cases)・
-- 工程(case_schedules)とは完全に独立した、現場作業を手入力で記録するだけの
-- 台帳。管理番号・工事番号・件名は既存案件から自動反映せず、ここで自由に
-- 手入力する(既存案件のものと一致している必要はない)。1行=1つの作業内容
-- の開始日〜終了日で、担当した作業者を記録する。
create table if not exists construction_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  management_number text not null default '', -- 管理番号
  construction_number text not null default '', -- 工事番号
  project_name text not null default '', -- 件名
  work_content text not null default '', -- 作業内容
  worker text not null default '', -- 作業者
  start_date date not null,
  end_date date not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists construction_schedule_entries_date_idx
  on construction_schedule_entries(start_date, end_date);

alter table construction_schedule_entries enable row level security;
drop policy if exists anon_all on construction_schedule_entries;
create policy anon_all on construction_schedule_entries for all to anon using (true) with check (true);
