"use client";

import { useTranslation } from "@/lib/i18n";
import { partDataService } from "@/lib/services";
import { PartLibraryView } from "@/components/common/PartLibraryView";

export default function PartDataPage() {
  const { t } = useTranslation();
  return (
    <PartLibraryView
      title={t("partData.title")}
      description={t("partData.description")}
      emptyMessage={t("partData.tableEmpty")}
      fetchAll={() => partDataService.list()}
      ownerType="part_data"
      showQuantity
    />
  );
}
