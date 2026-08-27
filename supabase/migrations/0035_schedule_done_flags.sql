-- oku-pro — 工程日程の各納入日/完了日欄に「済」フラグを追加する。
--
-- 実日付は色分け(バーの範囲)計算に必須のため変更しないが、チェックを
-- 入れると画面/Excel/印刷いずれのタイムラインでも、その区分のマイル
-- ストーンラベルを実日付の日番号ではなく「済」の文字で表示する
-- (scheduleColoring.computeMilestones/buildMilestoneLabelsByRow系参照)。
alter table case_schedules
  add column if not exists sheet_metal_delivery_done boolean not null default false,
  add column if not exists box_delivery_done boolean not null default false,
  add column if not exists accessory_delivery_done boolean not null default false,
  add column if not exists production_end_done boolean not null default false,
  add column if not exists inspection_end_done boolean not null default false,
  add column if not exists witness_end_done boolean not null default false,
  add column if not exists shipping_end_done boolean not null default false,
  add column if not exists delivery_done boolean not null default false;
