"use client";

import { Image as ImageIcon, Loader2, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import {
  calculationRecordService,
  weightShapeImageService,
} from "@/lib/services";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { getPublicUrl } from "@/lib/supabase/storage";
import {
  getWeightShape,
  type WeightDimKey,
  type WeightDims,
  type WeightShapeImage,
  type WeightShapeKey,
} from "@/lib/utils/weightShapes";
import { CaseAttachPrompt } from "@/components/common/CaseAttachPrompt";
import type { WeightMaterial } from "@/lib/types";

interface WeightShapeCalcSectionProps {
  shapeKey: WeightShapeKey;
  materials: WeightMaterial[];
  /** True once the 材質 master fetch has resolved (even if it came back empty) — gates the new-calculation 鉄 default so it never fires before we actually know whether 鉄 exists. */
  materialsLoaded: boolean;
  image?: WeightShapeImage;
  onImageChange: (image: WeightShapeImage) => void;
  caseId: string;
}

interface WeightBasicSavedInput {
  materialId?: string;
  density?: string;
  dims?: Partial<Record<WeightDimKey, string>>;
  length?: string;
  quantity?: string;
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
  materialsLoaded,
  image,
  onImageChange,
  caseId,
}: WeightShapeCalcSectionProps) {
  const { t } = useTranslation();
  const { registerSaveHandler, setCaseId } = useActiveCase();
  const shape = getWeightShape(shapeKey);
  const calculationType = `weight-basic-${shapeKey}`;
  const dirtyHandlerId = `weight-basic-${shapeKey}`;
  const draftStorageKey = `sekkei.weightBasicDraft.${shapeKey}`;

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

  // Saved-record load + one-time hydrate-or-default-to-鉄, per 案件.
  const [loadedRecord, setLoadedRecord] = useState<
    { input: WeightBasicSavedInput; updatedAt: string } | null | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [caseAttachPromptOpen, setCaseAttachPromptOpen] = useState(false);
  const initializedRef = useRef(false);

  // 案件 未選択のときは calculation_records ではなくローカル下書き (localStorage)
  // から読み込む — 案件 を選ぶ/作るまでブロックしない。
  useEffect(() => {
    let cancelled = false;
    initializedRef.current = false;
    setLoadedRecord(undefined);
    setSavedAt(null);
    registerSaveHandler(dirtyHandlerId, null);
    if (!caseId) {
      const draft = loadFromStorage<WeightBasicSavedInput | null>(draftStorageKey, null);
      setLoadedRecord(draft ? { input: draft, updatedAt: "" } : null);
      return;
    }
    calculationRecordService.get(caseId, calculationType).then((record) => {
      if (cancelled) return;
      setLoadedRecord(
        record
          ? {
              input: record.input as WeightBasicSavedInput,
              updatedAt: record.updatedAt,
            }
          : null,
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, calculationType]);

  // Unregister this section's save handler on unmount so a stale handler
  // pointing at an old case's data can never be invoked by the switch
  // confirmation later.
  useEffect(
    () => () => registerSaveHandler(dirtyHandlerId, null),
    [dirtyHandlerId, registerSaveHandler],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    // Wait until we know both whether a saved record exists AND whether the
    // 材質 master has loaded — otherwise a new calculation could briefly see
    // an empty `materials` list and skip the 鉄 default entirely.
    if (loadedRecord === undefined || !materialsLoaded) return;
    initializedRef.current = true;

    if (loadedRecord) {
      // Never reset an existing calculation to 鉄 — restore exactly what was saved.
      const saved = loadedRecord.input;
      setMaterialId(saved.materialId ?? "");
      setDensityRaw(saved.density ?? "");
      if (saved.dims) setDimRaw((prev) => ({ ...prev, ...saved.dims }));
      setLengthRaw(saved.length ?? "");
      setQuantityRaw(saved.quantity ?? "1");
      if (loadedRecord.updatedAt) setSavedAt(loadedRecord.updatedAt);
    } else {
      // Brand-new calculation only: default to 鉄, with 比重 read live from
      // the weight_materials master — never a hardcoded number. If 鉄 isn't
      // in the master, leave material/density blank rather than guessing.
      const iron = materials.find((m) => m.name === "鉄");
      if (iron) {
        setMaterialId(iron.id);
        setDensityRaw(String(iron.density));
      }
    }
  }, [loadedRecord, materialsLoaded, materials]);

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
    markDirty();
  }

  function buildInput(): WeightBasicSavedInput {
    return {
      materialId,
      density: densityRaw,
      dims: dimRaw,
      length: lengthRaw,
      quantity: quantityRaw,
    };
  }

  /** Any user edit (material/density/dims/length/quantity) registers this section's save handler — which both marks the page 未保存 and gives the case-switch confirmation's "保存して変更" a real function to call for this specific shape. Only meaningful once a 案件 is attached — while unattached, edits autosave to a local draft instead (see the effect below). */
  function markDirty() {
    if (caseId) registerSaveHandler(dirtyHandlerId, () => handleSave());
  }

  // 案件 未選択の間は、編集のたびにローカル下書きへ即保存。
  useEffect(() => {
    if (caseId || !initializedRef.current) return;
    saveToStorage(draftStorageKey, buildInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, materialId, densityRaw, dimRaw, lengthRaw, quantityRaw]);

  /** 案件 が付いていればそのまま保存、なければ「既存の案件を選ぶ/新規案件を作成」を先に聞く。 */
  function handleSaveClick() {
    if (!caseId) {
      setCaseAttachPromptOpen(true);
      return;
    }
    handleSave();
  }

  async function handleSave(targetCaseId: string = caseId) {
    if (!targetCaseId || saving) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        targetCaseId,
        calculationType,
        buildInput() as unknown as Record<string, unknown>,
        { area, unitWeight, totalWeight },
      );
      setSavedAt(saved.updatedAt);
      registerSaveHandler(dirtyHandlerId, null);
    } finally {
      setSaving(false);
    }
  }

  /** 保存時に選んだ/作った 案件 に、今入力中の内容をそのまま紐付ける。 */
  async function attachToCase(newCaseId: string) {
    setCaseId(newCaseId);
    setCaseAttachPromptOpen(false);
    await handleSave(newCaseId);
    saveToStorage(draftStorageKey, null);
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
          onChange={(e) => {
            setDimRaw((prev) => ({ ...prev, [k]: e.target.value }));
            markDirty();
          }}
          className={dimFieldClass(dimStates[k])}
        />
      </div>
    );
  }

  return (
    <div id={`weight-shape-${shapeKey}`} className="panel scroll-mt-4">
      <div className="panel-header flex items-center justify-between gap-2">
        <span className="panel-title">
          {t(`weightCalc.basic.shapes.${shapeKey}`)}
        </span>
        <div className="flex items-center gap-2">
          {caseId && savedAt && (
            <span className="text-[11px] text-muted-2">
              {t("weightCalc.basic.saved")}{" "}
              {formatJaTime(savedAt)}
            </span>
          )}
          {!caseId && (
            <span className="text-[11px] text-warning">{t("caseSelector.draftNote")}</span>
          )}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="btn-secondary !py-1 !text-[12px]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t("common.save")}
          </button>
        </div>
      </div>
      <div className="panel-body grid grid-cols-1 gap-5 lg:grid-cols-[1fr_38%]">
        {/* Inputs + results, in the confirmed order — below the image on mobile, left of it on desktop */}
        <div className="order-2 flex flex-col gap-3.5 lg:order-1">
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
                onChange={(e) => {
                  setDensityRaw(e.target.value);
                  markDirty();
                }}
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
              {shape.primaryFields[1] && renderDimField(shape.primaryFields[1])}
              <div>
                <label className="mb-1 block text-[11px] text-muted">
                  {t("weightCalc.basic.length")}
                </label>
                <input
                  type="number"
                  step="1"
                  value={lengthRaw}
                  onChange={(e) => {
                    setLengthRaw(e.target.value);
                    markDirty();
                  }}
                  className={
                    lengthState === null
                      ? "field-input !border-danger"
                      : "field-input"
                  }
                />
              </div>
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
              onChange={(e) => {
                setQuantityRaw(e.target.value);
                markDirty();
              }}
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
              value={unitWeight !== null ? `${roundTo(unitWeight, 2)}` : "—"}
              unit="kg"
            />
            <ResultTile
              label={t("weightCalc.basic.totalWeight")}
              value={totalWeight !== null ? `${roundTo(totalWeight, 2)}` : "—"}
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
                  × 10⁻⁶ = {roundTo(unitWeight, 2)} kg
                </span>
              )}
              <span className="mt-1.5">
                {t("weightCalc.basic.totalWeightFormula")}
              </span>
              {totalWeight !== null && (
                <span className="text-foreground">
                  {t("weightCalc.basic.totalWeight")} ={" "}
                  {roundTo(unitWeight as number, 2)} × {quantityState} ={" "}
                  {roundTo(totalWeight, 2)} kg
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Technical drawing — real image once uploaded, otherwise an upload prompt. A compact
            reference thumbnail, not the main visual: fixed, modest frame height (never forces
            the panel taller), image capped to it via object-contain so it's centered and never
            cropped or upscaled past its natural size. Above the inputs on mobile, right of them
            on desktop (see order- classes). */}
        <div className="order-1 flex flex-col gap-1.5 lg:order-2">
          <div className="relative flex h-[240px] w-full items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface-2 p-2 lg:h-[300px]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- real Storage URL, not a static asset next/image can optimize
              <img
                src={getPublicUrl(image.storagePath)}
                alt={t(`weightCalc.basic.shapes.${shapeKey}`)}
                className="max-h-full max-w-full object-contain"
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

      <CaseAttachPrompt
        open={caseAttachPromptOpen}
        onClose={() => setCaseAttachPromptOpen(false)}
        onAttach={attachToCase}
      />
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
