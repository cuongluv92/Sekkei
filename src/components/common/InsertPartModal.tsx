"use client";

import { useTranslation } from "@/lib/i18n";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { Modal } from "@/components/common/Modal";
import { PartMasterSearch } from "@/components/common/PartMasterSearch";
import type { SearchResultItem } from "@/lib/types";

export interface InsertPartModalCurrentRow {
  id: string;
  symbol: string;
  model: string;
  quantity: number | string;
}

interface InsertPartModalProps {
  items: SearchResultItem[];
  loading?: boolean;
  /** The 部品リスト being built, shown live so the user can check what's already added without closing this modal to look. */
  currentRows?: InsertPartModalCurrentRow[];
  onClose: () => void;
  onInsertBlank: () => void;
  onPick: (item: SearchResultItem) => void;
}

/** 部品リストの任意の行に「空欄」または「部品データから選択」で挿入するためのモーダル — 上に追加/下に追加どちらも同じ中身、呼び出し側が挿入先indexを決める。 */
export function InsertPartModal({ items, loading, currentRows, onClose, onInsertBlank, onPick }: InsertPartModalProps) {
  const { t } = useTranslation();

  function handleDownload(item: SearchResultItem, kind: "dwg" | "pdf") {
    const file = findFileByKind(item.files, kind);
    if (file) openFileAsset(file);
  }

  return (
    <Modal title={t("partAssembly.selectPartModalTitle")} onClose={onClose} widthClassName="max-w-4xl">
      <div className="flex flex-col gap-3">
        {currentRows && currentRows.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-2 p-2.5">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted">
              {t("partAssembly.currentListLabel", { count: currentRows.length })}
            </span>
            <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
              {currentRows.map((r) => (
                <span key={r.id} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted">
                  {r.symbol || r.model || "-"}
                  {String(r.quantity) !== "1" && r.quantity !== "" ? ` ×${r.quantity}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={onInsertBlank} className="btn-secondary self-start">
          {t("partAssembly.insertBlankOption")}
        </button>
        <PartMasterSearch items={items} loading={loading} onDownload={handleDownload} onPick={onPick} />
      </div>
    </Modal>
  );
}
