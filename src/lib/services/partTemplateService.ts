import { requireSupabase } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/supabase/storage";
import type { PartTemplate, PartTemplateKind } from "@/lib/types";
import type { PartTemplateRepository } from "./types";

interface PartTemplateRow {
  id: string;
  kind: PartTemplateKind;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

function fromRow(row: PartTemplateRow): PartTemplate {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at.slice(0, 10),
  };
}

/**
 * 部品製作 (Excel出力/DWG出力) export templates — stored in Supabase Storage
 * (bucket oku-pro-files, part-templates/<kind>.<ext>) and tracked in
 * part_templates, one row per kind (no version history, matching the 設定
 * panel which only shows the current file). Uploading again overwrites the
 * same Storage object and row for that kind.
 */
class SupabasePartTemplateRepository implements PartTemplateRepository {
  async list(): Promise<PartTemplate[]> {
    const { data, error } = await requireSupabase().from("part_templates").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async getByKind(kind: PartTemplateKind): Promise<PartTemplate | null> {
    const { data, error } = await requireSupabase()
      .from("part_templates")
      .select("*")
      .eq("kind", kind)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PartTemplateRow) : null;
  }

  async upload(kind: PartTemplateKind, file: File): Promise<PartTemplate> {
    // Object key stays ASCII-only (kind + extension) — see designTemplateService's
    // upload() for why the original file name never goes in the Storage key.
    const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
    const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
    const path = `part-templates/${kind}.${ext}`;
    await uploadFile(path, file);

    const { data, error } = await requireSupabase()
      .from("part_templates")
      .upsert(
        { kind, file_name: file.name, storage_path: path, size_bytes: file.size },
        { onConflict: "kind" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as PartTemplateRow);
  }
}

export const partTemplateService: PartTemplateRepository = new SupabasePartTemplateRepository();
