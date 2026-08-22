"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { weightMaterialService, weightShapeImageService } from "@/lib/services";
import {
  WEIGHT_SHAPES,
  type WeightShapeImage,
  type WeightShapeKey,
} from "@/lib/utils/weightShapes";
import { WeightShapeCalcSection } from "@/components/calculation/WeightShapeCalcSection";
import type { WeightMaterial } from "@/lib/types";

/**
 * 基本重量計算 — アングル/チャンネル/フラットバー, one calculation block each. Only
 * these 3 shapes, per the confirmed spec; not a place to add more without
 * an explicit request.
 */
export function BasicWeightCalc({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<WeightMaterial[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [images, setImages] = useState<
    Partial<Record<WeightShapeKey, WeightShapeImage>>
  >({});

  useEffect(() => {
    weightMaterialService.list().then((list) => {
      setMaterials(list);
      setMaterialsLoaded(true);
    });
    weightShapeImageService.list().then((list) => {
      setImages(Object.fromEntries(list.map((img) => [img.shapeKey, img])));
    });
  }, []);

  function handleImageChange(
    shapeKey: WeightShapeKey,
    image: WeightShapeImage,
  ) {
    setImages((prev) => ({ ...prev, [shapeKey]: image }));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        {t("weightCalc.basic.description")}
      </p>

      {materials.length === 0 && (
        <p className="text-[12px] text-warning">
          {t("weightCalc.basic.noMaterialsWarning")}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {WEIGHT_SHAPES.map((shape) => (
          <WeightShapeCalcSection
            key={shape.key}
            shapeKey={shape.key}
            materials={materials}
            materialsLoaded={materialsLoaded}
            image={images[shape.key]}
            onImageChange={(image) => handleImageChange(shape.key, image)}
            caseId={caseId}
          />
        ))}
      </div>
    </div>
  );
}
