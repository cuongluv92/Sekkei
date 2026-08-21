import { requireSupabase } from "./client";

export const FILES_BUCKET = "oku-pro-files";

export interface UploadedFile {
  path: string;
  publicUrl: string;
  sizeBytes: number;
}

/** Uploads a File to the shared bucket under the given path (folder prefix conventionally `${ownerType}/${ownerId}/${fileName}`), overwriting any existing object at that path. */
export async function uploadFile(path: string, file: File): Promise<UploadedFile> {
  const client = requireSupabase();
  const { error } = await client.storage.from(FILES_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = client.storage.from(FILES_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, sizeBytes: file.size };
}

export function getPublicUrl(path: string): string {
  const client = requireSupabase();
  return client.storage.from(FILES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeFile(path: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.storage.from(FILES_BUCKET).remove([path]);
  if (error) throw error;
}
