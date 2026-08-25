import type { BoltDiameter, BoltMaterial } from "@/lib/types";
import { downloadWorkbook, keepOnlyWorksheet, loadActiveTemplateSheet } from "./design/excelWorkbook";

/**
 * Fills the real vendor 耐震計算書 templates (自立形／壁掛形／キュービクル —
 * the same file the user supplied, 株式会社ニシナ製作所 fork of the
 * JSIA-T1018 worked examples) instead of building a generic sheet from
 * scratch. Every downstream cell in these templates (KH/FH/FV, Rb①②,
 * σ/τ, the ①②③ pass/fail judgement) is a LIVE EXCEL FORMULA that already
 * matches JSIA-T1018:2012 §4/§5.1.1/§5.1.2 — confirmed cell-by-cell while
 * building floorMountAnchor.ts/wallMountAnchor.ts. So this module only
 * writes the raw INPUT cells (region Z / Ks, weight, geometry, bolt
 * diameter, Ta) and lets Excel recompute everything else on open — it never
 * re-implements the formulas in TypeScript, which would risk a second,
 * independently-wrong copy of the same calculation.
 *
 * キュービクル reuses the exact same "自立形" sheet/template (only the A1
 * title text changes) — see SeismicCalculationView.tsx's doc comment for
 * why: JSIA-T1018 §7.1/§7.2's own worked examples for 屋外形キュービクル/
 * 屋内薄形キュービクル use this identical §5.1.1 formula, with no separate
 * cubicle coefficient table in the standard. The template kind is still
 * named "seismicFreeStanding" for that reason.
 *
 * 壁掛形テンプレートには、せん断力 Q=√(FH²+(W+FV)²)/n の式で (W+FV) の
 * 二乗が抜けているセル (N111) がある — これは提供いただいたサンプル自体の
 * 誤記で、標準の式(5-1-2-4)には二乗が明記されている。アプリの計算結果と
 * 矛盾する数値を出力しないよう、出力時にこのセルの式だけ修正して埋め込む
 * （壁掛形テンプレートのσ/τ判定セクションが SS400(row132) を固定参照して
 * いる点も、ステンレス選択時は row133 を参照するよう同様に書き換える）。
 */

export interface SeismicCaseInfoExportData {
  projectName: string;
  panelName: string;
  constructionNumber: string;
  drawingNumber: string;
}

export interface SeismicForceExportData {
  regionZ: number;
  ks: number;
  weightKg: number;
}

export interface SeismicBoltExportData {
  material: BoltMaterial;
  diameter: BoltDiameter;
  areaMm2: number;
  allowableTaKn: number | null;
}

export interface FloorMountGeometryExportData {
  centerOfGravityHeightMm: number;
  widthSpanMm: number;
  depthSpanMm: number;
  widthCenterToGravityMm: number;
  depthCenterToGravityMm: number;
  totalBoltCount: number;
  widthSideBoltCount: number;
  depthSideBoltCount: number;
}

export interface WallMountGeometryExportData {
  horizontalSpanMm: number;
  verticalSpanMm: number;
  verticalCenterToGravityMm: number;
  wallToGravityMm: number;
  totalBoltCount: number;
  horizontalFaceBoltCount: number;
  verticalFaceBoltCount: number;
}

function todayJa(): string {
  return new Date().toLocaleDateString("ja-JP");
}

/**
 * SS400(表132)固定参照になっている4つの式セルを、ステンレス(表133)参照に
 * 書き換える。material="ss400"なら何もしない(テンプレート既定のまま)。
 * `compareCell` はステンレス判定式が参照する fts 比較セル(自立形=T154,
 * 壁掛形=T148)で、シートごとに番地が異なる。
 */
function applyStainlessBoltMaterialOverride(
  ws: import("exceljs").Worksheet,
  material: BoltMaterial,
  cells: { ft: string; ftsLabel: string; ftsLimit: string; fs: string; compareCell: string },
) {
  if (material !== "stainless") return;
  ws.getCell(cells.ft).value = { formula: "P133" };
  ws.getCell(cells.ftsLabel).value = { formula: `IF(${cells.compareCell}>P133,"ft","ｆts")` };
  ws.getCell(cells.ftsLimit).value = { formula: `IF(${cells.compareCell}>P133,P133,${cells.compareCell})` };
  ws.getCell(cells.fs).value = { formula: "T133" };
}

async function buildFloorMountWorkbook(
  variant: "freeStanding" | "cubicle",
  caseInfo: SeismicCaseInfoExportData | undefined,
  force: SeismicForceExportData,
  geometry: FloorMountGeometryExportData,
  bolt: SeismicBoltExportData,
) {
  const { workbook, ws } = await loadActiveTemplateSheet("seismicFreeStanding", ["自立形", "キュービクル"]);
  keepOnlyWorksheet(workbook, ws);

  ws.getCell("A1").value = variant === "cubicle" ? "耐震計算書（キュービクル）" : "耐震計算書（自立形）";
  if (caseInfo) {
    ws.getCell("D2").value = caseInfo.projectName;
    ws.getCell("AB2").value = caseInfo.constructionNumber;
    ws.getCell("D3").value = caseInfo.panelName;
  }
  ws.getCell("AB3").value = todayJa();

  // 【1】地震入力: Z・KSは表(行10-21)を参照して手入力する欄 — アプリの自動計算値をそのまま書き込む。
  ws.getCell("V24").value = force.regionZ;
  ws.getCell("V26").value = force.ks;
  // W(盤総重量, kg) — 以降のkN換算・KH×W・転倒モーメントはすべてこのセルからの式。
  ws.getCell("F32").value = force.weightKg;

  // 【2】盤諸元 (hG/L1/L2/LG1/LG2/n/n1/n2) — LG1/LG2はテンプレート既定でL/2の式だが、
  // 実際の重心位置(偏心荷重で中心からずれる場合がある)を上書きする。
  ws.getCell("AE61").value = geometry.centerOfGravityHeightMm;
  ws.getCell("AE63").value = geometry.widthSpanMm;
  ws.getCell("AE65").value = geometry.depthSpanMm;
  ws.getCell("AE67").value = geometry.widthCenterToGravityMm;
  ws.getCell("AE69").value = geometry.depthCenterToGravityMm;
  ws.getCell("AE70").value = geometry.totalBoltCount;
  ws.getCell("AE72").value = geometry.widthSideBoltCount;
  ws.getCell("AE74").value = geometry.depthSideBoltCount;

  // ボルト径 — 3箇所(諸元欄・σ欄・τ欄)に同じ値を入力する欄。面積はIF式が自動算出。
  ws.getCell("AA76").value = bolt.diameter;
  ws.getCell("V103").value = bolt.diameter;
  ws.getCell("V122").value = bolt.diameter;

  // 【3】アンカーボルトの選定・判定
  ws.getCell("G148").value = bolt.diameter;
  ws.getCell("O148").value = bolt.allowableTaKn ?? 0;
  applyStainlessBoltMaterialOverride(ws, bolt.material, {
    ft: "I154",
    ftsLabel: "M155",
    ftsLimit: "P155",
    fs: "P157",
    compareCell: "T154",
  });

  return { workbook, drawingNumber: caseInfo?.drawingNumber ?? "" };
}

export async function exportSeismicFreeStandingExcel(input: {
  caseInfo?: SeismicCaseInfoExportData;
  force: SeismicForceExportData;
  geometry: FloorMountGeometryExportData;
  bolt: SeismicBoltExportData;
}): Promise<{ fileName: string }> {
  const { workbook, drawingNumber } = await buildFloorMountWorkbook("freeStanding", input.caseInfo, input.force, input.geometry, input.bolt);
  const fileName = `耐震計算書_自立形_${drawingNumber || todayJa().replace(/\//g, "")}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportSeismicCubicleExcel(input: {
  caseInfo?: SeismicCaseInfoExportData;
  force: SeismicForceExportData;
  geometry: FloorMountGeometryExportData;
  bolt: SeismicBoltExportData;
}): Promise<{ fileName: string }> {
  const { workbook, drawingNumber } = await buildFloorMountWorkbook("cubicle", input.caseInfo, input.force, input.geometry, input.bolt);
  const fileName = `耐震計算書_キュービクル_${drawingNumber || todayJa().replace(/\//g, "")}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportSeismicWallMountedExcel(input: {
  caseInfo?: SeismicCaseInfoExportData;
  force: SeismicForceExportData;
  geometry: WallMountGeometryExportData;
  bolt: SeismicBoltExportData;
}): Promise<{ fileName: string }> {
  const { caseInfo, force, geometry, bolt } = input;
  const { workbook, ws } = await loadActiveTemplateSheet("seismicWallMounted", ["壁掛形"]);
  keepOnlyWorksheet(workbook, ws);

  ws.getCell("A1").value = "耐震計算書（壁掛形）";
  if (caseInfo) {
    ws.getCell("D2").value = caseInfo.projectName;
    ws.getCell("AB2").value = caseInfo.constructionNumber;
    ws.getCell("D3").value = caseInfo.panelName;
  }
  ws.getCell("AB3").value = todayJa();

  ws.getCell("V24").value = force.regionZ;
  ws.getCell("V26").value = force.ks;
  ws.getCell("F32").value = force.weightKg;

  ws.getCell("AE61").value = geometry.horizontalSpanMm; // L1
  ws.getCell("AE63").value = geometry.verticalSpanMm; // L2
  // L1G(AE65)はテンプレート既定どおりL1/2のまま(アプリにも上部/下部の偏心ℓ1G入力欄はなく、常に中心とみなす — §5.1.2の式もそう前提している)。
  ws.getCell("AE67").value = geometry.verticalCenterToGravityMm; // L2G
  ws.getCell("AE69").value = geometry.wallToGravityMm; // L3G
  ws.getCell("AE70").value = geometry.totalBoltCount;
  ws.getCell("AE72").value = geometry.horizontalFaceBoltCount; // nt1
  ws.getCell("AE74").value = geometry.verticalFaceBoltCount; // nt2

  ws.getCell("AA76").value = bolt.diameter;
  ws.getCell("AE76").value = bolt.areaMm2;
  ws.getCell("V103").value = bolt.diameter;
  ws.getCell("Z103").value = bolt.areaMm2;
  ws.getCell("V122").value = bolt.diameter;
  ws.getCell("Z122").value = bolt.areaMm2;

  // せん断力Q — 提供テンプレートのこのセルは (W+FV) の二乗が抜けている誤記
  // (標準の(5-1-2-4)式には二乗が明記されている、壁掛形の計算根拠欄でも案内済み)。
  // アプリの計算値と食い違う数値を出力しないよう、正しい式に修正して埋め込む。
  ws.getCell("N111").value = { formula: "SQRT(V112^2+(V110+V114)^2)" };

  ws.getCell("G140").value = bolt.diameter;
  ws.getCell("O140").value = bolt.allowableTaKn ?? 0;
  applyStainlessBoltMaterialOverride(ws, bolt.material, {
    ft: "I148",
    ftsLabel: "M149",
    ftsLimit: "P149",
    fs: "P151",
    compareCell: "T148",
  });

  const fileName = `耐震計算書_壁掛形_${caseInfo?.drawingNumber || todayJa().replace(/\//g, "")}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}
