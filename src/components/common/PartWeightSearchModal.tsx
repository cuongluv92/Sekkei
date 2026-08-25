"use client";

import { useTranslation } from "@/lib/i18n";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { Modal } from "@/components/common/Modal";
import { PartMasterSearch } from "@/components/common/PartMasterSearch";
import type { SearchResultItem } from "@/lib/types";

interface PartWeightSearchModalProps {
  items: SearchResultItem[];
  loading?: boolean;
  onClose: () => void;
  onPick: (item: SearchResultItem) => void;
}

/**
 * 部品データを検索して1件だけ選ぶだけの軽量ピッカー — 部品リストへの追加は
 * せず、選んだ品の重量を1つの手入力欄（例: Nittoの箱体重量）に反映したい
 * 場面向け。InsertPartModal (部品リストへの追加専用、空欄追加ボタン付き)
 * とは別の、単一値ピック用の入れ物。
 */
export function PartWeightSearchModal({ items, loading, onClose, onPick }: PartWeightSearchModalProps) {
  const { t } = useTranslation();

  function handleDownload(item: SearchResultItem, kind: "dwg" | "pdf") {
    const file = findFileByKind(item.files, kind);
    if (file) openFileAsset(file);
  }

  return (
    <Modal title={t("partAssembly.selectPartModalTitle")} onClose={onClose} widthClassName="max-w-4xl">
      <PartMasterSearch items={items} loading={loading} onDownload={handleDownload} onPick={onPick} />
    </Modal>
  );
}
