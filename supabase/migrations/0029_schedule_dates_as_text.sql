-- oku-pro — 工程日程の日付欄を自由記入 (例:「9月中旬」「下旬」) に対応させる
-- ため、これまで `date` 型だった案件工程 (case_schedules) と設計期日
-- (case_panels.design_due_date) の各カラムを `text` 型に変更する。
--
-- 実日付 (YYYY-MM-DD) はそのまま `date::text` で無劣化にキャストできる
-- (Supabaseのデフォルト DateStyle は ISO のため "YYYY-MM-DD" 形式で変換
-- される) — 既存の保存済み日付は失われない。今後はアプリ側 (DateInput /
-- isIsoDate) がISO形式か自由記入テキストかを判定して扱う。

alter table case_panels
  alter column design_due_date type text using design_due_date::text;

alter table case_schedules
  alter column sheet_metal_order_date type text using sheet_metal_order_date::text,
  alter column sheet_metal_delivery_date type text using sheet_metal_delivery_date::text,
  alter column box_order_date type text using box_order_date::text,
  alter column box_delivery_date type text using box_delivery_date::text,
  alter column accessory_order_date type text using accessory_order_date::text,
  alter column accessory_delivery_date type text using accessory_delivery_date::text,
  alter column production_start_date type text using production_start_date::text,
  alter column production_end_date type text using production_end_date::text,
  alter column inspection_start_date type text using inspection_start_date::text,
  alter column inspection_end_date type text using inspection_end_date::text,
  alter column witness_start_date type text using witness_start_date::text,
  alter column witness_end_date type text using witness_end_date::text,
  alter column shipping_start_date type text using shipping_start_date::text,
  alter column shipping_end_date type text using shipping_end_date::text,
  alter column delivery_date type text using delivery_date::text;
