import type { FileAsset } from "@/lib/types";

/**
 * Opens a real attached file (its Supabase Storage public URL) in a new
 * tab. Browsers open pdf/image inline and download unrecognized binary
 * types (DWG) automatically — no separate "download" vs "view" logic is
 * needed on our side.
 */
export function openFileAsset(file: FileAsset): void {
  if (!file.url) return;
  window.open(file.url, "_blank", "noopener,noreferrer");
}

/** Picks the first attached file matching `kind`, if any. */
export function findFileByKind(files: FileAsset[], kind: FileAsset["kind"]): FileAsset | undefined {
  return files.find((f) => f.kind === kind);
}
