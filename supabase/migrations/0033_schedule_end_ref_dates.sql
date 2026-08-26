-- oku-pro — 工程日程の完了日欄(製作/検査/立会/出荷)に、色分け計算専用の
-- 補助実日付カラムを追加する。
--
-- 0029で完了日欄は自由記入テキスト(「9月下旬」等)も許容する`text`型に
-- なったが、工程表の色分け(scheduleColoring.computeColoredSegments)は
-- 実日付(YYYY-MM-DD)しか解釈できず、自由記入テキストが入っているとその
-- 区分の色が丸ごと表示されなくなる。完了日欄自体はテキストのまま残しつつ、
-- 色分け計算専用に使う実日付だけを別カラムに持たせる(常に`date`型 — 自由
-- 記入は許容しない)。完了日欄が実日付ならそちらを優先し、この列は無視する。
alter table case_schedules
  add column if not exists production_end_ref_date date,
  add column if not exists inspection_end_ref_date date,
  add column if not exists witness_end_ref_date date,
  add column if not exists shipping_end_ref_date date;
