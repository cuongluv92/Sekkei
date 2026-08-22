"use client";

import { Suspense } from "react";
import { useTranslation } from "@/lib/i18n";
import { partDrawingService } from "@/lib/services";
import { PartLibraryView } from "@/components/common/PartLibraryView";

function PartDrawingView() {
  const { t } = useTranslation();
  return (
    <PartLibraryView
      title={t("partDrawing.title")}
      description={t("partDrawing.description")}
      emptyMessage={t("partDrawing.tableEmpty")}
      fetchAll={() => partDrawingService.list()}
      ownerType="part_drawing"
      onDelete={(id) => partDrawingService.moveToTrash(id)}
    />
  );
}

export default function PartDrawingPage() {
  return (
    <Suspense fallback={null}>
      <PartDrawingView />
    </Suspense>
  );
}
