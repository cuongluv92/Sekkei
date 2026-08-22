"use client";

import { Suspense } from "react";
import { useTranslation } from "@/lib/i18n";
import { partDataService } from "@/lib/services";
import { PartLibraryView } from "@/components/common/PartLibraryView";

function PartDataView() {
  const { t } = useTranslation();
  return (
    <PartLibraryView
      title={t("partData.title")}
      description={t("partData.description")}
      emptyMessage={t("partData.tableEmpty")}
      fetchAll={() => partDataService.list()}
      ownerType="part_data"
      onDelete={(id) => partDataService.moveToTrash(id)}
      showQuantity
      showPartDataFields
    />
  );
}

export default function PartDataPage() {
  return (
    <Suspense fallback={null}>
      <PartDataView />
    </Suspense>
  );
}
