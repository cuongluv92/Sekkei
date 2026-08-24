-- oku-pro — allow "dxf" as a part_templates.kind, drop "dwg"
--
-- 0009 created part_templates with `check (kind in ('excel', 'dwg'))`. DWG
-- export was later replaced with DXF (real data-fill is only possible on
-- DXF's plain-text format, not DWG's proprietary binary one — see
-- src/lib/services/partAssemblyExportService.ts), but this constraint was
-- never updated, so every attempt to upload a "dxf" template failed at the
-- database with a check-constraint violation. Any existing 'dwg' row is
-- deleted first since the app no longer reads that kind (see
-- PartTemplateSettings.tsx) and the old constraint would otherwise block
-- narrowing it. Additive: safe to re-run.

delete from part_templates where kind = 'dwg';

alter table part_templates drop constraint if exists part_templates_kind_check;
alter table part_templates add constraint part_templates_kind_check check (kind in ('excel', 'dxf'));
