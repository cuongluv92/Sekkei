"use client";

import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { getPublicUrl, removeFile, uploadFile } from "@/lib/supabase/storage";

export interface OutlineDrawingRef {
  fileName: string;
  storagePath: string;
  uploadedAt: string; // yyyy-mm-dd
}

interface Props {
  caseId: string;
  calculationType: string;
  value: OutlineDrawingRef | null;
  onChange: (next: OutlineDrawingRef | null) => void;
}

/**
 * 外形図 (盤の製作図・写真) の任意アップロード欄 — JSIA-T1016換気計算書の
 * 各シートには常に「注記 外形図は製作図による」とあり、耐震計算・換気計算
 * いずれも入力根拠として製品図面を参照する。Storage (bucket oku-pro-files)
 * に `outline-drawings/<caseId>/<calculationType>.<ext>` として保存し、参照
 * (ファイル名・パス・日付) は呼び出し側の入力オブジェクトに含めて保存する
 * (この計算モジュール専用のテーブルは持たない — WeightShapeCalcSection と
 * 同じ Storage 直接利用パターン)。
 */
export function OutlineDrawingUpload({ caseId, calculationType, value, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const extMatch = /\.([A-Za-z0-9]+)$/.exec(file.name);
      const ext = extMatch ? extMatch[1].toLowerCase() : "png";
      const path = `outline-drawings/${caseId}/${calculationType}.${ext}`;
      await uploadFile(path, file);
      onChange({ fileName: file.name, storagePath: path, uploadedAt: new Date().toISOString().slice(0, 10) });
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
      onChange(null);
    } catch {
      setError(t("common.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <span className="panel-title">{t("calculation.outlineDrawing.title")}</span>
      <p className="text-[11.5px] text-muted-2">{t("calculation.outlineDrawing.hint")}</p>

      <div className="relative flex h-[220px] w-full max-w-md items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface-2 p-2">
        {value ? (
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
        {value && (
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
