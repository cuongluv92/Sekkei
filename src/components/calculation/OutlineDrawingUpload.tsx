"use client";

import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { globalCalcAssetService } from "@/lib/services";
import { getPublicUrl, removeFile, uploadFile } from "@/lib/supabase/storage";

export interface OutlineDrawingRef {
  fileName: string;
  storagePath: string;
  uploadedAt: string; // yyyy-mm-dd
}

interface Props {
  calculationType: string;
  /** 現在の画像が変わるたび(初回読み込み含む)呼ばれる — Excel出力にこの参照を渡す呼び出し側のため。 */
  onChange?: (next: OutlineDrawingRef | null) => void;
  /** 既定の「外形図」ラベルを上書きする(同一画面に複数枚アップロード欄を置く場合に使う)。 */
  title?: string;
  hint?: string;
  /** プレビュー枠の高さ (Tailwind任意値クラス)。既定は h-[220px]。 */
  heightClass?: string;
}

/**
 * 外形図 (盤の製作図・写真) の任意アップロード欄 — JSIA-T1016換気計算書の
 * 各シートには常に「注記 外形図は製作図による」とあり、耐震計算・換気計算
 * いずれも入力根拠として製品図面を参照する。
 *
 * 案件ごとではなく calculationType ごとに1枚だけ保持する共通の参考画像
 * (ユーザーからの明示指示: 案件を切り替えても同じ画像を使い、都度アップロード
 * し直さない)。メタデータは calculation_global_assets テーブル(1行 =
 * 1 calculationType)、実体は Storage (bucket oku-pro-files) の
 * `outline-drawings/_global/<calculationType>.<ext>` に保存する。
 */
export function OutlineDrawingUpload({ calculationType, onChange, title, hint, heightClass }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<OutlineDrawingRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    globalCalcAssetService.get(calculationType).then((asset) => {
      if (cancelled) return;
      const next = asset ? { fileName: asset.fileName, storagePath: asset.storagePath, uploadedAt: asset.uploadedAt } : null;
      setValue(next);
      onChange?.(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculationType]);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
      const ext = extMatch ? extMatch[1].toLowerCase() : "png";
      const path = `outline-drawings/_global/${calculationType}.${ext}`;
      await uploadFile(path, file);
      const uploadedAt = new Date().toISOString().slice(0, 10);
      await globalCalcAssetService.set(calculationType, file.name, path, uploadedAt);
      const next = { fileName: file.name, storagePath: path, uploadedAt };
      setValue(next);
      onChange?.(next);
    } catch {
      setError(t("common.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    setError(null);
    setUploading(true);
    try {
      await removeFile(value.storagePath);
      await globalCalcAssetService.remove(calculationType);
      setValue(null);
      onChange?.(null);
    } catch {
      setError(t("common.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <span className="panel-title">{title ?? t("calculation.outlineDrawing.title")}</span>
      <p className="text-[11.5px] text-muted-2">{hint ?? t("calculation.outlineDrawing.hint")}</p>

      <div
        className={`relative flex ${heightClass ?? "h-[220px]"} w-full items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface-2 p-2`}
      >
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-2" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element -- real Storage URL, not a static asset next/image can optimize
          <img src={getPublicUrl(value.storagePath)} alt={value.fileName} className="max-h-full max-w-full object-contain" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border-strong text-muted-2 transition-colors hover:border-accent hover:text-muted"
          >
            {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImageIcon className="h-8 w-8" />}
            <span className="max-w-[220px] text-center text-[12px]">{t("calculation.outlineDrawing.placeholder")}</span>
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
              <Upload className="h-3 w-3" />
              {t("common.upload")}
            </span>
          </button>
        )}
        {value && !loading && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary !py-1 !text-[11.5px]"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {t("common.upload")}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="btn-ghost btn-icon !p-1.5 text-danger hover:bg-danger/10"
              title={t("common.delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      {value && (
        <p className="text-[11px] text-muted-2">
          {value.fileName} ・ {t("calculation.outlineDrawing.uploadedAt", { date: value.uploadedAt })}
        </p>
      )}
      {error && <p className="text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}
