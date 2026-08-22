"use client";

import { useTranslation } from "@/lib/i18n";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { Modal } from "@/components/common/Modal";
import { PartMasterSearch } from "@/components/common/PartMasterSearch";
import type { SearchResultItem } from "@/lib/types";

interface InsertPartModalProps {
  items: SearchResultItem[];
  loading?: boolean;
  onClose: () => void;
  onInsertBlank: () => void;
  onPick: (item: SearchResultItem) => void;
}

/** 部品リストの任意の行に「空欄」または「部品データから選択」で挿入するためのモーダル — 上に追加/下に追加どちらも同じ中身、呼び出し側が挿入先indexを決める。 */
export function InsertPartModal({ items, loading, onClose, onInsertBlank, onPick }: InsertPartModalProps) {
  const { t } = useTranslation();

  function handleDownload(item: SearchResultItem, kind: "dwg" | "pdf") {
    const file = findFileByKind(item.files, kind);
    if (file) openFileAsset(file);
  }

  return (
    <Modal title={t("partAssembly.selectPartModalTitle")} onClose={onClose} widthClassName="max-w-4xl">
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onInsertBlank} className="btn-secondary self-start">
          {t("partAssembly.insertBlankOption")}
        </button>
        <PartMasterSearch items={items} loading={loading} onDownload={handleDownload} onPick={onPick} />
      </div>
    </Modal>
  );
}
