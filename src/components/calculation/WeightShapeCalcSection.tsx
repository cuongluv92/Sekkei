"use client";

import { Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { weightShapeImageService } from "@/lib/services";
import { getPublicUrl } from "@/lib/supabase/storage";
import {
  getWeightShape,
  type WeightDimKey,
  type WeightDims,
  type WeightShapeImage,
  type WeightShapeKey,
} from "@/lib/utils/weightShapes";
import type { WeightMaterial } from "@/lib/types";

interface WeightShapeCalcSectionProps {
  shapeKey: WeightShapeKey;
  materials: WeightMaterial[];
  image?: WeightShapeImage;
  onImageChange: (image: WeightShapeImage) => void;
}

/** "" (untouched) | a positive finite number | null (typed but invalid — 0, negative, or not a number). */
function parseField(raw: string): number | null | "" {
  if (raw.trim() === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * One shape's full calculation block (image + inputs + live results), per
 * the confirmed layout: [材質, 比重] row → [primary dim, 長さL, primary dim]
 * row → [secondary/thickness dims] row → 数量N → 断面積 → 1個重量 → 合計重量 →
 * 計算式, all recomputed on every keystroke, no 計算 button. Driven entirely
 * by the shape's WeightShapeDef (weightShapes.ts) so アングル/チャンネル/
 * フラットバー/ハット形 share this one component instead of being
 * quadruplicated.
 */
export function WeightShapeCalcSection({
  shapeKey,
  materials,
  image,
  onImageChange,
}: WeightShapeCalcSectionProps) {
  const { t } = useTranslation();
  const shape = getWeightShape(shapeKey);

  const [dimRaw, setDimRaw] = useState<Record<WeightDimKey, string>>({
    W: "",
    H: "",
    t1: "",
    t2: "",
    W1: "",
    W2: "",
    t: "",
  });
  const [lengthRaw, setLengthRaw] = useState("");
  const [quantityRaw, setQuantityRaw] = useState("1");
  const [materialId, setMaterialId] = useState("");
  const [densityRaw, setDensityRaw] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    setImageError(null);
    try {
      const uploaded = await weightShapeImageService.upload(shapeKey, file);
      onImageChange(uploaded);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setImageError(detail);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleMaterialChange(id: string) {
    setMaterialId(id);
    const material = materials.find((m) => m.id === id);
    setDensityRaw(material ? String(material.density) : "");
  }

  const dimStates = useMemo(
    () =>
      Object.fromEntries(
        shape.fields.map((k) => [k, parseField(dimRaw[k])]),
      ) as Partial<Record<WeightDimKey, number | null | "">>,
    [shape.fields, dimRaw],
  );
  const lengthState = parseField(lengthRaw);
  const quantityState = parseField(quantityRaw);
  const densityState = parseField(densityRaw);

  const dimsValid = shape.fields.every((k) => typeof dimStates[k] === "number");
  const lengthValid = typeof lengthState === "number";
  const quantityValid = typeof quantityState === "number";
  const densityValid = typeof densityState === "number";

  const dims: WeightDims = {
    W: typeof dimStates.W === "number" ? dimStates.W : 0,
    H: typeof dimStates.H === "number" ? dimStates.H : 0,
    t1: typeof dimStates.t1 === "number" ? dimStates.t1 : 0,
    t2: typeof dimStates.t2 === "number" ? dimStates.t2 : 0,
    W1: typeof dimStates.W1 === "number" ? dimStates.W1 : 0,
    W2: typeof dimStates.W2 === "number" ? dimStates.W2 : 0,
    t: typeof dimStates.t === "number" ? dimStates.t : 0,
  };

  const area = dimsValid ? shape.computeArea(dims) : null;
  const unitWeight =
    area !== null && lengthValid && densityValid
      ? (area * (lengthState as number) * (densityState as number)) / 1e6
      : null;
  const totalWeight =
    unitWeight !== null && quantityValid
      ? unitWeight * (quantityState as number)
      : null;

  const missingMaterial = !densityValid;

  function dimFieldClass(state: number | null | "" | undefined): string {
    return state === null ? "field-input !border-danger" : "field-input";
  }

  function renderDimField(k: WeightDimKey) {
    return (
      <div key={k}>
        <label className="mb-1 block text-[11px] text-muted">
          {t(`weightCalc.basic.fields.${shapeKey}.${k}`)}
        </label>
        <input
          type="number"
          step="0.1"
          value={dimRaw[k]}
          onChange={(e) =>
            setDimRaw((prev) => ({ ...prev, [k]: e.target.value }))
          }
          className={dimFieldClass(dimStates[k])}
        />
      </div>
    );
  }

  return (
    <div id={`weight-shape-${shapeKey}`} className="panel scroll-mt-4">
      <div className="panel-header">
        <span className="panel-title">
          {t(`weightCalc.basic.shapes.${shapeKey}`)}
        </span>
      </div>
      <div className="panel-body grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: inputs + results, in the confirmed order */}
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="field-label">
                {t("weightCalc.basic.material")}
              </label>
              <select
                value={materialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="field-input"
              >
                <option value="">
                  {t("weightCalc.basic.materialPlaceholder")}
                </option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">
                {t("weightCalc.basic.density")}
              </label>
              <input
                type="number"
                step="0.01"
                value={densityRaw}
                onChange={(e) => setDensityRaw(e.target.value)}
                placeholder="7.85"
                className={
                  densityState === null
                    ? "field-input !border-danger"
                    : "field-input"
                }
              />
            </div>
          </div>

          <div>
            <span className="field-label">
              {t("weightCalc.basic.dimensions")}
            </span>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {renderDimField(shape.primaryFields[0])}
              <div>
                <label className="mb-1 block text-[11px] text-muted">
                  {t("weightCalc.basic.length")}
                </label>
                <input
                  type="number"
                  step="1"
                  value={lengthRaw}
                  onChange={(e) => setLengthRaw(e.target.value)}
                  className={
                    lengthState === null
                      ? "field-input !border-danger"
                      : "field-input"
                  }
                />
              </div>
              {shape.primaryFields[1] && renderDimField(shape.primaryFields[1])}
            </div>
            {shape.secondaryFields.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {shape.secondaryFields.map((k) => renderDimField(k))}
              </div>
            )}
          </div>

          <div>
            <label className="field-label">
              {t("weightCalc.basic.quantity")}
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={quantityRaw}
              onChange={(e) => setQuantityRaw(e.target.value)}
              className={
                quantityState === null
                  ? "field-input !border-danger"
                  : "field-input"
              }
            />
          </div>

          {shape.fields.some((k) => dimStates[k] === null) ||
          lengthState === null ||
          quantityState === null ||
          densityState === null ? (
            <p className="text-[11.5px] text-danger">
              {t("weightCalc.basic.invalidInput")}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-2.5 border-t border-border pt-3.5">
            <ResultTile
              label={t("weightCalc.basic.sectionArea")}
              value={area !== null ? `${roundTo(area, 2)}` : "—"}
              unit="mm²"
            />
            <ResultTile
              label={t("weightCalc.basic.unitWeight")}
              value={unitWeight !== null ? `${roundTo(unitWeight, 3)}` : "—"}
              unit="kg"
            />
            <ResultTile
              label={t("weightCalc.basic.totalWeight")}
              value={totalWeight !== null ? `${roundTo(totalWeight, 3)}` : "—"}
              unit="kg"
              emphasize
            />
          </div>
          {missingMaterial && area !== null && (
            <p className="text-[11.5px] text-muted-2">
              {t("weightCalc.basic.noMaterial")}
            </p>
          )}

          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <span className="field-label">{t("weightCalc.basic.formula")}</span>
            <div className="flex flex-col gap-1 font-mono text-[12px] text-muted">
              <span>{shape.areaFormulaSymbolic}</span>
              {dimsValid && (
                <span className="text-foreground">
                  {shape.areaFormulaSubstituted(dims)} ={" "}
                  {roundTo(area as number, 2)} mm²
                </span>
              )}
              <span className="mt-1.5">
                {t("weightCalc.basic.unitWeightFormula")}
              </span>
              {unitWeight !== null && (
                <span className="text-foreground">
                  {t("weightCalc.basic.unitWeight")} ={" "}
                  {roundTo(area as number, 2)} × {lengthState} × {densityState}{" "}
                  × 10⁻⁶ = {roundTo(unitWeight, 3)} kg
                </span>
              )}
              <span className="mt-1.5">
                {t("weightCalc.basic.totalWeightFormula")}
              </span>
              {totalWeight !== null && (
                <span className="text-foreground">
                  {t("weightCalc.basic.totalWeight")} ={" "}
                  {roundTo(unitWeight as number, 3)} × {quantityState} ={" "}
                  {roundTo(totalWeight, 3)} kg
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: technical drawing — real image once uploaded, otherwise an upload prompt */}
        <div className="flex flex-col gap-1.5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border-strong bg-surface-2 lg:aspect-auto lg:min-h-[320px]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- real Storage URL, not a static asset next/image can optimize
              <img
                src={getPublicUrl(image.storagePath)}
                alt={t(`weightCalc.basic.shapes.${shapeKey}`)}
                className="h-full w-full object-contain p-3"
              />
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border-strong text-muted-2 transition-colors hover:border-accent hover:text-muted"
              >
                {uploadingImage ? (
                  <Loader2 className="h-9 w-9 animate-spin" />
                ) : (
                  <ImageIcon className="h-9 w-9" />
                )}
                <span className="max-w-[240px] text-center text-[12px]">
                  {t("weightCalc.basic.imagePlaceholder")}
                </span>
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
                  <Upload className="h-3 w-3" />
                  {t("common.upload")}
                </span>
              </button>
            )}
            {image && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="btn-secondary absolute top-2 right-2 !py-1 !text-[11.5px]"
              >
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {t("common.upload")}
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp,.gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>
          {imageError && (
            <p className="text-[11.5px] text-danger">
              {t("weightCalc.basic.imageUploadError")}
              {": "}
              {imageError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  unit,
  emphasize,
}: {
  label: string;
  value: string;
  unit: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[10.5px] tracking-wide text-muted uppercase">
        {label}
      </div>
      <div
        className={
          emphasize
            ? "mt-0.5 text-[17px] font-bold text-accent"
            : "mt-0.5 text-[15px] font-bold text-foreground"
        }
      >
        {value}{" "}
        <span className="text-[11px] font-normal text-muted">{unit}</span>
      </div>
    </div>
  );
}
