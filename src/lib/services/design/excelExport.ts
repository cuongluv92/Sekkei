import type ExcelJS from "exceljs";
import { SPEC_GROUPS, WIRING_SPEC_FIELDS, type SpecFieldKey } from "@/lib/types/design";
import { formatShortDate, loadDesignRequestPrintFields, loadProductionRequestPrintFields } from "./printFields";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";

/**
 * Cell coordinates below were confirmed by inspecting the real templates
 * cell-by-cell (⑦設計依頼書_2026.xlsx / ⑧製作依頼書_2026.xlsx, sheet "管理番号"),
 * not guessed. The ＢＯＸ/鈑金/部材/完成/出荷/納品/立会 date row (15-16) is
 * confirmed to be the same "予定日" as the matching case_schedules end-date
 * (shared with 工程表, never a separate copy) — see printFields.ts. The 製造者
 * column (L6:M12) on 盤①〜⑦ is still left unfilled — no corresponding field
 * in the schema yet, and not guessed. Row 35/36 (営業/受付/担当/検図/... + 印)
 * is the paper stamp/approval row — deliberately left blank, per the
 * confirmed instruction that it's print-only and needs no DB field.
 *
 * The template itself is fetched from Supabase Storage (設定 > テンプレート管理),
 * never bundled in the app — see excelWorkbook.ts / designTemplateService.ts.
 */

const EXTERIOR_SPEC_ROW: Record<string, number> = {
  location: 17,
  installation: 18,
  structure: 19,
  material: 20,
  color: 21,
  gloss: 22,
  handleLocation: 23,
  handleType: 24,
  keyNo: 25,
  wireEntry: 26,
  opening: 27,
  blankPlate: 28,
};

const WIRING_SPEC_ROW: Record<string, number> = {
  electricalMethod: 17,
  powerSource: 19,
  voltage: 20,
  terminalBlock: 24,
};

/** BOX/鈑金 cells combine a vendor name with the date on the next line (template cells are wrap-text enabled). */
function formatVendorDate(manufacturer: string, iso: string | null): string {
  const date = formatShortDate(iso);
  if (manufacturer && date) return `${manufacturer}\n${date}`;
  return manufacturer || date;
}

function fillSpecs(ws: ExcelJS.Worksheet, specs: Record<string, { spec1: string; spec2: string; spec3: string } | undefined>) {
  for (const group of SPEC_GROUPS) {
    for (const fieldKey of group.fields as SpecFieldKey[]) {
      const row = EXTERIOR_SPEC_ROW[fieldKey];
      const entry = specs[fieldKey];
      ws.getCell(`D${row}`).value = entry?.spec1 ?? "";
      ws.getCell(`F${row}`).value = entry?.spec2 ?? "";
      ws.getCell(`H${row}`).value = entry?.spec3 ?? "";
    }
  }
  for (const fieldKey of WIRING_SPEC_FIELDS) {
    const row = WIRING_SPEC_ROW[fieldKey];
    const entry = specs[fieldKey];
    ws.getCell(`L${row}`).value = entry?.spec1 ?? "";
    ws.getCell(`N${row}`).value = entry?.spec2 ?? "";
    ws.getCell(`P${row}`).value = entry?.spec3 ?? "";
  }
}

export async function exportDesignRequestExcel(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadDesignRequestPrintFields(caseId);
  const c = fields.case;
  const workbook = await loadActiveTemplate("designRequestForm");
  const ws = workbook.worksheets[0];

  ws.getCell("C2").value = c.projectName;
  ws.getCell("O2").value = c.drawingNumber;
  ws.getCell("C3").value = c.orderer;
  ws.getCell("J3").value = c.managementNumber;
  ws.getCell("O3").value = c.constructionNumber;

  let sumEstimated = 0;
  let sumActual = 0;
  for (const panel of fields.panels) {
    const row = 5 + panel.panelNo; // panelNo 1-7 -> rows 6-12
    ws.getCell(`B${row}`).value = panel.panelName;
    ws.getCell(`H${row}`).value = panel.panelStructure;
    ws.getCell(`J${row}`).value = panel.faceCount ?? "";
    ws.getCell(`L${row}`).value = panel.designDueDate ?? "";
    ws.getCell(`N${row}`).value = panel.designEstimatedHours ?? "";
    ws.getCell(`P${row}`).value = panel.designActualHours ?? "";
    sumEstimated += panel.designEstimatedHours ?? 0;
    sumActual += panel.designActualHours ?? 0;
  }
  ws.getCell("N13").value = sumEstimated;
  ws.getCell("P13").value = sumActual;

  fillSpecs(ws, c.specs);
  ws.getCell("B31").value = c.designRemarks;

  const fileName = `設計依頼書_${c.drawingNumber}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportProductionRequestExcel(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadProductionRequestPrintFields(caseId);
  const c = fields.case;
  const workbook = await loadActiveTemplate("productionRequestForm");
  const ws = workbook.worksheets[0];

  ws.getCell("C2").value = c.projectName;
  ws.getCell("O2").value = c.drawingNumber;
  ws.getCell("C3").value = c.orderer;
  ws.getCell("J3").value = c.managementNumber;
  ws.getCell("O3").value = c.constructionNumber;

  let sumEstimated = 0;
  let sumActual = 0;
  for (const panel of fields.panels) {
    const row = 5 + panel.panelNo;
    ws.getCell(`B${row}`).value = panel.panelName;
    ws.getCell(`H${row}`).value = panel.panelStructure;
    ws.getCell(`J${row}`).value = panel.faceCount ?? "";
    ws.getCell(`N${row}`).value = panel.productionEstimatedHours ?? "";
    ws.getCell(`P${row}`).value = panel.productionActualHours ?? "";
    sumEstimated += panel.productionEstimatedHours ?? 0;
    sumActual += panel.productionActualHours ?? 0;
  }
  ws.getCell("N13").value = sumEstimated;
  ws.getCell("P13").value = sumActual;

  const s = fields.schedule;
  ws.getCell("B16").value = formatVendorDate(s.boxManufacturer, s.boxDeliveryDate);
  ws.getCell("D16").value = formatVendorDate(s.sheetMetalManufacturer, s.sheetMetalDeliveryDate);
  ws.getCell("F16").value = formatShortDate(s.accessoryDeliveryDate);
  ws.getCell("J16").value = formatShortDate(s.productionEndDate);
  ws.getCell("L16").value = formatShortDate(s.shippingEndDate);
  ws.getCell("N16").value = formatShortDate(s.deliveryDate);
  ws.getCell("P16").value = formatShortDate(s.witnessEndDate);

  ws.getCell("B18").value = fields.request.productionNotes;

  for (const panel of fields.panels) {
    const row = 23 + panel.panelNo; // panelNo 1-7 -> rows 24-30
    ws.getCell(`B${row}`).value = panel.electricalMethod;
    ws.getCell(`E${row}`).value = panel.ratedVoltage;
    ws.getCell(`H${row}`).value = panel.ratedCurrent;
    ws.getCell(`J${row}`).value = panel.ratedBreakingCapacity;
    ws.getCell(`L${row}`).value = panel.frequency;
    ws.getCell(`N${row}`).value = panel.controlVoltage;
    ws.getCell(`P${row}`).value = panel.protectionRating;
  }

  ws.getCell("C33").value = fields.request.inspectionSheet;
  ws.getCell("F33").value = fields.request.filmThickness;
  ws.getCell("I33").value = fields.request.earthLeakage;
  ws.getCell("L33").value = fields.request.earthLeakageAlarm;
  ws.getCell("O33").value = fields.request.withstandVoltage;

  const fileName = `製作依頼書_${c.drawingNumber}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}
