import { requireSupabase } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/supabase/storage";
import type { PanelImageKey } from "@/lib/utils/panelWeight";

export interface PanelWeightLayerImage {
  id: string;
  layerKey: PanelImageKey;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}

interface PanelWeightLayerImageRow {
  id: string;
  layer_key: PanelImageKey;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

function fromRow(row: PanelWeightLayerImageRow): PanelWeightLayerImage {
  return {
    id: row.id,
    layerKey: row.layer_key,
    fileName: row.file_name,
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at.slice(0, 10),
  };
}

/**
 * Reference drawings for 重量計算 > 盤重量計算 > 盤本体重量 (屋内/屋外/Nitto/扉/屋根) —
 * stored in Supabase Storage (bucket oku-pro-files,
 * panel-weight-layers/<layer>.<ext>), one active image per layer key,
 * tracked in panel_weight_layer_images. Uploading again overwrites the same
 * Storage object and row for that layer.
 */
export const panelWeightLayerImageService = {
  async list(): Promise<PanelWeightLayerImage[]> {
    const { data, error } = await requireSupabase().from("panel_weight_layer_images").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async upload(layerKey: PanelImageKey, file: File): Promise<PanelWeightLayerImage> {
    // Object key stays ASCII-only (layer + extension) — same lesson as
    // weightShapeImageService.upload(): the original file name never goes
    // in the Storage key, only in file_name for display.
    const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
    const ext = extMatch ? extMatch[1].toLowerCase() : "png";
    const path = `panel-weight-layers/${layerKey}.${ext}`;
    await uploadFile(path, file);

    const { data, error } = await requireSupabase()
      .from("panel_weight_layer_images")
      .upsert(
        { layer_key: layerKey, file_name: file.name, storage_path: path },
        { onConflict: "layer_key" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as PanelWeightLayerImageRow);
  },
};
