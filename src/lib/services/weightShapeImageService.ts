import { requireSupabase } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/supabase/storage";
import type { WeightShapeImage, WeightShapeKey } from "@/lib/utils/weightShapes";

interface WeightShapeImageRow {
  id: string;
  shape_key: WeightShapeKey;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

function fromRow(row: WeightShapeImageRow): WeightShapeImage {
  return {
    id: row.id,
    shapeKey: row.shape_key,
    fileName: row.file_name,
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at.slice(0, 10),
  };
}

/**
 * Reference drawings for 重量計算 > 基本重量計算 (アングル/チャンネル/フラットバー) —
 * stored in Supabase Storage (bucket oku-pro-files, weight-shapes/<shape>.<ext>),
 * one active image per shape, tracked in weight_shape_images. Uploading
 * again overwrites the same Storage object and row for that shape.
 */
export const weightShapeImageService = {
  async list(): Promise<WeightShapeImage[]> {
    const { data, error } = await requireSupabase().from("weight_shape_images").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async getByShape(shapeKey: WeightShapeKey): Promise<WeightShapeImage | null> {
    const { data, error } = await requireSupabase()
      .from("weight_shape_images")
      .select("*")
      .eq("shape_key", shapeKey)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as WeightShapeImageRow) : null;
  },

  async upload(shapeKey: WeightShapeKey, file: File): Promise<WeightShapeImage> {
    // Object key stays ASCII-only (shape + extension) — same lesson as
    // designTemplateService.upload(): the original file name never goes in
    // the Storage key, only in file_name for display.
    const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
    const ext = extMatch ? extMatch[1].toLowerCase() : "png";
    const path = `weight-shapes/${shapeKey}.${ext}`;
    await uploadFile(path, file);

    const { data, error } = await requireSupabase()
      .from("weight_shape_images")
      .upsert(
        { shape_key: shapeKey, file_name: file.name, storage_path: path },
        { onConflict: "shape_key" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as WeightShapeImageRow);
  },
};
