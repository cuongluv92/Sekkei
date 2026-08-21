import { requireSupabase } from "@/lib/supabase/client";
import type { Project } from "@/lib/types/design";

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
}

function fromRow(row: ProjectRow): Project {
  return { id: row.id, name: row.name, createdAt: row.created_at.slice(0, 10) };
}

export const projectService = {
  async list(): Promise<Project[]> {
    const { data, error } = await requireSupabase().from("projects").select("*").order("name");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await requireSupabase()
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as ProjectRow) : null;
  },

  async create(name: string): Promise<Project> {
    const { data, error } = await requireSupabase()
      .from("projects")
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as ProjectRow);
  },
};
