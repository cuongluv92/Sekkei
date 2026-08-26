import ExcelJS from "exceljs";
import { formatDrawingNumber } from "@/lib/utils/designNumbering";
import { designCaseService } from "./designCaseService";
import { scheduleService } from "./scheduleService";
import type { CasePanel, DesignCaseWithPanels, PanelNo } from "@/lib/types/design";

/**
 * ②図面管理台帳 ファイル取込 — reads an existing/legacy ledger workbook the
 * user already has (same column layout as our own export, see ledgerExport.ts:
 * one sheet per year, A1="XXXX年" title, header row 2, data from row 3:
 * A=年(2桁) B=連番 C=管理番号 D=工事番号 E=客先名 F=客先担当 G=件名 H=盤名称
 * I=面数 J=製造完了 K=出荷日) and turns each row into a 案件 (+盤 +納品日)
 * so historical data doesn't have to be re-typed by hand.
 */

const FULLWIDTH_DIGIT_OFFSET = 0xff10 - 0x30;

function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - FULLWIDTH_DIGIT_OFFSET));
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("");
    }
    if ("result" in v) return v.result == null ? "" : String(v.result);
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v).trim();
}

function extractYear(text: string): number | null {
  const normalized = toHalfWidthDigits(text);
  const full = normalized.match(/(\d{4})/);
  if (full) return Number(full[0]);
  const short = normalized.match(/(\d{1,2})/);
  if (short) return 2000 + Number(short[0]);
  return null;
}

export interface ParsedLedgerRow {
  sheetName: string;
  excelRowNumber: number;
  year: number;
  sequenceNo: number;
  drawingNumber: string;
  managementNumber: string;
  constructionNumber: string;
  orderer: string;
  customerContact: string;
  projectName: string;
  panelNames: string[];
  faceCount: number | null;
  manufacturingComplete: boolean;
  deliveryDate: string | null;
}

/** Parses every year-sheet in the uploaded workbook. Sheets that don't carry a recognizable "XXXX年" title are skipped, not treated as an error. */
export async function parseDrawingLedgerFile(file: File): Promise<ParsedLedgerRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const rows: ParsedLedgerRow[] = [];
  for (const ws of workbook.worksheets) {
    const year = extractYear(cellText(ws.getCell("A1"))) ?? extractYear(ws.name);
    if (!year) continue;

    const lastRow = Math.max(ws.rowCount, 3);
    let blankStreak = 0;
    for (let r = 3; r <= lastRow + 2 && blankStreak < 2; r++) {
      const seqText = cellText(ws.getCell(`B${r}`));
      const managementNumber = cellText(ws.getCell(`C${r}`));
      const projectName = cellText(ws.getCell(`G${r}`));
      if (!seqText && !managementNumber && !projectName) {
        blankStreak++;
        continue;
      }
      blankStreak = 0;

      const sequenceNo = Number(toHalfWidthDigits(seqText).replace(/[^\d]/g, ""));
      if (!Number.isFinite(sequenceNo) || sequenceNo <= 0) continue;

      const panelNames = cellText(ws.getCell(`H${r}`))
        .split("・")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 7);
      const faceMatch = cellText(ws.getCell(`I${r}`)).match(/\d+/);

      const deliveryRaw = ws.getCell(`K${r}`).value;
      let deliveryDate: string | null = null;
      if (deliveryRaw instanceof Date) {
        deliveryDate = deliveryRaw.toISOString().slice(0, 10);
      } else {
        const t = cellText(ws.getCell(`K${r}`));
        if (t) {
          const parsed = new Date(t);
          if (!Number.isNaN(parsed.getTime())) deliveryDate = parsed.toISOString().slice(0, 10);
        }
      }

      rows.push({
        sheetName: ws.name,
        excelRowNumber: r,
        year,
        sequenceNo,
        drawingNumber: formatDrawingNumber(year, sequenceNo),
        managementNumber,
        constructionNumber: cellText(ws.getCell(`D${r}`)),
        orderer: cellText(ws.getCell(`E${r}`)),
        customerContact: cellText(ws.getCell(`F${r}`)),
        projectName,
        panelNames,
        faceCount: faceMatch ? Number(faceMatch[0]) : null,
        manufacturingComplete: cellText(ws.getCell(`J${r}`)).trim() !== "",
        deliveryDate,
      });
    }
  }
  return rows;
}

export interface LedgerImportRow extends ParsedLedgerRow {
  /** True when an existing 案件 already has the same 図面番号 — offered as unselected by default, never blocked outright (図面番号 isn't a DB-unique key). */
  isDuplicate: boolean;
}

export function annotateDuplicateRows(
  rows: ParsedLedgerRow[],
  existing: DesignCaseWithPanels[],
): LedgerImportRow[] {
  const existingDrawingNumbers = new Set(existing.map((e) => e.case.drawingNumber));
  return rows.map((row) => ({ ...row, isDuplicate: existingDrawingNumbers.has(row.drawingNumber) }));
}

function blankPanel(caseId: string, panelNo: PanelNo, name: string, faceCount: number | null): CasePanel {
  return {
    id: `panel-${caseId}-${panelNo}`,
    caseId,
    panelNo,
    panelName: name,
    panelStructure: "",
    faceCount,
    designDueDate: null,
    designEstimatedHours: null,
    designActualHours: null,
    productionEstimatedHours: null,
    productionActualHours: null,
    electricalMethod: "",
    ratedVoltage: "",
    ratedCurrent: "",
    ratedBreakingCapacity: "",
    frequency: "",
    controlVoltage: "",
    protectionRating: "",
  };
}

/** Creates one 案件 per row (in order, sequentially — each insert must see the previous one for correct auto-sequencing within a year). Returns the number of 案件 created. */
export async function commitLedgerImportRows(rows: LedgerImportRow[]): Promise<number> {
  let created = 0;
  for (const row of rows) {
    const designCase = await designCaseService.create({
      year: row.year,
      requestType: "",
      managementNumber: row.managementNumber,
      constructionNumber: row.constructionNumber,
      orderer: row.orderer,
      customerContact: row.customerContact,
      projectName: row.projectName,
      indexCategory: "other",
      drawingNumber: row.drawingNumber,
    });

    if (row.manufacturingComplete) {
      await designCaseService.update(designCase.id, { manufacturingComplete: true });
    }

    if (row.panelNames.length > 0) {
      const panels = row.panelNames.map((name, i) =>
        blankPanel(designCase.id, (i + 1) as PanelNo, name, i === 0 ? row.faceCount : null),
      );
      await designCaseService.savePanels(designCase.id, panels);
    }

    if (row.deliveryDate) {
      await scheduleService.save({
        caseId: designCase.id,
        sheetMetalOrderDate: null,
        sheetMetalDeliveryDate: null,
        boxOrderDate: null,
        boxDeliveryDate: null,
        accessoryOrderDate: null,
        accessoryDeliveryDate: null,
        productionStartDate: null,
        productionEndDate: null,
        productionEndRefDate: null,
        inspectionStartDate: null,
        inspectionEndDate: null,
        inspectionEndRefDate: null,
        witnessStartDate: null,
        witnessEndDate: null,
        witnessEndRefDate: null,
        shippingStartDate: null,
        shippingEndDate: null,
        shippingEndRefDate: null,
        deliveryDate: row.deliveryDate,
        boxManufacturer: "",
        sheetMetalManufacturer: "",
      });
    }

    created++;
  }
  return created;
}
