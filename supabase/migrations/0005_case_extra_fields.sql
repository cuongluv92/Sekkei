-- oku-pro — fields confirmed present in the real ②図面管理台帳 /
-- ③④設計依頼書目次 templates but missing from the initial schema:
--   担当        -> assignee              (③④ 目次 sheets, column 担当)
--   状態(色分け) -> case_status           (② H1 legend: two color states)
-- 製造完了 (② column J, manually-entered "完") also confirmed missing.
-- 施主名 (② column M), 決定金額 (② column L), and column N were considered
-- but confirmed NOT needed (user: no owner-name or pricing data in this
-- app; column N doesn't exist for real) — intentionally not added here.
-- Additive: alter table ... add column if not exists, safe to re-run.

alter table design_cases add column if not exists assignee text not null default '';
alter table design_cases add column if not exists case_status text not null default '';
alter table design_cases
  drop constraint if exists design_cases_case_status_check;
alter table design_cases
  add constraint design_cases_case_status_check
  check (case_status in ('', 'design_pending_approval', 'production_requested'));
alter table design_cases add column if not exists manufacturing_complete boolean not null default false;
