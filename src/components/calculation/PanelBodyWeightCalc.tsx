"use client";

import { Image as ImageIcon, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import {
  calculationRecordService,
  panelWeightLayerImageService,
  searchService,
  weightMaterialService,
} from "@/lib/services";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { getPublicUrl } from "@/lib/supabase/storage";
import { getWeightShape, WEIGHT_SHAPES, type WeightDimKey, type WeightShapeKey } from "@/lib/utils/weightShapes";
import { NewCaseModal } from "@/components/common/NewCaseModal";
import { SavedCasesModal } from "@/components/common/SavedCasesModal";
import {
  BOX_FACE_KEYS,
  boxFaceArea,
  busbarWeightKg,
  foldedPlateArea,
  PANEL_IMAGE_KEYS,
  ROOF_FACE_KEYS,
  roofFaceArea,
  sheetWeightKg,
  woodWeightKg,
  type BoxFaceKey,
  type PanelImageKey,
  type PanelLayerKey,
  type RoofFaceKey,
} from "@/lib/utils/panelWeight";
import type { PanelWeightLayerImage } from "@/lib/services/panelWeightLayerImageService";
import { InsertPartModal } from "@/components/common/InsertPartModal";
import type { SearchResultItem, WeightMaterial } from "@/lib/types";

const CALCULATION_TYPE = "weight-panel-body";
const DIRTY_HANDLER_ID = "weight-panel-body";

// ---- Row shapes (opaque JSON persisted via calculationRecordService — see WeightShapeCalcSection's identical precedent) ----

interface SheetItem {
  id: string;
  W: string;
  H: string;
  /** 折り返し奥行き T (mm) — the fold's protrusion depth, distinct from 板厚 t. */
  T: string;
  materialId: string;
  density: string;
  /** 板厚 t (mm). */
  t: string;
  quantity: string;
  manualWeight: string;
}

interface FlatItem {
  id: string;
  W: string;
  H: string;
  materialId: string;
  density: string;
  t: string;
  quantity: string;
  manualWeight: string;
}

interface BusbarItem {
  id: string;
  W: string;
  L: string;
  materialId: string;
  density: string;
  t: string;
  quantity: string;
  manualWeight: string;
}

interface PartItem {
  id: string;
  symbol: string;
  name: string;
  model: string;
  /** From 部品データ.weight — "" means not registered in the master. */
  masterWeight: string;
  quantity: string;
  manualWeight: string;
  sourceRefId?: string;
  sourceType?: "part-data" | "part-drawing" | "catalog";
}

interface AdditionalItem {
  id: string;
  shapeKey: WeightShapeKey;
  dims: Partial<Record<WeightDimKey, string>>;
  length: string;
  materialId: string;
  density: string;
  quantity: string;
  manualWeight: string;
}

interface FaceState {
  included: boolean;
  manualWeight: string;
}
type BoxFaces = Record<BoxFaceKey, FaceState>;
type RoofFaces = Record<RoofFaceKey, FaceState>;

interface BoxState {
  W: string;
  H: string;
  D: string;
  materialId: string;
  density: string;
  t: string;
  /** 5面 (背面/天面/底面/左側面/右側面, 前面は扉が別途担当) — 実物によって存在する面が違うため個別に含める/含めないを選ぶ。 */
  faces: BoxFaces;
}

interface RoofState {
  Droof: string;
  Hroof: string;
  materialId: string;
  density: string;
  // 板厚は 箱体 の t をそのまま使う (別入力なし) — 屋根だけ違う板厚にする実物はまず無いため。
  /** 5面 (天面/前後左右スカート) — 個別に表示・手動重量で上書きできる。 */
  faces: RoofFaces;
}

interface PanelBodySavedInput {
  layer: PanelLayerKey;
  box: BoxState;
  nittoBoxWeight: string;
  nittoBoxQuantity: string;
  roof: RoofState;
  doors: SheetItem[];
  subPlates: SheetItem[];
  protectionPlates: SheetItem[];
  hardware: SheetItem[];
  frames: AdditionalItem[];
  busbars: BusbarItem[];
  parts: PartItem[];
  woods: FlatItem[];
  additional: AdditionalItem[];
  wiringFactor: "1" | "1.2" | "1.5";
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `pw-${Date.now()}-${idCounter}`;
}

/**
 * Looks up a material by name in the (already-loaded) material master and
 * returns its id+density, or blank if not found/not loaded yet — never a
 * guessed density. Used to default new rows to the material that's
 * obviously always right for that group (鉄 for sheet metal, 銅 for 銅帯,
 * 木材 for 木材), same "auto-fill but still editable" pattern
 * WeightShapeCalcSection already uses for defaulting to 鉄.
 */
function defaultMaterial(materials: WeightMaterial[], name: string): { materialId: string; density: string } {
  const m = materials.find((mm) => mm.name === name);
  return m ? { materialId: m.id, density: String(m.density) } : { materialId: "", density: "" };
}

function blankSheetItem(materials: WeightMaterial[], defaultThickness: string, seed?: { W: string; H: string }): SheetItem {
  return {
    id: nextId(),
    W: seed?.W ?? "",
    H: seed?.H ?? "",
    T: "",
    ...defaultMaterial(materials, "鉄"),
    t: defaultThickness,
    quantity: "1",
    manualWeight: "",
  };
}
function blankFlatItem(materials: WeightMaterial[], materialName: string): FlatItem {
  return { id: nextId(), W: "", H: "", ...defaultMaterial(materials, materialName), t: "", quantity: "1", manualWeight: "" };
}
function blankBusbarItem(materials: WeightMaterial[]): BusbarItem {
  return { id: nextId(), W: "", L: "", ...defaultMaterial(materials, "銅"), t: "", quantity: "1", manualWeight: "" };
}
function blankAdditionalItem(materials: WeightMaterial[]): AdditionalItem {
  return {
    id: nextId(),
    shapeKey: "angle",
    dims: {},
    length: "",
    ...defaultMaterial(materials, "鉄"),
    quantity: "1",
    manualWeight: "",
  };
}
/** 架台 — 基本重量計算のハット形と全く同じ入力・計算式 (A = t×(W1+2×W2+2×H)) を再利用。 */
function blankFrameItem(materials: WeightMaterial[]): AdditionalItem {
  return { ...blankAdditionalItem(materials), shapeKey: "hat" };
}
/**
 * Box faces default to all-included except 天面 (top) for 屋外盤 — a typical
 * 屋外盤 has 屋根 cover the top instead, but some real cabinets have both a
 * box top face AND a 屋根 above it, or only 屋根 with no box top at all, so
 * this default is just a starting point the user can flip either way.
 */
function blankBoxFaces(layer: PanelLayerKey): BoxFaces {
  return Object.fromEntries(
    BOX_FACE_KEYS.map((key) => [
      key,
      { included: key === "top" ? layer !== "outdoor" : true, manualWeight: "" },
    ]),
  ) as BoxFaces;
}
function blankBox(materials: WeightMaterial[], layer: PanelLayerKey): BoxState {
  return { W: "", H: "", D: "", ...defaultMaterial(materials, "鉄"), t: "2.3", faces: blankBoxFaces(layer) };
}
function blankRoofFaces(): RoofFaces {
  return Object.fromEntries(ROOF_FACE_KEYS.map((key) => [key, { included: true, manualWeight: "" }])) as RoofFaces;
}
/** 屋根 has no 板厚 of its own — it always uses 箱体 の t (see roofFaceWeight). */
function blankRoof(materials: WeightMaterial[]): RoofState {
  return { Droof: "", Hroof: "", ...defaultMaterial(materials, "鉄"), faces: blankRoofFaces() };
}

/** "" (untouched) | a positive finite number | null (typed but invalid). */
function parseNum(raw: string): number | null | "" {
  if (raw.trim() === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function num(raw: string): number {
  const n = parseNum(raw);
  return typeof n === "number" ? n : 0;
}
function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

const DRAFT_STORAGE_KEY = "sekkei.panelWeightDraft";

export function PanelBodyWeightCalc({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { registerSaveHandler, setCaseId } = useActiveCase();

  const [materials, setMaterials] = useState<WeightMaterial[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [images, setImages] = useState<Partial<Record<PanelImageKey, PanelWeightLayerImage>>>({});
  const [masterItems, setMasterItems] = useState<SearchResultItem[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  const [layer, setLayer] = useState<PanelLayerKey>("indoor");
  const [activeImageKey, setActiveImageKey] = useState<PanelImageKey>("indoor");
  const [box, setBox] = useState<BoxState>(blankBox([], "indoor"));
  const [nittoBoxWeight, setNittoBoxWeight] = useState("");
  const [nittoBoxQuantity, setNittoBoxQuantity] = useState("1");
  const [roof, setRoof] = useState<RoofState>(blankRoof([]));
  const [doors, setDoors] = useState<SheetItem[]>([]);
  const [subPlates, setSubPlates] = useState<SheetItem[]>([]);
  const [protectionPlates, setProtectionPlates] = useState<SheetItem[]>([]);
  const [hardware, setHardware] = useState<SheetItem[]>([]);
  const [frames, setFrames] = useState<AdditionalItem[]>([]);
  const [busbars, setBusbars] = useState<BusbarItem[]>([]);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [woods, setWoods] = useState<FlatItem[]>([]);
  const [additional, setAdditional] = useState<AdditionalItem[]>([]);
  const [wiringFactor, setWiringFactor] = useState<"1" | "1.2" | "1.5">("1");
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [caseAttachPromptOpen, setCaseAttachPromptOpen] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showSavedCasesModal, setShowSavedCasesModal] = useState(false);

  const [loadedRecord, setLoadedRecord] = useState<PanelBodySavedInput | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    weightMaterialService.list().then((list) => {
      setMaterials(list);
      setMaterialsLoaded(true);
    });
    panelWeightLayerImageService.list().then((list) => {
      setImages(Object.fromEntries(list.map((img) => [img.layerKey, img])));
    });
    searchService.listAll().then((list) => {
      setMasterItems(list);
      setMasterLoading(false);
    });
  }, []);

  useEffect(() => {
    setActiveImageKey(layer);
  }, [layer]);

  // 案件 未選択のときは calculation_records ではなくローカル下書き
  // (localStorage) から読み込む — 案件 を選ぶ/作るまでブロックしない (盤重量計算
  // だけの試験的な挙動、他の計算モジュールはまだ従来通り)。
  useEffect(() => {
    initializedRef.current = false;
    setLoadedRecord(undefined);
    setSavedAt(null);
    registerSaveHandler(DIRTY_HANDLER_ID, null);
    if (!caseId) {
      const draft = loadFromStorage<PanelBodySavedInput | null>(DRAFT_STORAGE_KEY, null);
      setLoadedRecord(draft);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      setLoadedRecord(record ? (record.input as unknown as PanelBodySavedInput) : null);
      if (record) setSavedAt(record.updatedAt);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => () => registerSaveHandler(DIRTY_HANDLER_ID, null), [registerSaveHandler]);

  useEffect(() => {
    if (initializedRef.current || loadedRecord === undefined || !materialsLoaded) return;
    initializedRef.current = true;
    if (!loadedRecord) {
      // 新規計算のみ鉄/銅/木材をデフォルトにする — 保存済みデータは絶対に上書きしない。
      setBox(blankBox(materials, layer));
      setRoof(blankRoof(materials));
      return;
    }
    const restoredLayer = loadedRecord.layer ?? "indoor";
    setLayer(restoredLayer);
    setBox(loadedRecord.box ?? blankBox(materials, restoredLayer));
    setNittoBoxWeight(loadedRecord.nittoBoxWeight ?? "");
    setNittoBoxQuantity(loadedRecord.nittoBoxQuantity ?? "1");
    setRoof(loadedRecord.roof ?? blankRoof(materials));
    setDoors(loadedRecord.doors ?? []);
    setSubPlates(loadedRecord.subPlates ?? []);
    setProtectionPlates(loadedRecord.protectionPlates ?? []);
    setHardware(loadedRecord.hardware ?? []);
    setFrames(loadedRecord.frames ?? []);
    setBusbars(loadedRecord.busbars ?? []);
    setParts(loadedRecord.parts ?? []);
    setWoods(loadedRecord.woods ?? []);
    setAdditional(loadedRecord.additional ?? []);
    setWiringFactor(loadedRecord.wiringFactor ?? "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedRecord, materialsLoaded]);

  function buildInput(): PanelBodySavedInput {
    return {
      layer,
      box,
      nittoBoxWeight,
      nittoBoxQuantity,
      roof,
      doors,
      subPlates,
      protectionPlates,
      hardware,
      frames,
      busbars,
      parts,
      woods,
      additional,
      wiringFactor,
    };
  }

  // 案件 未選択の間は、編集のたびにローカル下書きへ即保存 — 案件 に紐付いて
  // いないので registerSaveHandler の「未保存」扱いは不要 (もう安全にブラウザ側へ
  // 保持されている)。初期化が終わるまでは書き込まない (空の初期状態で
  // 下書きを消してしまわないように)。
  useEffect(() => {
    if (caseId || !initializedRef.current) return;
    saveToStorage(DRAFT_STORAGE_KEY, buildInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    caseId,
    layer,
    box,
    nittoBoxWeight,
    nittoBoxQuantity,
    roof,
    doors,
    subPlates,
    protectionPlates,
    hardware,
    frames,
    busbars,
    parts,
    woods,
    additional,
    wiringFactor,
  ]);

  function markDirty() {
    if (caseId) registerSaveHandler(DIRTY_HANDLER_ID, () => handleSave(caseId));
  }

  /** 案件 が付いていればそのまま保存、なければ「既存の案件を選ぶ/新規案件を作成」を先に聞く。 */
  function handleSaveClick() {
    if (!caseId) {
      setCaseAttachPromptOpen(true);
      return;
    }
    handleSave(caseId);
  }

  async function handleSave(targetCaseId: string) {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        targetCaseId,
        CALCULATION_TYPE,
        buildInput() as unknown as Record<string, unknown>,
        { totalWeight },
      );
      setSavedAt(saved.updatedAt);
      registerSaveHandler(DIRTY_HANDLER_ID, null);
    } finally {
      setSaving(false);
    }
  }

  /** 保存時に選んだ/作った 案件 に、今入力中の内容をそのまま紐付ける — 案件 をアプリ全体の現在の 案件 にもする。 */
  async function attachToCase(newCaseId: string) {
    setCaseId(newCaseId);
    setCaseAttachPromptOpen(false);
    setShowNewCaseModal(false);
    setShowSavedCasesModal(false);
    await handleSave(newCaseId);
    saveToStorage(DRAFT_STORAGE_KEY, null);
  }

  async function handleImageUpload(key: PanelImageKey, file: File) {
    const uploaded = await panelWeightLayerImageService.upload(key, file);
    setImages((prev) => ({ ...prev, [key]: uploaded }));
  }

  // ---- Weight calculations ----

  function boxFaceWeight(face: BoxFaceKey): number {
    const state = box.faces[face];
    if (!state.included) return 0;
    if (state.manualWeight.trim() !== "") return num(state.manualWeight);
    const area = boxFaceArea(face, num(box.W), num(box.H), num(box.D));
    return sheetWeightKg(area, num(box.t), num(box.density));
  }
  const boxWeight =
    layer === "nitto"
      ? num(nittoBoxWeight) * num(nittoBoxQuantity)
      : BOX_FACE_KEYS.reduce((sum, f) => sum + boxFaceWeight(f), 0);

  function roofFaceWeight(face: RoofFaceKey): number {
    const state = roof.faces[face];
    if (!state.included) return 0;
    if (state.manualWeight.trim() !== "") return num(state.manualWeight);
    const area = roofFaceArea(face, num(box.W), num(roof.Droof), num(roof.Hroof));
    return sheetWeightKg(area, num(box.t), num(roof.density));
  }
  const roofWeight =
    layer !== "outdoor" ? 0 : ROOF_FACE_KEYS.reduce((sum, f) => sum + roofFaceWeight(f), 0);

  function sheetItemWeight(item: SheetItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    const area = foldedPlateArea(num(item.W), num(item.H), num(item.T));
    return sheetWeightKg(area, num(item.t), num(item.density)) * num(item.quantity);
  }
  function flatItemWeight(item: FlatItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    return woodWeightKg(num(item.W), num(item.H), num(item.t), num(item.density)) * num(item.quantity);
  }
  function busbarItemWeight(item: BusbarItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    return busbarWeightKg(num(item.W), num(item.L), num(item.t), num(item.density)) * num(item.quantity);
  }
  function partItemWeight(item: PartItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    if (item.masterWeight.trim() === "") return 0;
    return num(item.masterWeight) * num(item.quantity);
  }
  function additionalItemWeight(item: AdditionalItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    const shape = getWeightShape(item.shapeKey);
    const dims = Object.fromEntries(shape.fields.map((k) => [k, num(item.dims[k] ?? "")])) as Record<
      WeightDimKey,
      number
    >;
    if (!shape.fields.every((k) => dims[k] > 0)) return 0;
    const area = shape.computeArea(dims);
    return (area * num(item.length) * num(item.density) * num(item.quantity)) / 1_000_000;
  }

  const doorsWeight = doors.reduce((sum, i) => sum + sheetItemWeight(i), 0);
  const subPlatesWeight = subPlates.reduce((sum, i) => sum + sheetItemWeight(i), 0);
  const protectionPlatesWeight = protectionPlates.reduce((sum, i) => sum + sheetItemWeight(i), 0);
  const hardwareWeight = hardware.reduce((sum, i) => sum + sheetItemWeight(i), 0);
  const busbarsWeight = busbars.reduce((sum, i) => sum + busbarItemWeight(i), 0);
  const partsWeight = parts.reduce((sum, i) => sum + partItemWeight(i), 0);
  const woodsWeight = woods.reduce((sum, i) => sum + flatItemWeight(i), 0);
  const additionalWeight = additional.reduce((sum, i) => sum + additionalItemWeight(i), 0);
  const framesWeight = frames.reduce((sum, i) => sum + additionalItemWeight(i), 0);

  const totalWeight =
    boxWeight +
    roofWeight +
    doorsWeight +
    subPlatesWeight +
    protectionPlatesWeight +
    hardwareWeight +
    framesWeight +
    busbarsWeight +
    partsWeight +
    woodsWeight +
    additionalWeight;

  const factorMultiplier = wiringFactor === "1" ? 1 : wiringFactor === "1.2" ? 1.2 : 1.5;
  const correctedWeight = totalWeight * factorMultiplier;

  const activeImage = images[activeImageKey];

  function updateBox(patch: Partial<BoxState>) {
    setBox((prev) => ({ ...prev, ...patch }));
    markDirty();
  }
  function updateRoof(patch: Partial<RoofState>) {
    setRoof((prev) => ({ ...prev, ...patch }));
    markDirty();
  }
  function updateBoxFace(face: BoxFaceKey, patch: Partial<FaceState>) {
    setBox((prev) => ({ ...prev, faces: { ...prev.faces, [face]: { ...prev.faces[face], ...patch } } }));
    markDirty();
  }
  function updateRoofFace(face: RoofFaceKey, patch: Partial<FaceState>) {
    setRoof((prev) => ({ ...prev, faces: { ...prev.faces, [face]: { ...prev.faces[face], ...patch } } }));
    markDirty();
  }

  function pickMaterial(materialId: string): { materialId: string; density: string } {
    const m = materials.find((mm) => mm.id === materialId);
    return { materialId, density: m ? String(m.density) : "" };
  }

  function handlePickPart(item: SearchResultItem) {
    setParts((prev) => [
      ...prev,
      {
        id: nextId(),
        symbol: item.symbol ?? "",
        name: item.category,
        model: item.model,
        masterWeight: item.weight != null ? String(item.weight) : "",
        quantity: "1",
        manualWeight: "",
        sourceRefId: item.id,
        sourceType: item.source,
      },
    ]);
    setPartsModalOpen(false);
    markDirty();
  }
  function handleInsertBlankPart() {
    setParts((prev) => [
      ...prev,
      { id: nextId(), symbol: "", name: "", model: "", masterWeight: "", quantity: "1", manualWeight: "" },
    ]);
    setPartsModalOpen(false);
    markDirty();
  }

  return (
    <div id="weight-panel-body" className="panel scroll-mt-4">
      <div className="panel-header flex items-center justify-between gap-2">
        <span className="panel-title">{t("weightCalc.panel.body.title")}</span>
        <div className="flex items-center gap-2">
          {caseId && savedAt && (
            <span className="text-[11px] text-muted-2">
              {t("weightCalc.basic.saved")} {formatJaTime(savedAt)}
            </span>
          )}
          {!caseId && (
            <span className="text-[11px] text-warning">{t("weightCalc.panel.body.draftNote")}</span>
          )}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="btn-secondary !py-1 !text-[12px]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="panel-body grid grid-cols-1 gap-5 lg:grid-cols-[62%_1fr]">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          {/* 屋内/屋外/Nitto */}
          <div>
            <span className="field-label">{t("weightCalc.panel.body.layerLabel")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(["indoor", "outdoor", "nitto"] as PanelLayerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setLayer(key);
                    markDirty();
                  }}
                  className={
                    layer === key
                      ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                      : "rounded-md border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                  }
                >
                  {t(`weightCalc.panel.body.layer.${key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 箱体 */}
          <GroupCard title={t(`weightCalc.panel.body.groups.box`)} weight={boxWeight}>
            {layer === "nitto" ? (
              <div className="grid grid-cols-2 gap-2.5">
                <NumField
                  label={t("weightCalc.panel.body.fields.nittoBoxWeight")}
                  value={nittoBoxWeight}
                  onChange={(v) => {
                    setNittoBoxWeight(v);
                    markDirty();
                  }}
                />
                <NumField
                  label={t("weightCalc.basic.quantity")}
                  value={nittoBoxQuantity}
                  onChange={(v) => {
                    setNittoBoxQuantity(v);
                    markDirty();
                  }}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <NumField label="W" value={box.W} onChange={(v) => updateBox({ W: v })} compact />
                  <NumField label="H" value={box.H} onChange={(v) => updateBox({ H: v })} compact />
                  <NumField label="D" value={box.D} onChange={(v) => updateBox({ D: v })} compact />
                  <MaterialRow
                    materials={materials}
                    materialId={box.materialId}
                    density={box.density}
                    onChange={(patch) => updateBox(patch)}
                  />
                  <NumField
                    label={t("weightCalc.panel.body.fields.thickness")}
                    value={box.t}
                    onChange={(v) => updateBox({ t: v })}
                    compact
                  />
                </div>

                <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
                  <span className="text-[11px] text-muted-2">{t("weightCalc.panel.body.facesNote")}</span>
                  {BOX_FACE_KEYS.map((face) => (
                    <FaceRow
                      key={face}
                      label={t(`weightCalc.panel.body.boxFaces.${face}`)}
                      formulaLabel={t(`weightCalc.panel.body.boxFaceFormula.${face}`)}
                      areaMm2={boxFaceArea(face, num(box.W), num(box.H), num(box.D))}
                      state={box.faces[face]}
                      weight={boxFaceWeight(face)}
                      onChange={(patch) => updateBoxFace(face, patch)}
                    />
                  ))}
                </div>
              </>
            )}
          </GroupCard>

          {/* 屋根 (屋外のみ) */}
          {layer === "outdoor" && (
            <GroupCard title={t("weightCalc.panel.body.groups.roof")} weight={roofWeight}>
              <p className="text-[11px] text-muted-2">
                {t("weightCalc.panel.body.roofWidthNote", { W: box.W || "—" })}
                {" "}
                {t("weightCalc.panel.body.roofThicknessNote", { t: box.t || "—" })}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <NumField
                  label={t("weightCalc.panel.body.fields.droof")}
                  value={roof.Droof}
                  onChange={(v) => updateRoof({ Droof: v })}
                  compact
                />
                <NumField
                  label={t("weightCalc.panel.body.fields.hroof")}
                  value={roof.Hroof}
                  onChange={(v) => updateRoof({ Hroof: v })}
                  compact
                />
                <MaterialRow
                  materials={materials}
                  materialId={roof.materialId}
                  density={roof.density}
                  onChange={(patch) => updateRoof(patch)}
                />
              </div>

              <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
                <span className="text-[11px] text-muted-2">{t("weightCalc.panel.body.facesNote")}</span>
                {ROOF_FACE_KEYS.map((face) => (
                  <FaceRow
                    key={face}
                    label={t(`weightCalc.panel.body.roofFaces.${face}`)}
                    formulaLabel={t(`weightCalc.panel.body.roofFaceFormula.${face}`)}
                    areaMm2={roofFaceArea(face, num(box.W), num(roof.Droof), num(roof.Hroof))}
                    state={roof.faces[face]}
                    weight={roofFaceWeight(face)}
                    onChange={(patch) => updateRoofFace(face, patch)}
                  />
                ))}
              </div>
            </GroupCard>
          )}

          {/* 扉 — 新規行は箱体のW/H/tを初期値として引き継ぐ (再入力の手間を省く。後から個別に変更可) */}
          <SheetItemGroup
            title={t("weightCalc.panel.body.groups.door")}
            items={doors}
            setItems={setDoors}
            materials={materials}
            markDirty={markDirty}
            weightFn={sheetItemWeight}
            t={t}
            defaultThickness={box.t || "2.3"}
            seed={{ W: box.W, H: box.H }}
          />
          {/* 中板・基板 */}
          <SheetItemGroup
            title={t("weightCalc.panel.body.groups.subPlate")}
            items={subPlates}
            setItems={setSubPlates}
            materials={materials}
            markDirty={markDirty}
            weightFn={sheetItemWeight}
            t={t}
            defaultThickness="2.3"
          />
          {/* 保護板 */}
          <SheetItemGroup
            title={t("weightCalc.panel.body.groups.protectionPlate")}
            items={protectionPlates}
            setItems={setProtectionPlates}
            materials={materials}
            markDirty={markDirty}
            weightFn={sheetItemWeight}
            t={t}
            defaultThickness="1.6"
          />
          {/* 金具・パネル等 */}
          <SheetItemGroup
            title={t("weightCalc.panel.body.groups.hardware")}
            items={hardware}
            setItems={setHardware}
            materials={materials}
            markDirty={markDirty}
            weightFn={sheetItemWeight}
            t={t}
            defaultThickness="2.3"
          />

          {/* 架台 — ハット形 (基本重量計算) と同じ入力・計算式。金具・パネル の横に配置。 */}
          <GroupCard
            title={t("weightCalc.panel.body.groups.frame")}
            weight={framesWeight}
            onAdd={() => {
              setFrames((prev) => [...prev, blankFrameItem(materials)]);
              markDirty();
            }}
          >
            {frames.map((item) => {
              const shape = getWeightShape("hat");
              return (
                <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                  {shape.fields.map((k) => (
                    <NumField
                      key={k}
                      label={t(`weightCalc.basic.fields.hat.${k}`)}
                      value={item.dims[k] ?? ""}
                      onChange={(v) => {
                        setFrames((p) => p.map((i) => (i.id === item.id ? { ...i, dims: { ...i.dims, [k]: v } } : i)));
                        markDirty();
                      }}
                      compact
                    />
                  ))}
                  <NumField
                    label={t("weightCalc.basic.length")}
                    value={item.length}
                    onChange={(v) => { setFrames((p) => p.map((i) => (i.id === item.id ? { ...i, length: v } : i))); markDirty(); }}
                    compact
                  />
                  <div className="w-28">
                    <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
                    <select
                      value={item.materialId}
                      onChange={(e) => {
                        const picked = pickMaterial(e.target.value);
                        setFrames((p) => p.map((i) => (i.id === item.id ? { ...i, ...picked } : i)));
                        markDirty();
                      }}
                      className="field-input"
                    >
                      <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setFrames((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
                  <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setFrames((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
                  <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(additionalItemWeight(item), 3)} kg</span>
                  <button type="button" onClick={() => { setFrames((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </GroupCard>

          {/* 銅帯 */}
          <GroupCard
            title={t("weightCalc.panel.body.groups.busbar")}
            weight={busbarsWeight}
            onAdd={() => {
              setBusbars((prev) => [...prev, blankBusbarItem(materials)]);
              markDirty();
            }}
          >
            {busbars.map((item) => (
              <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                <NumField label="W" value={item.W} onChange={(v) => { setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, W: v } : i))); markDirty(); }} compact />
                <NumField label={t("weightCalc.panel.body.fields.length")} value={item.L} onChange={(v) => { setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, L: v } : i))); markDirty(); }} compact />
                <NumField label={t("weightCalc.panel.body.fields.thickness")} value={item.t} onChange={(v) => { setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, t: v } : i))); markDirty(); }} compact />
                <div className="w-28">
                  <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
                  <select
                    value={item.materialId}
                    onChange={(e) => {
                      const picked = pickMaterial(e.target.value);
                      setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, ...picked } : i)));
                      markDirty();
                    }}
                    className="field-input"
                  >
                    <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
                <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setBusbars((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
                <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(busbarItemWeight(item), 3)} kg</span>
                <button type="button" onClick={() => { setBusbars((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </GroupCard>

          {/* 部品 */}
          <GroupCard
            title={t("weightCalc.panel.body.groups.parts")}
            weight={partsWeight}
            onAdd={() => setPartsModalOpen(true)}
            addLabel={t("weightCalc.panel.body.fetchFromPartAssembly")}
          >
            {parts.map((item) => {
              const w = partItemWeight(item);
              const unregistered = item.masterWeight.trim() === "" && item.manualWeight.trim() === "";
              return (
                <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                  <div className="w-32">
                    <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.panel.body.fields.model")}</label>
                    <input value={item.model} onChange={(e) => { setParts((p) => p.map((i) => (i.id === item.id ? { ...i, model: e.target.value } : i))); markDirty(); }} className="field-input" />
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.panel.body.fields.name")}</label>
                    <input value={item.name} onChange={(e) => { setParts((p) => p.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i))); markDirty(); }} className="field-input" />
                  </div>
                  <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setParts((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
                  <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setParts((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
                  {unregistered ? (
                    <span className="mb-1 text-[11.5px] font-semibold text-warning">{t("weightCalc.panel.body.weightNotRegistered")}</span>
                  ) : (
                    <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(w, 3)} kg</span>
                  )}
                  <button type="button" onClick={() => { setParts((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </GroupCard>

          {/* 木材 */}
          <GroupCard
            title={t("weightCalc.panel.body.groups.wood")}
            weight={woodsWeight}
            onAdd={() => {
              setWoods((prev) => [...prev, blankFlatItem(materials, "木材")]);
              markDirty();
            }}
          >
            {woods.map((item) => (
              <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                <NumField label="W" value={item.W} onChange={(v) => { setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, W: v } : i))); markDirty(); }} compact />
                <NumField label="H" value={item.H} onChange={(v) => { setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, H: v } : i))); markDirty(); }} compact />
                <NumField label={t("weightCalc.panel.body.fields.thickness")} value={item.t} onChange={(v) => { setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, t: v } : i))); markDirty(); }} compact />
                <div className="w-28">
                  <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
                  <select
                    value={item.materialId}
                    onChange={(e) => {
                      const picked = pickMaterial(e.target.value);
                      setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, ...picked } : i)));
                      markDirty();
                    }}
                    className="field-input"
                  >
                    <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
                <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setWoods((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
                <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(flatItemWeight(item), 3)} kg</span>
                <button type="button" onClick={() => { setWoods((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </GroupCard>

          {/* 追加部材 (アングル/Cチャンネル/FB/鈑金) */}
          <GroupCard
            title={t("weightCalc.panel.body.groups.additional")}
            weight={additionalWeight}
            onAdd={() => {
              setAdditional((prev) => [...prev, blankAdditionalItem(materials)]);
              markDirty();
            }}
          >
            {additional.map((item) => {
              const shape = getWeightShape(item.shapeKey);
              return (
                <div key={item.id} className="flex flex-col gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-32">
                      <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.panel.body.fields.shape")}</label>
                      <select
                        value={item.shapeKey}
                        onChange={(e) => {
                          const shapeKey = e.target.value as WeightShapeKey;
                          setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, shapeKey, dims: {} } : i)));
                          markDirty();
                        }}
                        className="field-input"
                      >
                        {WEIGHT_SHAPES.map((s) => (
                          <option key={s.key} value={s.key}>{t(`weightCalc.basic.shapes.${s.key}`)}</option>
                        ))}
                      </select>
                    </div>
                    {shape.fields.map((k) => (
                      <NumField
                        key={k}
                        label={t(`weightCalc.basic.fields.${item.shapeKey}.${k}`)}
                        value={item.dims[k] ?? ""}
                        onChange={(v) => {
                          setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, dims: { ...i.dims, [k]: v } } : i)));
                          markDirty();
                        }}
                        compact
                      />
                    ))}
                    <NumField
                      label={t("weightCalc.basic.length")}
                      value={item.length}
                      onChange={(v) => { setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, length: v } : i))); markDirty(); }}
                      compact
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
                      <select
                        value={item.materialId}
                        onChange={(e) => {
                          const picked = pickMaterial(e.target.value);
                          setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, ...picked } : i)));
                          markDirty();
                        }}
                        className="field-input"
                      >
                        <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
                    <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setAdditional((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
                    <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(additionalItemWeight(item), 3)} kg</span>
                    <button type="button" onClick={() => { setAdditional((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </GroupCard>

          {/* 配線補正 + 合計 */}
          <div className="flex flex-col gap-2.5 border-t border-border pt-3.5">
            <span className="field-label">{t("weightCalc.panel.body.wiringFactor")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(["1", "1.2", "1.5"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setWiringFactor(f);
                    markDirty();
                  }}
                  className={
                    wiringFactor === f
                      ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                      : "rounded-md border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                  }
                >
                  ×{f}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <div className="text-[10.5px] tracking-wide text-muted uppercase">{t("weightCalc.panel.body.rawTotal")}</div>
                <div className="mt-0.5 text-[15px] font-bold text-foreground">{roundTo(totalWeight, 3)} <span className="text-[11px] font-normal text-muted">kg</span></div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <div className="text-[10.5px] tracking-wide text-muted uppercase">{t("weightCalc.panel.body.correctedTotal")}</div>
                <div className="mt-0.5 text-[17px] font-bold text-accent">{roundTo(correctedWeight, 3)} <span className="text-[11px] font-normal text-muted">kg</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 参考図: 屋内/屋外/Nitto/扉/屋根 で切替 */}
        <div className="order-1 flex flex-col gap-1.5 lg:order-2">
          <div className="flex flex-wrap gap-1">
            {PANEL_IMAGE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveImageKey(key)}
                className={
                  activeImageKey === key
                    ? "rounded px-2 py-1 text-[11px] font-bold text-accent underline"
                    : "rounded px-2 py-1 text-[11px] text-muted hover:text-foreground"
                }
              >
                {t(`weightCalc.panel.body.imageTabs.${key}`)}
              </button>
            ))}
          </div>
          <PanelImageFrame
            image={activeImage}
            label={t(`weightCalc.panel.body.imageTabs.${activeImageKey}`)}
            onUpload={(file) => handleImageUpload(activeImageKey, file)}
            placeholder={t("weightCalc.basic.imagePlaceholder")}
            uploadLabel={t("common.upload")}
          />
        </div>
      </div>

      {partsModalOpen && (
        <InsertPartModal
          items={masterItems}
          loading={masterLoading}
          onClose={() => setPartsModalOpen(false)}
          onInsertBlank={handleInsertBlankPart}
          onPick={handlePickPart}
        />
      )}

      {caseAttachPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCaseAttachPromptOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1.5 text-[14px] font-bold text-foreground">
              {t("weightCalc.panel.body.attachPrompt.title")}
            </h3>
            <p className="mb-3 text-[12.5px] text-muted">{t("weightCalc.panel.body.attachPrompt.message")}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setCaseAttachPromptOpen(false);
                  setShowSavedCasesModal(true);
                }}
                className="btn-secondary w-full justify-center"
              >
                {t("caseSelector.savedCasesButton")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaseAttachPromptOpen(false);
                  setShowNewCaseModal(true);
                }}
                className="btn-primary w-full justify-center"
              >
                {t("caseSelector.newCaseButton")}
              </button>
              <button
                type="button"
                onClick={() => setCaseAttachPromptOpen(false)}
                className="btn-ghost w-full justify-center"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCaseModal && (
        <NewCaseModal onClose={() => setShowNewCaseModal(false)} onCreated={(created) => attachToCase(created.id)} />
      )}
      {showSavedCasesModal && (
        <SavedCasesModal onClose={() => setShowSavedCasesModal(false)} onOpen={(id) => attachToCase(id)} />
      )}
    </div>
  );
}

// ---- Small shared sub-components ----

function NumField({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "w-24" : undefined}>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </div>
  );
}

/** One named face (背面/天面/底面/左側面/右側面, or 屋根's 5 sub-faces) — shows its own dimensions/area/weight so the total can be cross-checked face by face, with an include/exclude toggle and a per-face manual override. */
function FaceRow({
  label,
  formulaLabel,
  areaMm2,
  state,
  weight,
  onChange,
}: {
  label: string;
  formulaLabel: string;
  areaMm2: number;
  state: FaceState;
  weight: number;
  onChange: (patch: Partial<FaceState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2">
      <label className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-foreground">
        <input
          type="checkbox"
          checked={state.included}
          onChange={(e) => onChange({ included: e.target.checked })}
        />
        {label}
      </label>
      <span className="text-[11px] text-muted-2">
        {formulaLabel} = {Number.isFinite(areaMm2) ? roundTo(areaMm2, 0) : 0} mm²
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="kg"
          value={state.manualWeight}
          onChange={(e) => onChange({ manualWeight: e.target.value })}
          disabled={!state.included}
          className="field-input !w-24 !py-1 !text-[12px]"
        />
        <span
          className={
            state.included
              ? "w-16 text-right text-[12.5px] font-semibold text-foreground"
              : "w-16 text-right text-[12.5px] text-muted-2 line-through"
          }
        >
          {roundTo(weight, 3)} kg
        </span>
      </div>
    </div>
  );
}

/** Material select + 比重, sized to sit inline in the same compact flex-wrap row as W/H/D/t — not its own wide block. */
function MaterialRow({
  materials,
  materialId,
  density,
  onChange,
}: {
  materials: WeightMaterial[];
  materialId: string;
  density: string;
  onChange: (patch: { materialId: string; density: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="w-32">
        <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
        <select
          value={materialId}
          onChange={(e) => {
            const m = materials.find((mm) => mm.id === e.target.value);
            onChange({ materialId: e.target.value, density: m ? String(m.density) : "" });
          }}
          className="field-input"
        >
          <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="w-20">
        <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.density")}</label>
        <input
          type="number"
          step="0.01"
          value={density}
          onChange={(e) => onChange({ materialId, density: e.target.value })}
          className="field-input"
        />
      </div>
    </>
  );
}

function GroupCard({
  title,
  weight,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  weight: number;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-muted">{roundTo(weight, 3)} kg</span>
          {onAdd && (
            <button type="button" onClick={onAdd} className="btn-ghost !py-1 !text-[12px]">
              <Plus className="h-3.5 w-3.5" />
              {addLabel ?? t("partAssembly.addRow")}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function SheetItemGroup({
  title,
  items,
  setItems,
  materials,
  markDirty,
  weightFn,
  t,
  defaultThickness,
  seed,
}: {
  title: string;
  items: SheetItem[];
  setItems: React.Dispatch<React.SetStateAction<SheetItem[]>>;
  materials: WeightMaterial[];
  markDirty: () => void;
  weightFn: (item: SheetItem) => number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  defaultThickness: string;
  /** New rows start pre-filled with these dims (扉 inherits 箱体's W/H so the common case doesn't need retyping) — still freely editable after. */
  seed?: { W: string; H: string };
}) {
  const total = items.reduce((sum, i) => sum + weightFn(i), 0);
  return (
    <GroupCard
      title={title}
      weight={total}
      onAdd={() => {
        setItems((prev) => [...prev, blankSheetItem(materials, defaultThickness, seed)]);
        markDirty();
      }}
    >
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
          <NumField label="W" value={item.W} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, W: v } : i))); markDirty(); }} compact />
          <NumField label="H" value={item.H} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, H: v } : i))); markDirty(); }} compact />
          <NumField label={t("weightCalc.panel.body.fields.fold")} value={item.T} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, T: v } : i))); markDirty(); }} compact />
          <NumField label={t("weightCalc.panel.body.fields.thickness")} value={item.t} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, t: v } : i))); markDirty(); }} compact />
          <div className="w-28">
            <label className="mb-1 block text-[11px] text-muted">{t("weightCalc.basic.material")}</label>
            <select
              value={item.materialId}
              onChange={(e) => {
                const m = materials.find((mm) => mm.id === e.target.value);
                setItems((p) => p.map((i) => (i.id === item.id ? { ...i, materialId: e.target.value, density: m ? String(m.density) : "" } : i)));
                markDirty();
              }}
              className="field-input"
            >
              <option value="">{t("weightCalc.basic.materialPlaceholder")}</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <NumField label={t("weightCalc.basic.quantity")} value={item.quantity} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: v } : i))); markDirty(); }} compact />
          <NumField label={t("weightCalc.panel.body.fields.manualWeight")} value={item.manualWeight} onChange={(v) => { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, manualWeight: v } : i))); markDirty(); }} compact />
          <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(weightFn(item), 3)} kg</span>
          <button type="button" onClick={() => { setItems((p) => p.filter((i) => i.id !== item.id)); markDirty(); }} className="btn-ghost btn-icon text-danger hover:bg-danger/10 mb-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </GroupCard>
  );
}

function PanelImageFrame({
  image,
  label,
  onUpload,
  placeholder,
  uploadLabel,
}: {
  image?: PanelWeightLayerImage;
  label: string;
  onUpload: (file: File) => void;
  placeholder: string;
  uploadLabel: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative flex h-[240px] w-full items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface-2 p-2 lg:h-[300px]">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- real Storage URL, not a static asset next/image can optimize
        <img src={getPublicUrl(image.storagePath)} alt={label} className="max-h-full max-w-full object-contain" />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border-strong text-muted-2 transition-colors hover:border-accent hover:text-muted"
        >
          {uploading ? <Loader2 className="h-9 w-9 animate-spin" /> : <ImageIcon className="h-9 w-9" />}
          <span className="max-w-[240px] text-center text-[12px]">{placeholder}</span>
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
            <Upload className="h-3 w-3" />
            {uploadLabel}
          </span>
        </button>
      )}
      {image && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary absolute top-2 right-2 !py-1 !text-[11.5px]"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploadLabel}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.webp,.gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
