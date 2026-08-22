import { requireSupabase } from "@/lib/supabase/client";
import { uploadFile, getPublicUrl } from "@/lib/supabase/storage";
import type { DesignTemplateKind, DesignTemplateVersion } from "@/lib/types/design";

interface DesignTemplateRow {
  id: string;
  kind: DesignTemplateKind;
  version: number;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  active: boolean;
  uploaded_at: string;
}

function fromRow(row: DesignTemplateRow): DesignTemplateVersion {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    fileName: row.file_name,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes,
    active: row.active,
    uploadedAt: row.uploaded_at.slice(0, 10),
  };
}

/**
 * Every Excel/DWG template used by 設計管理's export buttons is stored in
 * Supabase Storage (bucket oku-pro-files, templates/<kind>/) and tracked
 * here — never bundled as a static file in the app, so replacing a template
 * (a new Excel format, a corrected DWG starter) never requires a code
 * change or redeploy. Uploading a new version deactivates the previous one
 * instead of deleting it, so a bad upload can be rolled back from 設定.
 */
export const designTemplateService = {
  async listByKind(kind: DesignTemplateKind): Promise<DesignTemplateVersion[]> {
    const { data, error } = await requireSupabase()
      .from("design_templates")
      .select("*")
      .eq("kind", kind)
      .order("version", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async getActive(kind: DesignTemplateKind): Promise<DesignTemplateVersion | null> {
    const { data, error } = await requireSupabase()
      .from("design_templates")
      .select("*")
      .eq("kind", kind)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as DesignTemplateRow) : null;
  },

  /** Downloads the bytes of the currently active template for `kind`. Throws a clear, catchable error if none has been uploaded yet — never falls back to a bundled/invented file. */
  async fetchActiveBytes(kind: DesignTemplateKind): Promise<ArrayBuffer> {
    const active = await this.getActive(kind);
    if (!active) throw new Error(`no-active-template:${kind}`);
    const res = await fetch(getPublicUrl(active.storagePath));
    if (!res.ok) throw new Error(`template-fetch-failed:${kind}`);
    return res.arrayBuffer();
  },

  /** Uploads `file` as the new active version for `kind`; the previous active version (if any) is kept, just deactivated. */
  async upload(kind: DesignTemplateKind, file: File): Promise<DesignTemplateVersion> {
    const client = requireSupabase();
    const existing = await this.listByKind(kind);
    const nextVersion = (existing[0]?.version ?? 0) + 1;
    // Object key stays ASCII-only (kind/version/extension) — the real
    // template file names contain Japanese text, circled-number glyphs
    // (①-⑧) and punctuation ("／"・"), which S3-compatible Storage keys can
    // reject or mishandle. The original name is preserved in file_name for
    // display/download; it never appears in the Storage path itself.
    const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
    const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
    const path = `templates/${kind}/v${nextVersion}.${ext}`;

    const uploaded = await uploadFile(path, file);

    if (existing.length > 0) {
      const { error: deactivateError } = await client
        .from("design_templates")
        .update({ active: false })
        .eq("kind", kind)
        .eq("active", true);
      if (deactivateError) throw deactivateError;
    }

    const { data, error } = await client
      .from("design_templates")
      .insert({
        kind,
        version: nextVersion,
        file_name: file.name,
        storage_path: path,
        content_type: file.type || "application/octet-stream",
        size_bytes: uploaded.sizeBytes,
        active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as DesignTemplateRow);
  },

  /** Rolls back to a previous version (e.g. after a bad upload) without re-uploading the file. */
  async activate(kind: DesignTemplateKind, id: string): Promise<void> {
    const client = requireSupabase();
    const { error: deactivateError } = await client
      .from("design_templates")
      .update({ active: false })
      .eq("kind", kind)
      .eq("active", true);
    if (deactivateError) throw deactivateError;
    const { error } = await client.from("design_templates").update({ active: true }).eq("id", id);
    if (error) throw error;
  },
};
