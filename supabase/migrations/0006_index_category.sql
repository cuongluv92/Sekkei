-- oku-pro — explicit 設計依頼書目次・京王／その他 category
--
-- 設計依頼書目次・京王 and ・その他 were being split by guessing from the free-text
-- 注文先 (orderer) field (`orderer ILIKE '%京王%'`), which is invisible in the
-- UI and unreliable (a typo or unexpected orderer name silently puts a case
-- in the wrong index). Add a real, explicit field the user picks when
-- creating/editing a 案件 instead.
-- Additive: alter table ... add column if not exists, safe to re-run.

alter table design_cases add column if not exists index_category text not null default 'other';
alter table design_cases
  drop constraint if exists design_cases_index_category_check;
alter table design_cases
  add constraint design_cases_index_category_check
  check (index_category in ('keio', 'other'));

-- create_design_case (0003) needs a 9th parameter to set this at creation
-- time. Postgres identifies a function by its full argument-type list, so
-- CREATE OR REPLACE with an added parameter creates a second overload
-- instead of replacing the original — drop the old 8-arg signature first so
-- PostgREST's RPC endpoint never has two ambiguous candidates to pick from.
drop function if exists create_design_case(uuid, integer, text, text, text, text, text, text);

create or replace function create_design_case(
  p_project_id uuid,
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
    project_id, year, sequence_no, drawing_number, request_type,
    management_number, construction_number, orderer, customer_contact,
    project_name, index_category
  ) values (
    p_project_id, p_year, next_seq,
    lpad((p_year % 100)::text, 2, '0') || '-' || lpad(next_seq::text, 3, '0'),
    p_request_type, p_management_number, p_construction_number,
    p_orderer, p_customer_contact, p_project_name, p_index_category
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_design_case(uuid, integer, text, text, text, text, text, text, text) to anon;
