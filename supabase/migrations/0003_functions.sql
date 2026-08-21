-- oku-pro — atomic 図面番号 numbering.
--
-- Computing max(sequence_no)+1 and inserting as two separate statements from
-- the client (as the localStorage mock did, by necessity) has a race window
-- between two concurrent creates for the same year. This function closes it
-- properly: pg_advisory_xact_lock serializes concurrent calls for the same
-- year (different years still run concurrently), the sequence number is
-- computed and inserted inside that same transaction, and the table's own
-- UNIQUE(year, sequence_no) constraint is the last-resort guarantee.
-- Additive/idempotent — CREATE OR REPLACE is safe to re-run.

create or replace function create_design_case(
  p_project_id uuid,
  p_year integer,
  p_request_type text,
  p_management_number text,
  p_construction_number text,
  p_orderer text,
  p_customer_contact text,
  p_project_name text
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
    project_name
  ) values (
    p_project_id, p_year, next_seq,
    lpad((p_year % 100)::text, 2, '0') || '-' || lpad(next_seq::text, 3, '0'),
    p_request_type, p_management_number, p_construction_number,
    p_orderer, p_customer_contact, p_project_name
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_design_case(uuid, integer, text, text, text, text, text, text) to anon;
