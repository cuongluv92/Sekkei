"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { weightMaterialService } from "@/lib/services";
import { WEIGHT_SHAPES } from "@/lib/utils/weightShapes";
import { WeightShapeCalcSection } from "@/components/calculation/WeightShapeCalcSection";
import type { WeightMaterial } from "@/lib/types";

/**
 * 基本重量計算 — アングル/チャンネル/フラットバー, one calculation block each. Only
 * these 3 shapes, per the confirmed spec; not a place to add more without
 * an explicit request.
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
