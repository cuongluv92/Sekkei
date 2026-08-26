import { downloadWorkbook, embedOutlineImage, keepOnlyWorksheet, loadActiveTemplateSheet, type OutlineImageAnchor } from "./design/excelWorkbook";
import type { OutlineImageExportRef } from "./seismicExcelExport";

/**
 * 外形図・給排気口配置図の埋め込み位置 — 実際のJSIA-T1016ファイルをunzipして
 * drawing*.xmlのアンカー座標を直接確認し、埋め込み画像そのものも開いて内容を
 * 確認した値(0始まりのcol/row)。元ファイルの各シートには寸法図が2枚あり、
 * 別々の図であることを画像を直接見て確認済み:
 *   図1/図3(正面図・側面図、W/H/D/H1/D1) — 屋外・屋内とも同じ位置
 *     (b)発熱源表の右側、行11〜19)
 *   図2(屋外・給排気口配置図/庇図、w/h1/h/W1/W2/Wn/D) — 「c) 盤表面積」節の
 *     直後、行31〜42
 *   図5(屋内・給排気口配置図/庇図) — 換気口欄の直後、行21〜30
 */
const OUTLINE_IMAGE_ANCHOR: OutlineImageAnchor = { fromCol: 12, fromRow: 10, toCol: 24, toRow: 18 };
const OUTDOOR_VENT_LAYOUT_ANCHOR: OutlineImageAnchor = { fromCol: 2, fromRow: 30, toCol: 20, toRow: 41 };
const INDOOR_VENT_LAYOUT_ANCHOR: OutlineImageAnchor = { fromCol: 12, fromRow: 20, toCol: 19, toRow: 29 };

/**
 * Fills the real vendor 換気計算書 templates (JSIA-T1016:2019準拠, JSIA HP
 * 掲載の使用例ファイル、ユーザー提供のものと同一) instead of building a
 * generic sheet from scratch. As with seismicExcelExport.ts, every
 * downstream cell (QBO/QBi, αxAx, QV, 判定, WK, 静圧, 台数決定) is a LIVE
 * EXCEL FORMULA already confirmed cell-by-cell against ventilationFlow.ts/
 * outdoorVentilation.ts/indoorVentilation.ts's golden tests — this module
 * only writes the raw INPUT cells and lets Excel recompute the rest.
 *
 * JSIAの元ファイルは屋外・屋内それぞれフィルタ有り／無しで別シート(行数が
 * 異なるレイアウト)になっているが、フィルタ有りシートは共通項目について
 * フィルタ無しシートと全く同じ行・列位置を使う上位互換のレイアウトで、
 * 差分はフィルタ関連の3行のみ (ζC/ζF入力・フィルタ通過風速による必要
 * 換気扇台数の確認)。そのため2枚目のほぼ同一シートを別テンプレート種別
 * として二重管理せず、フィルタ有りシート1枚を両方のケースで使い、
 * フィルタ無しの場合はフィルタ専用セルを空欄にする方式を採用している。
 */

export interface VentilationCaseInfoExportData {
  projectName: string;
  panelName: string;
  managementNumber: string;
}

export interface VentilationHeatSourceExportItem {
  name: string;
  heatW: number;
  capacity?: string;
  loadFactorPercent?: number | null;
}

export interface OutdoorVentilationExportData {
  caseInfo?: VentilationCaseInfoExportData;
  outlineDrawing?: OutlineImageExportRef | null;
  ventLayoutDrawing?: OutlineImageExportRef | null;
  climate: { ambientTempC: number; topTempC: number };
  heatSources: VentilationHeatSourceExportItem[];
  /** ユーザーが外形寸法(W/H/H1/D/D1)を入力していれば、実物テンプレートの
   * F23:N23セル(外形寸法欄)にも書き込む — 面積欄(SRO等)がこの寸法からの
   * 自動計算か直接入力かに関わらず、寸法が分かっているなら空欄のままに
   * しない。 */
  dimensions?: { widthM: number; heightM: number; heightH1M: number; depthM: number; depthD1M: number } | null;
  surfaceAreas: { roofM2: number; face1M2: number; face2M2: number; face3M2: number; face4M2: number };
  transmittance: { roofWPerM2K: number; sideWPerM2K: number };
  equivalentOutsideTemp: { roofC: number; face1C: number; face2C: number; face3C: number; face4C: number };
  supplyAreaM2: number;
  exhaustAreaM2: number;
  useFilter: boolean;
  noFilterDischargeCoefficient: number;
  ventResistanceCoefficient: number;
  filterResistanceCoefficient: number | null;
  heightDiffM: number;
  hoodFlowCoefficientX: number;
  fanCapacityM3PerHPerUnit: number | null;
  filterRatedVelocityMPerS: number | null;
}

export interface IndoorVentilationExportData {
  caseInfo?: VentilationCaseInfoExportData;
  outlineDrawing?: OutlineImageExportRef | null;
  ventLayoutDrawing?: OutlineImageExportRef | null;
  dimensions: { widthM: number; heightM: number; depthM: number };
  heatSources: VentilationHeatSourceExportItem[];
  transmittance: { roofWPerM2K: number; sideWPerM2K: number };
  supplyAreaM2: number;
  exhaustAreaM2: number;
  useFilter: boolean;
  noFilterDischargeCoefficient: number;
  ventResistanceCoefficient: number;
  filterResistanceCoefficient: number | null;
  heightDiffM: number;
  hoodFlowCoefficientX: number;
  fanCapacityM3PerHPerUnit: number | null;
  filterRatedVelocityMPerS: number | null;
}

const HEAT_SOURCE_ROWS = [13, 14, 15, 16, 17, 18, 19];

/**
 * B(機器名称)・F(容量)・H(負荷率%)・J(発熱W)を埋める — F/Hは実物の様式
 * どおり自由記入・参考値(J列=発熱量は実物でも数式ではなく直値で、F×H%
 * からの逆算はしない)。未入力ならF/Hは空欄のまま(捏造しない)。
 *
 * テンプレートの発熱源欄は7行(B13:J19)しかない — 8件目以降がある場合は
 * 合計発熱量J20(=SUM(J13:J19))がアプリの合計と食い違ってしまうため、
 * 最終行にあふれた分をまとめて計上する(件数を勝手に切り捨てない。この
 * 場合F/Hは複数件の合算にならないため空欄のまま)。
 */
function writeHeatSources(ws: import("exceljs").Worksheet, heatSources: VentilationHeatSourceExportItem[]) {
  const overflow = heatSources.length > HEAT_SOURCE_ROWS.length;
  const visibleCount = overflow ? HEAT_SOURCE_ROWS.length - 1 : heatSources.length;
  HEAT_SOURCE_ROWS.forEach((row, i) => {
    if (i < visibleCount) {
      ws.getCell(`B${row}`).value = heatSources[i].name;
      ws.getCell(`F${row}`).value = heatSources[i].capacity || "";
      ws.getCell(`H${row}`).value = heatSources[i].loadFactorPercent ?? "";
      ws.getCell(`J${row}`).value = heatSources[i].heatW;
    } else if (overflow && i === HEAT_SOURCE_ROWS.length - 1) {
      const rest = heatSources.slice(visibleCount);
      ws.getCell(`B${row}`).value = `他${rest.length}件`;
      ws.getCell(`F${row}`).value = "";
      ws.getCell(`H${row}`).value = "";
      ws.getCell(`J${row}`).value = rest.reduce((sum, s) => sum + s.heatW, 0);
    } else {
      ws.getCell(`B${row}`).value = "";
      ws.getCell(`F${row}`).value = "";
      ws.getCell(`H${row}`).value = "";
      ws.getCell(`J${row}`).value = "";
    }
  });
}

function clearFilterOnlyCells(ws: import("exceljs").Worksheet, cells: string[]) {
  for (const addr of cells) ws.getCell(addr).value = null;
}

export async function exportOutdoorVentilationExcel(data: OutdoorVentilationExportData): Promise<{ fileName: string }> {
  const { workbook, ws } = await loadActiveTemplateSheet("ventilationOutdoor", [
    "屋外フィルタ有り　東京",
    "屋外フィルタ有り　那覇",
    "屋外フィルタ無し　東京",
  ]);
  keepOnlyWorksheet(workbook, ws);
  // フィルタ有りシートのレイアウトをフィルタ無しの場合にも流用しているため
  // (共通項目の行・列位置が完全に一致する上位互換レイアウト — 差分はフィルタ
  // 関連の数行のみ)、シート名(タブ名)がそのまま「フィルタ有り」表記の
  // ままだと、フィルタを使わない計算でも開いた時に「フィルタ有り」に見えて
  // 紛らわしい。フィルタ無しの場合はタブ名も実態に合わせて書き換える。
  if (!data.useFilter) ws.name = ws.name.replace("フィルタ有り", "フィルタ無し");

  if (data.caseInfo) {
    ws.getCell("C3").value = data.caseInfo.projectName;
    ws.getCell("C4").value = data.caseInfo.panelName;
    ws.getCell("O4").value = data.caseInfo.managementNumber;
  }

  // a) 盤周囲温度及び盤内部温度 — ti(平均)はJSIA-T1016使用例どおり40℃固定
  // (アプリのAVERAGE_INTERNAL_TEMP_C定数と同じ — 換気計算.md参照の golden
  // テストで確認済み)。
  ws.getCell("F10").value = data.climate.ambientTempC; // to
  ws.getCell("H10").value = data.climate.topTempC; // tt
  ws.getCell("J10").value = 40; // ti

  // b) 盤内部発熱源
  writeHeatSources(ws, data.heatSources);

  // c) 盤表面面積 — テンプレートはW/H/H1/D/D1の外形寸法(F23/H23/J23/L23/N23)
  // から面積を計算する式(F25=F23*N23等)だが、アプリの面積欄は寸法から自動
  // 計算した後も直接上書きできるため、面積セル(F25等)は常にアプリの現在値
  // で直接上書きする(テンプレートの数式に頼らない — 面積を直接入力した
  // ケースと寸法から計算したケースを区別しない)。外形寸法欄はユーザーが
  // 寸法を入力していれば併せて書き込む(未入力なら空欄のまま — 捏造しない)。
  if (data.dimensions) {
    ws.getCell("F23").value = data.dimensions.widthM; // W
    ws.getCell("H23").value = data.dimensions.heightM; // H
    ws.getCell("J23").value = data.dimensions.heightH1M; // H1
    ws.getCell("L23").value = data.dimensions.depthM; // D
    ws.getCell("N23").value = data.dimensions.depthD1M; // D1
  }
  const { roofM2, face1M2, face2M2, face3M2, face4M2 } = data.surfaceAreas;
  ws.getCell("F25").value = roofM2; // SRO
  ws.getCell("J25").value = face1M2; // SSE
  ws.getCell("L25").value = face2M2; // SWS
  ws.getCell("N25").value = face3M2; // SNW
  ws.getCell("P25").value = face4M2; // SNE
  ws.getCell("H25").value = face1M2 + face2M2 + face3M2 + face4M2; // SSO(4面合計)

  ws.getCell("F29").value = data.transmittance.roofWPerM2K; // URO
  ws.getCell("H29").value = data.transmittance.sideWPerM2K; // USO
  ws.getCell("N29").value = data.equivalentOutsideTemp.roofC; // tSH
  ws.getCell("P29").value = data.equivalentOutsideTemp.face1C; // tSE
  ws.getCell("R29").value = data.equivalentOutsideTemp.face2C; // tWS
  ws.getCell("T29").value = data.equivalentOutsideTemp.face3C; // tNW
  ws.getCell("V29").value = data.equivalentOutsideTemp.face4C; // tNE

  ws.getCell("H43").value = data.supplyAreaM2; // Ai
  ws.getCell("H44").value = data.exhaustAreaM2; // Ao
  ws.getCell("S48").value = data.heightDiffM; // h
  ws.getCell("S53").value = data.hoodFlowCoefficientX; // X
  if (data.fanCapacityM3PerHPerUnit != null) ws.getCell("S54").value = data.fanCapacityM3PerHPerUnit; // F

  if (data.useFilter) {
    ws.getCell("V43").value = data.ventResistanceCoefficient; // ζC
    ws.getCell("V44").value = data.filterResistanceCoefficient ?? 0; // ζF
    if (data.filterRatedVelocityMPerS != null) ws.getCell("O58").value = data.filterRatedVelocityMPerS;
    ws.getCell("Q60").value = { formula: "MAX(H53,T59)" };
  } else {
    ws.getCell("N43").value = data.noFilterDischargeCoefficient; // α (置換 — フィルタ無し時は固定値)
    ws.getCell("S55").value = data.ventResistanceCoefficient; // ζ (置換 — ζC単独)
    clearFilterOnlyCells(ws, ["R43", "V43", "R44", "V44", "H58", "O58", "M59", "T59"]);
    ws.getCell("J60").value = null;
    ws.getCell("Q60").value = { formula: "H53" };
  }

  await embedOutlineImage(workbook, ws, data.outlineDrawing, OUTLINE_IMAGE_ANCHOR);
  await embedOutlineImage(workbook, ws, data.ventLayoutDrawing, OUTDOOR_VENT_LAYOUT_ANCHOR);

  const fileName = `換気計算書_屋外_${data.caseInfo?.managementNumber || new Date().toLocaleDateString("ja-JP").replace(/\//g, "")}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportIndoorVentilationExcel(data: IndoorVentilationExportData): Promise<{ fileName: string }> {
  const { workbook, ws } = await loadActiveTemplateSheet("ventilationIndoor", ["屋内フィルタ有り", "屋内フィルタ無し"]);
  keepOnlyWorksheet(workbook, ws);
  // 屋外側と同じ理由 — フィルタ有りシートのレイアウトをフィルタ無しにも
  // 流用しているため、タブ名は実態(data.useFilter)に合わせて書き換える。
  if (!data.useFilter) ws.name = ws.name.replace("フィルタ有り", "フィルタ無し");

  // 提供テンプレートの見出し文言(A6)は屋内シートでも「屋外キュービクルの
  // 換気計算」のままになっている(元ファイル自体の記載漏れ) — 誤った表記を
  // そのまま出力しないよう、屋内用に訂正して書き込む。
  ws.getCell("A6").value = "屋内キュービクルの換気計算　回路電圧 3φ3w 6 600 V　50 Hz";

  if (data.caseInfo) {
    ws.getCell("C3").value = data.caseInfo.projectName;
    ws.getCell("C4").value = data.caseInfo.panelName;
    ws.getCell("O4").value = data.caseInfo.managementNumber;
  }

  ws.getCell("F10").value = 30; // to — JSIA-T1016屋内使用例の固定値(全地域共通条件)
  ws.getCell("H10").value = 50; // tt — 同上
  ws.getCell("J10").value = 40; // ti

  writeHeatSources(ws, data.heatSources);

  ws.getCell("F23").value = data.dimensions.widthM; // W
  ws.getCell("H23").value = data.dimensions.heightM; // H
  ws.getCell("J23").value = data.dimensions.depthM; // D
  ws.getCell("F29").value = data.transmittance.roofWPerM2K; // URi
  ws.getCell("H29").value = data.transmittance.sideWPerM2K; // USi

  ws.getCell("H31").value = data.supplyAreaM2; // Ai
  ws.getCell("H32").value = data.exhaustAreaM2; // Ao
  ws.getCell("S36").value = data.heightDiffM; // h
  ws.getCell("S41").value = data.hoodFlowCoefficientX; // X
  if (data.fanCapacityM3PerHPerUnit != null) ws.getCell("S42").value = data.fanCapacityM3PerHPerUnit; // F

  if (data.useFilter) {
    ws.getCell("V31").value = data.ventResistanceCoefficient; // ζC
    ws.getCell("V32").value = data.filterResistanceCoefficient ?? 0; // ζF
    if (data.filterRatedVelocityMPerS != null) ws.getCell("O46").value = data.filterRatedVelocityMPerS;
    ws.getCell("Q48").value = { formula: "MAX(H41,T47)" };
  } else {
    ws.getCell("N31").value = data.noFilterDischargeCoefficient; // α (置換)
    ws.getCell("S43").value = data.ventResistanceCoefficient; // ζ (置換)
    clearFilterOnlyCells(ws, ["R31", "V31", "R32", "V32", "H46", "O46", "M47", "T47"]);
    ws.getCell("J48").value = null;
    ws.getCell("Q48").value = { formula: "H41" };
  }

  await embedOutlineImage(workbook, ws, data.outlineDrawing, OUTLINE_IMAGE_ANCHOR);
  await embedOutlineImage(workbook, ws, data.ventLayoutDrawing, INDOOR_VENT_LAYOUT_ANCHOR);

  const fileName = `換気計算書_屋内_${data.caseInfo?.managementNumber || new Date().toLocaleDateString("ja-JP").replace(/\//g, "")}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}
