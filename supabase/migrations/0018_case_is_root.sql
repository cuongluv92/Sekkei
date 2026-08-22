-- oku-pro — 案件 (design_cases) becomes the single root record.
--
-- Previously `projects` sat ABOVE `design_cases` (one `projects` row could
-- own several 案件, e.g. 26-001/26-002/26-003 all filed under one Project),
-- and both `part_assembly_rows` and `calculation_records` were scoped by
-- that `project_id` — so 部品製作/計算 data saved while ANY 案件 under a
-- Project was active was actually shared with every sibling 案件 under the
-- same Project. That is the exact "data mixes between 案件" architecture bug
-- being fixed here.
--
-- Correct model: 案件 (design_cases) IS the root/active record end to end —
-- there is no Project grouping above it. This migration repoints every
-- table that was scoped by `project_id` to be scoped by `case_id`
-- (design_cases.id) instead, and retires the `projects` table entirely.
--
-- Data safety: a `projects` row that ever had more than one 案件 has no
-- single correct case to attribute its old part_assembly_rows/
-- calculation_records to (that ambiguity IS the bug) — best effort maps
-- those rows to that Project's earliest-created 案件 so nothing is silently
-- dropped for the common (and typical, in this app's real usage so far)
-- case of one Project : one 案件; rows under a Project with zero 案件 have
-- nothing to attach to and are removed. This is called out explicitly in
-- the phase report — verify manually after deploying if this matters for
-- your data.

-- ---------------------------------------------------------------------
-- calculation_records: project_id -> case_id
-- ---------------------------------------------------------------------

alter table calculation_records add column if not exists case_id uuid;

-- Guarded so this migration stays safely re-runnable: once `project_id` is
-- dropped below (first run), this whole backfill becomes a no-op instead of
-- failing to even parse a reference to a column that no longer exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'calculation_records' and column_name = 'project_id'
  ) then
    update calculation_records cr
    set case_id = (
      select dc.id from design_cases dc
      where dc.project_id = cr.project_id
      order by dc.created_at asc
      limit 1
    )
    where cr.case_id is null;
  end if;
end $$;

delete from calculation_records where case_id is null;

alter table calculation_records
  drop constraint if exists calculation_records_case_id_fkey;
alter table calculation_records
  add constraint calculation_records_case_id_fkey
  foreign key (case_id) references design_cases(id) on delete cascade;
alter table calculation_records alter column case_id set not null;

drop index if exists calculation_records_project_type_idx;
alter table calculation_records drop column if exists project_id;
create unique index if not exists calculation_records_case_type_idx
  on calculation_records(case_id, calculation_type);

-- ---------------------------------------------------------------------
-- part_assembly_rows: project_id -> design_case_id (mandatory scoping key)
-- ---------------------------------------------------------------------
-- NOTE: `part_assembly_rows.case_id` (0001_init.sql) already exists as a
-- separate, optional, per-row field (traceability back to which 案件/盤 a
-- row originated from — not populated by any UI yet, see
-- PartAssemblyRow.caseId). It is NOT the scoping key and is left untouched;
-- the new mandatory scoping column is named `design_case_id` specifically
-- to avoid colliding with it.

alter table part_assembly_rows add column if not exists design_case_id uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'part_assembly_rows' and column_name = 'project_id'
  ) then
    update part_assembly_rows par
    set design_case_id = (
      select dc.id from design_cases dc
      where dc.project_id = par.project_id
      order by dc.created_at asc
      limit 1
    )
    where par.design_case_id is null;
  end if;
end $$;

delete from part_assembly_rows where design_case_id is null;

alter table part_assembly_rows
  drop constraint if exists part_assembly_rows_design_case_id_fkey;
alter table part_assembly_rows
  add constraint part_assembly_rows_design_case_id_fkey
  foreign key (design_case_id) references design_cases(id) on delete cascade;
alter table part_assembly_rows alter column design_case_id set not null;

drop index if exists part_assembly_rows_project_id_idx;
alter table part_assembly_rows drop column if exists project_id;
create index if not exists part_assembly_rows_design_case_id_idx
  on part_assembly_rows(design_case_id);

-- ---------------------------------------------------------------------
-- design_cases: drop the parent `projects` link; add soft-delete (archive)
-- ---------------------------------------------------------------------

drop index if exists design_cases_project_id_idx;
alter table design_cases drop column if exists project_id;
alter table design_cases add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------
-- projects: retired — design_cases is now the single root 案件 record.
-- ---------------------------------------------------------------------

drop table if exists projects;

-- ---------------------------------------------------------------------
-- create_design_case: drop the p_project_id parameter
-- ---------------------------------------------------------------------

drop function if exists create_design_case(uuid, integer, text, text, text, text, text, text, text);

create or replace function create_design_case(
  p_year integer,
  p_request_type text,
  p_management_number text,
  p_construction_number text,
  p_orderer text,
  p_customer_contact text,
  p_project_name text,
  p_index_category text default 'other'
) returns design_cases
language plpgsql
as $$
declare
  next_seq integer;
  result design_cases;
begin
  perform pg_advisory_xact_lock(hashtext('design_case_seq_' || p_year::text));

  select coalesce(max(sequence_no), 0) + 1 into next_seq
  from design_cases
  where year = p_year;

  insert into design_cases (
    year, sequence_no, drawing_number, request_type,
    management_number, construction_number, orderer, customer_contact,
    project_name, index_category
  ) values (
    p_year, next_seq,
    lpad((p_year % 100)::text, 2, '0') || '-' || lpad(next_seq::text, 3, '0'),
    p_request_type, p_management_number, p_construction_number,
    p_orderer, p_customer_contact, p_project_name, p_index_category
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_design_case(integer, text, text, text, text, text, text, text) to anon;
