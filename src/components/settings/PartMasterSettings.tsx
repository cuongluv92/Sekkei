"use client";

import { useTranslation } from "@/lib/i18n";
import { MasterListEditor } from "@/components/design/MasterListEditor";
import { ManufacturerSettings } from "@/components/settings/ManufacturerSettings";

/**
 * 分類・記号・メーカー master editors — shared by every screen that browses
 * or filters by these fields (部品データ・部品図・カタログ), so all three show
 * the same settings content from one place instead of duplicating the CRUD UI.
 */
export function PartMasterSettings() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <MasterListEditor keys={["category", "symbol"]} namespace="partSettings" />
      <div className="border-t border-border pt-4">
        <span className="mb-2 block text-[13px] font-bold text-foreground">
          {t("partSettings.manufacturers.title")}
        </span>
        <ManufacturerSettings />
      </div>
    </div>
  );
}
