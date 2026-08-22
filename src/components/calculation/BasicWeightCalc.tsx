"use client";

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { weightMaterialService } from "@/lib/services";
import { WEIGHT_SHAPES } from "@/lib/utils/weightShapes";
import { WeightShapeCalcSection } from "@/components/calculation/WeightShapeCalcSection";
import type { WeightMaterial } from "@/lib/types";

function scrollToShape(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 基本重量計算 — intro cards (アングル/チャンネル/フラットバー) that smooth-scroll to
 * their matching calculation block below. Only these 3 shapes, per the
 * confirmed spec; not a place to add more without an explicit request.
 */
export function BasicWeightCalc() {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<WeightMaterial[]>([]);

  useEffect(() => {
    weightMaterialService.list().then(setMaterials);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">{t("weightCalc.basic.description")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WEIGHT_SHAPES.map((shape) => (
          <button
            key={shape.key}
            type="button"
            onClick={() => scrollToShape(`weight-shape-${shape.key}`)}
            className="panel flex flex-col items-center gap-2.5 p-4 text-center transition-colors hover:border-accent hover:bg-surface-hover"
          >
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-2 text-muted-2">
              <ImageIcon className="h-8 w-8" />
            </div>
            <span className="text-[14.5px] font-bold text-foreground">{t(`weightCalc.basic.shapes.${shape.key}`)}</span>
          </button>
        ))}
      </div>

      {materials.length === 0 && (
        <p className="text-[12px] text-warning">{t("weightCalc.basic.noMaterialsWarning")}</p>
      )}

      <div className="flex flex-col gap-4">
        {WEIGHT_SHAPES.map((shape) => (
          <WeightShapeCalcSection key={shape.key} shapeKey={shape.key} materials={materials} />
        ))}
      </div>
    </div>
  );
}
