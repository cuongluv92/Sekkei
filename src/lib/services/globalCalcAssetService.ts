import { requireSupabase } from "@/lib/supabase/client";

export interface GlobalCalcAsset {
  calculationType: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}

interface GlobalCalcAssetRow {
  calculation_type: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

function fromRow(row: GlobalCalcAssetRow): GlobalCalcAsset {
  return {
    calculationType: row.calculation_type,
    fileName: row.file_name,
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at,
  };
}

/**
 * 耐震計算・換気計算の外形図/給排気口配置図アップロード用 — calculation_records
 * (案件ごと)とは異なり、案件をまたいで共有する1枚だけの参考画像を保持する
 * (ユーザーからの明示指示: 案件を切り替えても同じ画像を使い、都度アップロード
 * し直さない)。1行 = 1 calculationType の現在の画像メタデータ、実体は
 * Supabase Storage(oku-pro-files, outline-drawings/_global/配下)。
 */
export const globalCalcAssetService = {
  async get(calculationType: string): Promise<GlobalCalcAsset | null> {
    const { data, error } = await requireSupabase()
      .from("calculation_global_assets")
      .select("*")
      .eq("calculation_type", calculationType)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as GlobalCalcAssetRow) : null;
  },

  async set(calculationType: string, fileName: string, storagePath: string, uploadedAt: string): Promise<GlobalCalcAsset> {
    const { data, error } = await requireSupabase()
      .from("calculation_global_assets")
      .upsert(
        {
          calculation_type: calculationType,
          file_name: fileName,
          storage_path: storagePath,
          uploaded_at: uploadedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "calculation_type" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as GlobalCalcAssetRow);
  },

  async remove(calculationType: string): Promise<void> {
    const { error } = await requireSupabase().from("calculation_global_assets").delete().eq("calculation_type", calculationType);
    if (error) throw error;
  },
};
