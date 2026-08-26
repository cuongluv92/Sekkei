import { requireSupabase } from "@/lib/supabase/client";
import type { ConstructionScheduleEntry } from "@/lib/types/design";

interface ConstructionScheduleRow {
  id: string;
  management_number: string;
  construction_number: string;
  project_name: string;
  work_content: string;
  worker: string;
  start_date: string;
  end_date: string;
  sort_order: number;
}

function fromRow(row: ConstructionScheduleRow): ConstructionScheduleEntry {
  return {
    id: row.id,
    managementNumber: row.management_number,
    constructionNumber: row.construction_number,
    projectName: row.project_name,
    workContent: row.work_content,
    worker: row.worker,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  };
}

export type ConstructionScheduleEntryInput = Omit<ConstructionScheduleEntry, "id" | "sortOrder">;

export const constructionScheduleService = {
  async list(): Promise<ConstructionScheduleEntry[]> {
    const { data, error } = await requireSupabase()
      .from("construction_schedule_entries")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(input: ConstructionScheduleEntryInput): Promise<ConstructionScheduleEntry> {
    const { data: existing } = await requireSupabase()
      .from("construction_schedule_entries")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? 0) + 1;
    const { data, error } = await requireSupabase()
      .from("construction_schedule_entries")
      .insert({
        management_number: input.managementNumber,
        construction_number: input.constructionNumber,
        project_name: input.projectName,
        work_content: input.workContent,
        worker: input.worker,
        start_date: input.startDate,
        end_date: input.endDate,
        sort_order: nextSortOrder,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as ConstructionScheduleRow);
  },

  async update(id: string, input: ConstructionScheduleEntryInput): Promise<ConstructionScheduleEntry> {
    const { data, error } = await requireSupabase()
      .from("construction_schedule_entries")
      .update({
        management_number: input.managementNumber,
        construction_number: input.constructionNumber,
        project_name: input.projectName,
        work_content: input.workContent,
        worker: input.worker,
        start_date: input.startDate,
        end_date: input.endDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as ConstructionScheduleRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("construction_schedule_entries").delete().eq("id", id);
    if (error) throw error;
  },
};
