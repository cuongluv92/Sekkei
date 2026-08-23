-- oku-pro — explicit p_auto_number flag for create_design_case
--
-- 0020 let callers supply p_drawing_number to override the auto-derived
-- 図面番号, but treated "" the same as null (via nullif+coalesce), silently
-- falling back to auto-numbering whenever a caller passed a blank string.
-- That reopens exactly what 0020 was meant to close: 新規案件 no longer
-- requires any field to be filled before 作成する is enabled (spec
-- follow-up), so a manual 図面番号 field left blank on a non-設計依頼 flow
-- must be saved as empty text, never silently promoted to an auto-numbered
-- value just because it happened to be blank.
--
-- Add an explicit p_auto_number flag so "should this call auto-number" is
-- decided by the caller's intent, never inferred from whether the supplied
-- text is empty.

drop function if exists create_design_case(integer, text, text, text, text, text, text, text, text);

create or replace function create_design_case(
  p_year integer,
  p_request_type text,
  p_management_number text,
  p_construction_number text,
  p_orderer text,
  p_customer_contact text,
  p_project_name text,
  p_index_category text default 'other',
  p_drawing_number text default null,
  p_auto_number boolean default false
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
    case
      when p_auto_number then
        lpad((p_year % 100)::text, 2, '0') || '-' || lpad(next_seq::text, 3, '0')
      else coalesce(trim(p_drawing_number), '')
    end,
    p_request_type, p_management_number, p_construction_number,
    p_orderer, p_customer_contact, p_project_name, p_index_category
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_design_case(integer, text, text, text, text, text, text, text, text, boolean) to anon;
