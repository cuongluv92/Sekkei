"use client";

import { useTranslation } from "@/lib/i18n";
import { partDrawingService } from "@/lib/services";
import { PartLibraryView } from "@/components/common/PartLibraryView";

export default function PartDrawingPage() {
  const { t } = useTranslation();
  return (
    <PartLibraryView
      title={t("partDrawing.title")}
      description={t("partDrawing.description")}
      emptyMessage={t("partDrawing.tableEmpty")}
      fetchAll={() => partDrawingService.list()}
    />
  );
}
