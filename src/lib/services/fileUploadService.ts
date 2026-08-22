import { uploadFile } from "@/lib/supabase/storage";
import { createFileAsset, type FileAssetOwnerType } from "./fileAssetService";
import type { FileAsset } from "@/lib/types";

const STORAGE_PREFIX: Record<FileAssetOwnerType, string> = {
  part_data: "part-data",
  part_drawing: "part-drawing",
  catalog: "catalog",
  template: "template",
};

function inferKind(file: File): FileAsset["kind"] {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "dwg" || ext === "dxf") return "dwg";
  if (ext === "pdf") return "pdf";
  return "image";
}

/**
 * Uploads `file` to Storage and attaches it to `ownerId` (a part_data/
 * part_drawing/catalog row) as a new file_assets row. The Storage key stays
 * ASCII-safe (owner id + timestamp + extension) — the real file name lives
 * only in file_assets.file_name for display/download, never in the Storage
 * key itself (same lesson learned from designTemplateService.upload(),
 * where embedding the original Japanese file name broke uploads).
 */
export async function uploadPartFile(
  ownerType: FileAssetOwnerType,
  ownerId: string,
  file: File,
): Promise<FileAsset> {
  const kind = inferKind(file);
  const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  const path = `${STORAGE_PREFIX[ownerType]}/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploaded = await uploadFile(path, file);
  return createFileAsset({
    ownerType,
    ownerId,
    kind,
    fileName: file.name,
    storagePath: path,
    sizeBytes: uploaded.sizeBytes,
  });
}
