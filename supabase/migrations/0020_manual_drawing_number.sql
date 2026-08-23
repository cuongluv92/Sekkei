-- oku-pro — 図面番号 manual entry from non-設計依頼 案件作成 flows
--
-- create_design_case previously always auto-derived drawing_number from
-- year+sequence_no, with no way to override it. Per spec: only 設計依頼
-- (設計管理's own 新規案件 flow) should auto-suggest the next 図面番号 —
-- every other 案件-creation entry point (部品製作, 計算 modules, ...) must
-- let the user type it by hand instead (e.g. if 26-003 exists, do not
-- silently offer 26-004 — the designer enters the number themselves).
--
-- sequence_no stays an internal auto-incrementing counter regardless (it
-- only feeds the 設計依頼 "next number" preview) — drawing_number is now
-- allowed to diverge from it when a caller explicitly supplies one.
-- Additive: replaces the function body only (same signature plus one new
-- optional trailing parameter), safe to re-run.

drop function if exists create_design_case(integer, text, text, text, text, text, text, text);

create or replace function create_design_case(
  p_year integer,
  p_request_type text,
  p_management_number text,
  p_construction_number text,
  p_orderer text,
  p_customer_contact text,
  p_project_name text,
  p_index_category text default 'other',
  p_drawing_number text default null
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
    coalesce(
      nullif(trim(p_drawing_number), ''),
      lpad((p_year % 100)::text, 2, '0') || '-' || lpad(next_seq::text, 3, '0')
    ),
    p_request_type, p_management_number, p_construction_number,
    p_orderer, p_customer_contact, p_project_name, p_index_category
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_design_case(integer, text, text, text, text, text, text, text, text) to anon;
