-- oku-pro — BOX/鈑金 vendor name for 製作依頼書
--
-- Confirmed against the real ⑧製作依頼書 template: the ＢＯＸ/鈑金 cells in the
-- row15-16 date matrix show a company name above the date (e.g. "日東工業"
-- then the delivery date on the next line), which case_schedules had no
-- field for. Additive: alter table ... add column if not exists.

alter table case_schedules add column if not exists box_manufacturer text not null default '';
alter table case_schedules add column if not exists sheet_metal_manufacturer text not null default '';
