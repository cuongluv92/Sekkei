-- oku-pro — 案件の識別情報(図面番号/管理番号/件名/盤名称)の変更履歴を
-- 記録する。
--
-- design_cases/case_panels は現在値しか保持しないため、工程表(簡易カレン
-- ダー)で過去の月に戻って見ても、件名/管理番号は常に「今の値」が出て
-- しまい、その時点で実際どんな名前だったかが分からなかった。このテーブル
-- は「ある時点で有効だった識別情報のスナップショット」を積み上げる方式
-- (type 2 slowly changing dimension)で保持する — 案件が識別情報を変更する
-- たびに、その時点の全識別情報(図面番号/管理番号/件名/盤名称一覧)をまとめて
-- 1行追加する。ある日付時点の値を知りたい場合は、その日付以前で
-- valid_from が最も新しい行を1件引けばよい。
--
-- 過去の実履歴は元々記録されていないため、既存の各案件について「作成日
-- 時点でこの値だった」とみなした初期スナップショットを1件だけ補完する
-- (完全に正確な過去履歴ではないが、今後の変更からは正しく記録されるように
-- なる — 完全な過去復元より「今後は正しく積み上がる」ことを優先)。
create table if not exists design_case_identity_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references design_cases(id) on delete cascade,
  valid_from timestamptz not null default now(),
  drawing_number text not null,
  management_number text not null,
  construction_number text not null,
  project_name text not null,
  -- [{ "panelNo": 1, "panelName": "..." }, ...] — case_panelsへの外部キーは
  -- 張らない(盤自体が削除/差し替えされてもスナップショットは当時のまま
  -- 残す必要があるため、値をそのまま埋め込む)。
  panel_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists design_case_identity_snapshots_case_valid_idx
  on design_case_identity_snapshots(case_id, valid_from desc);

alter table design_case_identity_snapshots enable row level security;
create policy anon_all on design_case_identity_snapshots for all to anon using (true) with check (true);

insert into design_case_identity_snapshots (
  case_id, valid_from, drawing_number, management_number, construction_number, project_name, panel_names
)
select
  dc.id,
  dc.created_at,
  dc.drawing_number,
  dc.management_number,
  dc.construction_number,
  dc.project_name,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('panelNo', cp.panel_no, 'panelName', cp.panel_name) order by cp.panel_no)
      from case_panels cp
      where cp.case_id = dc.id
    ),
    '[]'::jsonb
  )
from design_cases dc
where dc.deleted_at is null
  and not exists (
    select 1 from design_case_identity_snapshots s where s.case_id = dc.id
  );
