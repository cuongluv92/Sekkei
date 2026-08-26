-- oku-pro — 案件をまたいで共有する計算モジュール用アップロード画像。
--
-- 耐震計算・換気計算の外形図/給排気口配置図アップロード(OutlineDrawingUpload)
-- は、ユーザーからの明示指示により「案件ごとの記録」ではなく「計算種別
-- (calculation_type) ごとに1枚だけ保持する共通の参考図」として扱う —
-- 案件を切り替えても同じ画像が使われ、都度アップロードし直す必要はない。
-- calculation_records(0016)は案件ごとの入力を保持するテーブルで、案件を
-- またぐ共有データにはそもそも使えない(case_id not null制約)ため、この
-- 小さな専用テーブルを新設する。1行 = 1 calculation_type の現在の画像
-- (保存先はSupabase Storage、ここではメタデータのみ保持)。

create table if not exists calculation_global_assets (
  calculation_type text primary key,
  file_name text not null,
  storage_path text not null,
  uploaded_at date not null,
  updated_at timestamptz not null default now()
);

alter table calculation_global_assets enable row level security;
drop policy if exists anon_all on calculation_global_assets;
create policy anon_all on calculation_global_assets for all to anon using (true) with check (true);
