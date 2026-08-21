import { requireSupabase } from "@/lib/supabase/client";
import { getPublicUrl } from "@/lib/supabase/storage";
import type { FileAsset } from "@/lib/types";

export type FileAssetOwnerType = "part_data" | "part_drawing" | "catalog" | "template";

interface FileAssetRow {
  id: string;
  owner_type: FileAssetOwnerType;
  owner_id: string;
  kind: FileAsset["kind"];
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  updated_at: string;
}

function fromRow(row: FileAssetRow): FileAsset {
  const publicUrl = getPublicUrl(row.storage_path);
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    url: publicUrl,
    previewUrl: row.kind === "pdf" || row.kind === "image" ? publicUrl : undefined,
    sizeBytes: row.size_bytes ?? undefined,
    updatedAt: row.updated_at.slice(0, 10),
  };
}

/** Batch-fetches file_assets for many owners at once (avoids one query per row when rendering a list). Binary content lives in Storage — this table (and this fetch) only ever touches metadata + path. */
export async function fetchFileAssetsByOwners(
  ownerType: FileAssetOwnerType,
  ownerIds: string[],
): Promise<Map<string, FileAsset[]>> {
  const map = new Map<string, FileAsset[]>();
  if (ownerIds.length === 0) return map;
  const { data, error } = await requireSupabase()
    .from("file_assets")
    .select("*")
    .eq("owner_type", ownerType)
    .in("owner_id", ownerIds);
  if (error) throw error;
  for (const row of (data ?? []) as FileAssetRow[]) {
    const asset = fromRow(row);
    const list = map.get(row.owner_id) ?? [];
    list.push(asset);
    map.set(row.owner_id, list);
  }
  return map;
}

export async function fetchFileAssets(ownerType: FileAssetOwnerType, ownerId: string): Promise<FileAsset[]> {
  const map = await fetchFileAssetsByOwners(ownerType, [ownerId]);
  return map.get(ownerId) ?? [];
}

export async function createFileAsset(input: {
  ownerType: FileAssetOwnerType;
  ownerId: string;
  kind: FileAsset["kind"];
  fileName: string;
  storagePath: string;
  sizeBytes?: number;
}): Promise<FileAsset> {
  const { data, error } = await requireSupabase()
    .from("file_assets")
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      kind: input.kind,
      file_name: input.fileName,
      storage_path: input.storagePath,
      size_bytes: input.sizeBytes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as FileAssetRow);
}
