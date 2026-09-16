-- oku-pro — 図面番号の自動採番が削除済み(deleted_at設定済み)案件の
-- sequence_noまで数えてしまい、案件を削除しても次番号が詰まらない
-- (例: 26-035までしかないのに誤って作った26-045を削除しても次が26-046の
-- ままになる)不具合を修正。max(sequence_no)の対象を削除済みでない
-- 案件だけに絞る。

drop function if exists create_design_case(integer, text, text, text, text, text, text, text, text, boolean);

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
  where year = p_year and deleted_at is null;

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
