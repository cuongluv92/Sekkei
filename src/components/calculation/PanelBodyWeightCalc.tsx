"use client";

import { ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import {
  calculationRecordService,
  exportPanelWeightExcel,
  panelWeightLayerImageService,
  partAssemblyService,
  printPanelWeight,
  searchService,
  weightMaterialService,
  type PanelWeightExportRow,
} from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { getPublicUrl } from "@/lib/supabase/storage";
import { getWeightShape, WEIGHT_SHAPES, type WeightDimKey, type WeightShapeKey } from "@/lib/utils/weightShapes";
import { CaseAttachPrompt } from "@/components/common/CaseAttachPrompt";
import {
  BOX_FACE_KEYS,
  boxFaceArea,
  busbarWeightKg,
  foldedPlateArea,
  PANEL_LAYER_KEYS,
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
import { PartWeightSearchModal } from "@/components/common/PartWeightSearchModal";
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
}

interface FlatItem {
  id: string;
  W: string;
  H: string;
  materialId: string;
  density: string;
  t: string;
  quantity: string;
}

interface BusbarItem {
  id: string;
  W: string;
  L: string;
  materialId: string;
  density: string;
  t: string;
  quantity: string;
}

interface PartItem {
  id: string;
  symbol: string;
  name: string;
  model: string;
  /** From 部品データ.weight — "" means not registered in the master. */
  masterWeight: string;
  quantity: string;
  /** 部品 only — a real part often has no formula-derivable weight (bought-in item), so this is the one group that keeps a manual kg override. Every other group is dimension-driven and always auto-calculates. */
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
}

interface FaceState {
  included: boolean;
  /** 左側面/右側面のみ意味を持つ — 連結盤で隣の盤と接する面が開口 (ケーブル/母線通し) になっている場合、その開口の幅×高さを D×H から差し引く。他の面では常に空欄のまま無視される。 */
  openingW: string;
  openingH: string;
}
type BoxFaces = Record<BoxFaceKey, FaceState>;

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
  /** 前スカートの高さ (低い方)。 */
  H1: string;
  /** 後スカートの高さ (高い方) — 片流れ屋根のため前後で異なる。 */
  H2: string;
  materialId: string;
  density: string;
  // 板厚は 箱体 の t をそのまま使う (別入力なし) — 屋根だけ違う板厚にする実物はまず無いため。
  // 面は常に固定 (天面/前後左右スカート/張り出し下面) — 箱体と違い実物によって
  // 有無が変わるものではないため、個別トグルは廃止し常に自動計算する。
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
  };
}
function blankFlatItem(materials: WeightMaterial[], materialName: string): FlatItem {
  return { id: nextId(), W: "", H: "", ...defaultMaterial(materials, materialName), t: "", quantity: "1" };
}
function blankBusbarItem(materials: WeightMaterial[]): BusbarItem {
  return { id: nextId(), W: "", L: "", ...defaultMaterial(materials, "銅"), t: "", quantity: "1" };
}
function blankAdditionalItem(materials: WeightMaterial[]): AdditionalItem {
  return {
    id: nextId(),
    shapeKey: "angle",
    dims: {},
    length: "",
    ...defaultMaterial(materials, "鉄"),
    quantity: "1",
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
      { included: key === "top" ? layer !== "outdoor" : true, openingW: "", openingH: "" },
    ]),
  ) as BoxFaces;
}
function blankBox(materials: WeightMaterial[], layer: PanelLayerKey): BoxState {
  return { W: "", H: "", D: "", ...defaultMaterial(materials, "鉄"), t: "2.3", faces: blankBoxFaces(layer) };
}
/** 屋根 has no 板厚 of its own — it always uses 箱体 の t (see roofFaceWeight). */
function blankRoof(materials: WeightMaterial[]): RoofState {
  return { Droof: "", H1: "", H2: "", ...defaultMaterial(materials, "鉄") };
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
  const [fetchingPartAssembly, setFetchingPartAssembly] = useState(false);
  /** 部品製作から一括取得すると件数が多くなりがちなので、既定は畳んでおき合計だけ見せる — 詳細ボタンで必要な時だけ展開。 */
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [nittoWeightModalOpen, setNittoWeightModalOpen] = useState(false);
  const [caseAttachPromptOpen, setCaseAttachPromptOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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
    await handleSave(newCaseId);
    saveToStorage(DRAFT_STORAGE_KEY, null);
  }

  async function handleImageUpload(key: PanelImageKey, file: File) {
    const uploaded = await panelWeightLayerImageService.upload(key, file);
    setImages((prev) => ({ ...prev, [key]: uploaded }));
  }

  // ---- Weight calculations ----

  /** 左側面/右側面は開口 (連結盤で隣の盤と接する面) が入力されていればその分を差し引く。他の面は無視される (boxFaceArea 側でガード済み)。 */
  function boxFaceAreaFor(face: BoxFaceKey): number {
    const state = box.faces[face];
    // Guard against records saved before openingW/openingH existed.
    const openingW = state.openingW ?? "";
    const openingH = state.openingH ?? "";
    const opening =
      openingW.trim() !== "" || openingH.trim() !== "" ? { W: num(openingW), H: num(openingH) } : undefined;
    return boxFaceArea(face, num(box.W), num(box.H), num(box.D), opening);
  }
  function boxFaceWeight(face: BoxFaceKey): number {
    if (!box.faces[face].included) return 0;
    return sheetWeightKg(boxFaceAreaFor(face), num(box.t), num(box.density));
  }
  const boxWeight =
    layer === "nitto"
      ? num(nittoBoxWeight) * num(nittoBoxQuantity)
      : BOX_FACE_KEYS.reduce((sum, f) => sum + boxFaceWeight(f), 0);

  /** 屋根は箱体と違い実物によって面の有無が変わらないため、常に6面すべて自動計算する (トグルなし)。 */
  function roofFaceWeight(face: RoofFaceKey): number {
    const area = roofFaceArea(face, num(box.W), num(roof.Droof), num(box.D), num(roof.H1), num(roof.H2));
    return sheetWeightKg(area, num(box.t), num(roof.density));
  }
  const roofWeight =
    layer !== "outdoor" ? 0 : ROOF_FACE_KEYS.reduce((sum, f) => sum + roofFaceWeight(f), 0);

  function sheetItemWeight(item: SheetItem): number {
    const area = foldedPlateArea(num(item.W), num(item.H), num(item.T));
    return sheetWeightKg(area, num(item.t), num(item.density)) * num(item.quantity);
  }
  function flatItemWeight(item: FlatItem): number {
    return woodWeightKg(num(item.W), num(item.H), num(item.t), num(item.density)) * num(item.quantity);
  }
  function busbarItemWeight(item: BusbarItem): number {
    return busbarWeightKg(num(item.W), num(item.L), num(item.t), num(item.density)) * num(item.quantity);
  }
  function partItemWeight(item: PartItem): number {
    if (item.manualWeight.trim() !== "") return num(item.manualWeight) * num(item.quantity);
    if (item.masterWeight.trim() === "") return 0;
    return num(item.masterWeight) * num(item.quantity);
  }
  function additionalItemWeight(item: AdditionalItem): number {
    const shape = getWeightShape(item.shapeKey);
    const dims = Object.fromEntries(shape.fields.map((k) => [k, num(item.dims[k] ?? "")])) as Record<
      WeightDimKey,
      number
    >;
    if (!shape.fields.every((k) => dims[k] > 0)) return 0;
    const area = shape.computeArea(dims);
    return (area * num(item.length) * num(item.density) * num(item.quantity)) / 1_000_000;
  }

  // Nitto: 箱体重量 (手入力) already covers the whole box including 扉/中板・基板 — never double-count them.
  const doorsWeight = layer === "nitto" ? 0 : doors.reduce((sum, i) => sum + sheetItemWeight(i), 0);
  const subPlatesWeight = layer === "nitto" ? 0 : subPlates.reduce((sum, i) => sum + sheetItemWeight(i), 0);
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

  /** Flattens every group into export rows (Excel/PDF) — same weight functions the screen already shows, so the export can never drift from what's on screen. */
  function buildExportRows(): PanelWeightExportRow[] {
    const rows: PanelWeightExportRow[] = [];
    const g = {
      box: t("weightCalc.panel.body.groups.box"),
      roof: t("weightCalc.panel.body.groups.roof"),
      door: t("weightCalc.panel.body.groups.door"),
      subPlate: t("weightCalc.panel.body.groups.subPlate"),
      protectionPlate: t("weightCalc.panel.body.groups.protectionPlate"),
      hardware: t("weightCalc.panel.body.groups.hardware"),
      frame: t("weightCalc.panel.body.groups.frame"),
      busbar: t("weightCalc.panel.body.groups.busbar"),
      parts: t("weightCalc.panel.body.groups.parts"),
      wood: t("weightCalc.panel.body.groups.wood"),
      additional: t("weightCalc.panel.body.groups.additional"),
    };

    if (layer === "nitto") {
      rows.push({
        group: g.box,
        item: t("weightCalc.panel.body.fields.nittoBoxWeight"),
        detail: `${nittoBoxWeight || "—"} kg`,
        quantity: nittoBoxQuantity,
        weightKg: boxWeight,
      });
    } else {
      const dash = "—";
      for (const face of BOX_FACE_KEYS) {
        if (!box.faces[face].included) continue;
        const state = box.faces[face];
        let detail: string;
        if (face === "back") detail = `W×H = ${box.W || dash}×${box.H || dash}`;
        else if (face === "top" || face === "bottom") detail = `W×D = ${box.W || dash}×${box.D || dash}`;
        else {
          detail = `D×H = ${box.D || dash}×${box.H || dash}`;
          if ((state.openingW ?? "").trim() || (state.openingH ?? "").trim()) {
            detail += ` − 開口${state.openingW || dash}×${state.openingH || dash}`;
          }
        }
        rows.push({
          group: g.box,
          item: t(`weightCalc.panel.body.boxFaces.${face}`),
          detail,
          quantity: "1",
          weightKg: boxFaceWeight(face),
        });
      }
    }

    if (layer === "outdoor") {
      const dash = "—";
      const roofDetail: Record<RoofFaceKey, string> = {
        top: `W×Droof = ${box.W || dash}×${roof.Droof || dash}`,
        frontSkirt: `W×H1 = ${box.W || dash}×${roof.H1 || dash}`,
        backSkirt: `W×H2 = ${box.W || dash}×${roof.H2 || dash}`,
        leftSkirt: `Droof×(H1+H2)/2 = ${roof.Droof || dash}×(${roof.H1 || dash}+${roof.H2 || dash})/2`,
        rightSkirt: `Droof×(H1+H2)/2 = ${roof.Droof || dash}×(${roof.H1 || dash}+${roof.H2 || dash})/2`,
        overhang: `W×(Droof−D) = ${box.W || dash}×(${roof.Droof || dash}−${box.D || dash})`,
      };
      for (const face of ROOF_FACE_KEYS) {
        rows.push({
          group: g.roof,
          item: t(`weightCalc.panel.body.roofFaces.${face}`),
          detail: roofDetail[face],
          quantity: "1",
          weightKg: roofFaceWeight(face),
        });
      }
    }

    function pushSheetGroup(groupLabel: string, items: SheetItem[]) {
      items.forEach((item, i) => {
        rows.push({
          group: groupLabel,
          item: `#${i + 1}`,
          detail: `W×H = ${item.W}×${item.H}, T=${item.T || "0"}, t=${item.t}`,
          quantity: item.quantity,
          weightKg: sheetItemWeight(item),
        });
      });
    }
    if (layer !== "nitto") pushSheetGroup(g.door, doors);
    if (layer !== "nitto") pushSheetGroup(g.subPlate, subPlates);
    pushSheetGroup(g.protectionPlate, protectionPlates);
    pushSheetGroup(g.hardware, hardware);

    function pushShapeGroup(groupLabel: string, items: AdditionalItem[]) {
      items.forEach((item, i) => {
        const shape = getWeightShape(item.shapeKey);
        const dims = shape.fields.map((k) => `${k}=${item.dims[k] ?? ""}`).join(", ");
        rows.push({
          group: groupLabel,
          item: `${t(`weightCalc.basic.shapes.${item.shapeKey}`)}#${i + 1}`,
          detail: `${dims}, L=${item.length}`,
          quantity: item.quantity,
          weightKg: additionalItemWeight(item),
        });
      });
    }
    pushShapeGroup(g.frame, frames);

    busbars.forEach((item, i) => {
      rows.push({
        group: g.busbar,
        item: `#${i + 1}`,
        detail: `W×L = ${item.W}×${item.L}, t=${item.t}`,
        quantity: item.quantity,
        weightKg: busbarItemWeight(item),
      });
    });

    parts.forEach((item) => {
      rows.push({
        group: g.parts,
        item: item.model || item.name || "-",
        detail: item.name,
        quantity: item.quantity,
        weightKg: partItemWeight(item),
      });
    });

    woods.forEach((item, i) => {
      rows.push({
        group: g.wood,
        item: `#${i + 1}`,
        detail: `W×H = ${item.W}×${item.H}, t=${item.t}`,
        quantity: item.quantity,
        weightKg: flatItemWeight(item),
      });
    });

    pushShapeGroup(g.additional, additional);

    return rows;
  }

  async function buildExportData() {
    const rows = buildExportRows();
    const groupSubtotals = Array.from(
      rows.reduce((map, row) => map.set(row.group, (map.get(row.group) ?? 0) + row.weightKg), new Map<string, number>()),
    ).map(([group, weightKg]) => ({ group, weightKg }));

    let caseInfo: { drawingNumber: string; managementNumber: string; constructionNumber: string; projectName: string; panelName: string } | undefined;
    if (caseId) {
      const detail = await designCaseService.getDetail(caseId);
      if (detail) {
        caseInfo = {
          drawingNumber: detail.case.drawingNumber,
          managementNumber: detail.case.managementNumber,
          constructionNumber: detail.case.constructionNumber,
          projectName: detail.case.projectName,
          panelName: detail.panels[0]?.panelName ?? "",
        };
      }
    }

    return {
      title: t("weightCalc.panel.body.title"),
      caseInfo,
      layerLabel: t(`weightCalc.panel.body.layer.${layer}`),
      groupSubtotals,
      wiringFactorLabel: `×${wiringFactor}`,
      rawTotal: totalWeight,
      correctedTotal: correctedWeight,
      generatedAt: new Date().toLocaleDateString("ja-JP"),
    };
  }

  async function handleExcelExport() {
    setExportingExcel(true);
    try {
      await exportPanelWeightExcel(await buildExportData());
    } finally {
      setExportingExcel(false);
    }
  }
  async function handlePdfExport() {
    setExportingPdf(true);
    try {
      printPanelWeight(await buildExportData());
    } finally {
      setExportingPdf(false);
    }
  }

  function updateBox(patch: Partial<BoxState>) {
    setBox((prev) => ({ ...prev, ...patch }));
    markDirty();
  }
  function updateRoof(patch: Partial<RoofState>) {
    setRoof((prev) => ({ ...prev, ...patch }));
    markDirty();
  }
  function toggleBoxFace(face: BoxFaceKey, included: boolean) {
    setBox((prev) => ({ ...prev, faces: { ...prev.faces, [face]: { ...prev.faces[face], included } } }));
    markDirty();
  }
  function updateBoxFaceOpening(face: BoxFaceKey, patch: Partial<Pick<FaceState, "openingW" | "openingH">>) {
    setBox((prev) => ({ ...prev, faces: { ...prev.faces, [face]: { ...prev.faces[face], ...patch } } }));
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

  /**
   * 部品を1件ずつ検索して追加する代わりに、同じ案件の 部品製作 (BOM) を丸ごと
   * 取り込む — 部品製作側で既に入力済みの数量・重量をそのまま使うので、この
   * グループへの再入力が不要になる。件数が多い案件で特に有効。
   */
  async function handleFetchFromPartAssembly() {
    if (!caseId) return;
    if (parts.length > 0 && !window.confirm(t("weightCalc.panel.body.fetchPartAssemblyReplaceConfirm"))) return;
    setFetchingPartAssembly(true);
    try {
      const rows = await partAssemblyService.listByCase(caseId);
      if (rows.length === 0) {
        window.alert(t("weightCalc.panel.body.fetchPartAssemblyEmpty"));
        return;
      }
      setParts(
        rows.map((r) => ({
          id: nextId(),
          symbol: r.symbol,
          name: r.name,
          model: r.model,
          masterWeight: r.weight != null ? String(r.weight) : "",
          quantity: String(r.quantity),
          manualWeight: "",
          sourceRefId: r.sourceRefId,
          sourceType: r.sourceType,
        })),
      );
      markDirty();
    } finally {
      setFetchingPartAssembly(false);
    }
  }

  /** Nitto箱体は購入品の完成品なので、部品データに登録済みなら重量をそのまま拾える — 手入力は登録がない場合のフォールバックとして残す。 */
  function handlePickNittoBoxWeight(item: SearchResultItem) {
    if (item.weight != null) {
      setNittoBoxWeight(String(item.weight));
      markDirty();
    }
    setNittoWeightModalOpen(false);
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
            <span className="text-[11px] text-warning">{t("caseSelector.draftNote")}</span>
          )}
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={exportingExcel}
            className="btn-secondary !py-1 !text-[12px]"
          >
            {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            {t("common.excelExport")}
          </button>
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={exportingPdf}
            className="btn-secondary !py-1 !text-[12px]"
          >
            {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {t("common.pdfExport")}
          </button>
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
                <div>
                  <label className="mb-1 block text-[11px] text-muted">
                    {t("weightCalc.panel.body.fields.nittoBoxWeight")}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={nittoBoxWeight}
                      onChange={(e) => {
                        setNittoBoxWeight(e.target.value);
                        markDirty();
                      }}
                      className="field-input"
                    />
                    <button
                      type="button"
                      onClick={() => setNittoWeightModalOpen(true)}
                      title={t("weightCalc.panel.body.fetchNittoWeightTitle")}
                      className="btn-ghost btn-icon shrink-0"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
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
                  <div className="flex flex-wrap gap-1.5">
                    {BOX_FACE_KEYS.filter((face) => face !== "left" && face !== "right").map((face) => (
                      <FaceRow
                        key={face}
                        label={t(`weightCalc.panel.body.boxFaces.${face}`)}
                        formulaLabel={t(`weightCalc.panel.body.boxFaceFormula.${face}`)}
                        areaMm2={boxFaceAreaFor(face)}
                        included={box.faces[face].included}
                        weight={boxFaceWeight(face)}
                        onToggle={(included) => toggleBoxFace(face, included)}
                      />
                    ))}
                  </div>
                  {/* 左側面/右側面は 開口 入力欄で幅を取るため別行 — 3面の行と詰めると狭すぎる。 */}
                  <div className="flex flex-wrap gap-1.5">
                    {(["left", "right"] as const).map((face) => (
                      <FaceRow
                        key={face}
                        label={t(`weightCalc.panel.body.boxFaces.${face}`)}
                        formulaLabel={t(`weightCalc.panel.body.boxFaceFormula.${face}`)}
                        areaMm2={boxFaceAreaFor(face)}
                        included={box.faces[face].included}
                        weight={boxFaceWeight(face)}
                        onToggle={(included) => toggleBoxFace(face, included)}
                        opening={{
                          W: box.faces[face].openingW ?? "",
                          H: box.faces[face].openingH ?? "",
                          onChangeW: (v) => updateBoxFaceOpening(face, { openingW: v }),
                          onChangeH: (v) => updateBoxFaceOpening(face, { openingH: v }),
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </GroupCard>

          {/* 屋根 (屋外のみ) — 片流れ (前H1低い/後H2高い)。実物によって面の有無が変わる箱体と違い、
              屋根は6面すべて常に存在するため個別トグルなし・自動計算のみ。 */}
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
                  label={t("weightCalc.panel.body.fields.h1")}
                  value={roof.H1}
                  onChange={(v) => updateRoof({ H1: v })}
                  compact
                />
                <NumField
                  label={t("weightCalc.panel.body.fields.h2")}
                  value={roof.H2}
                  onChange={(v) => updateRoof({ H2: v })}
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
                <span className="text-[11px] text-muted-2">{t("weightCalc.panel.body.roofBreakdownNote")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ROOF_FACE_KEYS.map((face) => {
                    const areaMm2 = roofFaceArea(face, num(box.W), num(roof.Droof), num(box.D), num(roof.H1), num(roof.H2));
                    const area = Number.isFinite(areaMm2) ? roundTo(areaMm2, 0) : 0;
                    return (
                      <div
                        key={face}
                        title={`${t(`weightCalc.panel.body.roofFaceFormula.${face}`)} = ${area} mm²`}
                        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px]"
                      >
                        <span className="font-semibold text-foreground">{t(`weightCalc.panel.body.roofFaces.${face}`)}</span>
                        <span className="font-semibold text-foreground">{roundTo(roofFaceWeight(face), 2)}kg</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GroupCard>
          )}

          {/* 扉 — 新規行は箱体のW/H/tを初期値として引き継ぐ (再入力の手間を省く。後から個別に変更可)。Nitto は箱体重量に含まれるため対象外。 */}
          {layer !== "nitto" && (
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
          )}
          {/* 中板・基板 (Nitto は 扉 に含まれるため対象外) */}
          {layer !== "nitto" && (
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
          )}
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
                  <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(additionalItemWeight(item), 2)} kg</span>
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
                <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(busbarItemWeight(item), 2)} kg</span>
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
            addLabel={t("weightCalc.panel.body.addPartManually")}
            extraActions={
              <button
                type="button"
                onClick={handleFetchFromPartAssembly}
                disabled={fetchingPartAssembly || !caseId}
                title={!caseId ? t("caseSelector.draftNote") : t("weightCalc.panel.body.fetchFromPartAssembly")}
                className="btn-ghost !py-1 !text-[12px]"
              >
                {fetchingPartAssembly ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t("weightCalc.panel.body.fetchFromPartAssembly")}
              </button>
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-muted-2">
                {t("weightCalc.panel.body.partsSummary", { count: parts.length })}
              </span>
              <button
                type="button"
                onClick={() => setPartsExpanded((v) => !v)}
                className="btn-ghost !py-1 !text-[11.5px]"
              >
                {partsExpanded ? t("weightCalc.panel.body.hideDetails") : t("weightCalc.panel.body.showDetails")}
                {partsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
            {partsExpanded &&
              parts.map((item) => {
                const w = partItemWeight(item);
                const unregistered = item.masterWeight.trim() === "" && item.manualWeight.trim() === "";
                return (
                  <div key={item.id} className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5">
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
                      <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(w, 2)} kg</span>
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
                <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(flatItemWeight(item), 2)} kg</span>
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
                    <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(additionalItemWeight(item), 2)} kg</span>
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
                <div className="mt-0.5 text-[15px] font-bold text-foreground">{roundTo(totalWeight, 2)} <span className="text-[11px] font-normal text-muted">kg</span></div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <div className="text-[10.5px] tracking-wide text-muted uppercase">{t("weightCalc.panel.body.correctedTotal")}</div>
                <div className="mt-0.5 text-[17px] font-bold text-accent">{roundTo(correctedWeight, 2)} <span className="text-[11px] font-normal text-muted">kg</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 参考図: 屋内/屋外/Nitto で切替 (扉/屋根は別図面がないため対象外) */}
        <div className="order-1 flex flex-col gap-1.5 lg:order-2">
          <div className="flex flex-wrap gap-1">
            {PANEL_LAYER_KEYS.map((key) => (
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
          currentRows={parts}
          onClose={() => setPartsModalOpen(false)}
          onInsertBlank={handleInsertBlankPart}
          onPick={handlePickPart}
        />
      )}

      {nittoWeightModalOpen && (
        <PartWeightSearchModal
          items={masterItems}
          loading={masterLoading}
          onClose={() => setNittoWeightModalOpen(false)}
          onPick={handlePickNittoBoxWeight}
        />
      )}

      <CaseAttachPrompt
        open={caseAttachPromptOpen}
        onClose={() => setCaseAttachPromptOpen(false)}
        onAttach={attachToCase}
      />
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

/**
 * One named 箱体 face (背面/天面/底面/左側面/右側面) as a compact chip — the 5
 * faces sit in a single wrapping row instead of stacking, so the whole
 * breakdown takes minimal height. Include/exclude toggle stays inline
 * (実物によって面の有無が違うため); the formula/area (needed for audit) moves
 * into the hover title instead of always-visible text, since that's what
 * actually forced 2 columns before. Always auto-calculated — no manual
 * override (面積×板厚×比重 で確定できるため、ムダな入力欄は置かない).
 *
 * `opening` (left/right のみ渡される) adds 2 tiny inline inputs for 連結盤の
 * 開口部 (隣の盤と接する面のケーブル/母線通し穴) — D×H から開口幅×開口高さを
 * 差し引く。空欄なら通常通り D×H そのまま。
 */
function FaceRow({
  label,
  formulaLabel,
  areaMm2,
  included,
  weight,
  onToggle,
  opening,
}: {
  label: string;
  formulaLabel: string;
  areaMm2: number;
  included: boolean;
  weight: number;
  onToggle: (included: boolean) => void;
  opening?: { W: string; H: string; onChangeW: (v: string) => void; onChangeH: (v: string) => void };
}) {
  const { t } = useTranslation();
  const area = Number.isFinite(areaMm2) ? roundTo(areaMm2, 0) : 0;
  return (
    <div
      title={`${formulaLabel} = ${area} mm²`}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px]"
    >
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={included} onChange={(e) => onToggle(e.target.checked)} />
        <span className={included ? "font-semibold text-foreground" : "font-semibold text-muted-2 line-through"}>
          {label}
        </span>
      </label>
      {opening && included && (
        <>
          <input
            type="number"
            step="1"
            placeholder={t("weightCalc.panel.body.openingWPlaceholder")}
            title={t("weightCalc.panel.body.openingTitle")}
            value={opening.W}
            onChange={(e) => opening.onChangeW(e.target.value)}
            className="field-input !w-12 !py-0.5 !text-[11px]"
          />
          <input
            type="number"
            step="1"
            placeholder={t("weightCalc.panel.body.openingHPlaceholder")}
            title={t("weightCalc.panel.body.openingTitle")}
            value={opening.H}
            onChange={(e) => opening.onChangeH(e.target.value)}
            className="field-input !w-12 !py-0.5 !text-[11px]"
          />
        </>
      )}
      <span className={included ? "font-semibold text-foreground" : "text-muted-2 line-through"}>
        {roundTo(weight, 2)}kg
      </span>
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
  extraActions,
  children,
}: {
  title: string;
  weight: number;
  onAdd?: () => void;
  addLabel?: string;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-muted">{roundTo(weight, 2)} kg</span>
          {extraActions}
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
          <span className="mb-1 text-[12px] font-semibold text-foreground">{roundTo(weightFn(item), 2)} kg</span>
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
