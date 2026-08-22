import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SPEC_GROUPS, WIRING_SPEC_FIELDS, type SpecFieldKey } from "@/lib/types/design";
import { loadDesignRequestPrintFields, loadProductionRequestPrintFields } from "./printFields";

/**
 * PDF export deliberately reads the exact same `loadDesignRequestPrintFields`
 * / `loadProductionRequestPrintFields` used by the Excel export (excelExport.ts)
 * — same case, same panels, same specs, so Excel and PDF can never diverge in
 * content. There is no official PDF template (only the two real Excel
 * templates exist), so this lays the same fields out as a plain document
 * rather than replicating the Excel grid pixel-for-pixel.
 */

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

let cachedFontBytes: ArrayBuffer | null = null;
async function loadJapaneseFontBytes(): Promise<ArrayBuffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const res = await fetch("/fonts/NotoSansJP-Regular.woff");
  if (!res.ok) throw new Error("font-fetch-failed");
  cachedFontBytes = await res.arrayBuffer();
  return cachedFontBytes;
}

class PdfCanvas {
  doc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;

  private constructor(doc: PDFDocument, font: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(): Promise<PdfCanvas> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fontBytes = await loadJapaneseFontBytes();
    const font = await doc.embedFont(fontBytes, { subset: true });
    return new PdfCanvas(doc, font);
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private text(str: string, x: number, size: number, color = rgb(0.1, 0.1, 0.12)) {
    this.page.drawText(str || "", { x, y: this.y, size, font: this.font, color });
  }

  title(str: string) {
    this.ensureSpace(28);
    const size = 18;
    const width = this.font.widthOfTextAtSize(str, size);
    this.text(str, (PAGE_WIDTH - width) / 2, size);
    this.y -= 28;
  }

  sectionHeading(str: string) {
    this.ensureSpace(20);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 3,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 16,
      color: rgb(0.93, 0.94, 0.96),
    });
    this.text(str, MARGIN + 4, 10.5, rgb(0.15, 0.15, 0.18));
    this.y -= 22;
  }

  /** label: value pairs, wrapped several per line. */
  keyValueGrid(pairs: [string, string][], columns = 2) {
    const colWidth = (PAGE_WIDTH - MARGIN * 2) / columns;
    const rowCount = Math.ceil(pairs.length / columns);
    this.ensureSpace(rowCount * 16 + 4);
    for (let i = 0; i < pairs.length; i++) {
      const col = i % columns;
      const rowInGrid = Math.floor(i / columns);
      const x = MARGIN + col * colWidth;
      const rowY = this.y - rowInGrid * 16;
      const [label, value] = pairs[i];
      this.page.drawText(`${label}：`, { x, y: rowY, size: 9, font: this.font, color: rgb(0.45, 0.47, 0.52) });
      this.page.drawText(value || "—", {
        x: x + 60,
        y: rowY,
        size: 9.5,
        font: this.font,
        color: rgb(0.1, 0.1, 0.12),
      });
    }
    this.y -= rowCount * 16 + 8;
  }

  /** Simple bordered table. */
  table(headers: string[], widths: number[], rows: string[][]) {
    const rowHeight = 16;
    const tableWidth = widths.reduce((a, b) => a + b, 0);

    const drawRow = (cells: string[], y: number, bold: boolean) => {
      let x = MARGIN;
      this.page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight + 4,
        width: tableWidth,
        height: rowHeight,
        borderColor: rgb(0.75, 0.76, 0.8),
        borderWidth: 0.5,
        color: bold ? rgb(0.93, 0.94, 0.96) : undefined,
      });
      for (let i = 0; i < cells.length; i++) {
        this.page.drawText(cells[i] ?? "", {
          x: x + 4,
          y: y - rowHeight + 8,
          size: 8.5,
          font: this.font,
          color: rgb(0.1, 0.1, 0.12),
        });
        x += widths[i];
        if (i < cells.length - 1) {
          this.page.drawLine({
            start: { x, y: y - rowHeight + 4 },
            end: { x, y },
            thickness: 0.5,
            color: rgb(0.75, 0.76, 0.8),
          });
        }
      }
    };

    this.ensureSpace(rowHeight * 2);
    drawRow(headers, this.y, true);
    this.y -= rowHeight;

    for (const row of rows) {
      this.ensureSpace(rowHeight);
      drawRow(row, this.y, false);
      this.y -= rowHeight;
    }
    this.y -= 8;
  }

  paragraph(str: string, size = 9.5) {
    if (!str) return;
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const words = str.split(/(\s+|\n)/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      if (word === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      const candidate = line + word;
      if (this.font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    this.ensureSpace(lines.length * 13);
    for (const l of lines) {
      this.text(l, MARGIN, size);
      this.y -= 13;
    }
    this.y -= 6;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

function download(bytes: Uint8Array, fileName: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const EXTERIOR_SPEC_LABEL: Record<string, string> = {
  location: "場所",
  installation: "据付",
  structure: "構造",
  material: "材質",
  color: "色",
  gloss: "艶",
  handleLocation: "場所",
  handleType: "種類",
  keyNo: "鍵(No.)",
  wireEntry: "入線",
  opening: "開口",
  blankPlate: "塞ギ板",
};

const WIRING_SPEC_LABEL: Record<string, string> = {
  electricalMethod: "電気方式",
  powerSource: "電源",
  voltage: "電圧",
  terminalBlock: "端子台",
};

export async function exportDesignRequestPdf(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadDesignRequestPrintFields(caseId);
  const c = fields.case;
  const canvas = await PdfCanvas.create();

  canvas.title("設計依頼書");
  canvas.keyValueGrid(
    [
      ["件名", c.projectName],
      ["図面番号", c.drawingNumber],
      ["注文先", c.orderer],
      ["管理番号", c.managementNumber],
      ["工事番号", c.constructionNumber],
      ["担当", c.assignee],
    ],
    2,
  );

  canvas.sectionHeading("盤①〜⑦");
  canvas.table(
    ["盤", "盤名称", "盤構造", "面数", "設計納期", "見込時間", "実動時間"],
    [24, 130, 90, 40, 70, 60, 60],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.panelName,
      p.panelStructure,
      p.faceCount != null ? String(p.faceCount) : "",
      p.designDueDate ?? "",
      p.designEstimatedHours != null ? String(p.designEstimatedHours) : "",
      p.designActualHours != null ? String(p.designActualHours) : "",
    ]),
  );

  canvas.sectionHeading("外形仕様");
  canvas.table(
    ["項目", "仕様Ⅰ", "仕様Ⅱ", "仕様Ⅲ"],
    [110, 135, 135, 135],
    SPEC_GROUPS.flatMap((g) => g.fields as SpecFieldKey[]).map((fieldKey) => {
      const entry = c.specs[fieldKey];
      return [EXTERIOR_SPEC_LABEL[fieldKey], entry?.spec1 ?? "", entry?.spec2 ?? "", entry?.spec3 ?? ""];
    }),
  );

  canvas.sectionHeading("結線仕様");
  canvas.table(
    ["項目", "仕様Ⅰ", "仕様Ⅱ", "仕様Ⅲ"],
    [110, 135, 135, 135],
    WIRING_SPEC_FIELDS.map((fieldKey) => {
      const entry = c.specs[fieldKey];
      return [WIRING_SPEC_LABEL[fieldKey], entry?.spec1 ?? "", entry?.spec2 ?? "", entry?.spec3 ?? ""];
    }),
  );

  canvas.sectionHeading("設計備考欄");
  canvas.paragraph(c.designRemarks);

  const bytes = await canvas.save();
  const fileName = `設計依頼書_${c.drawingNumber}.pdf`;
  download(bytes, fileName);
  return { fileName };
}

export async function exportProductionRequestPdf(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadProductionRequestPrintFields(caseId);
  const c = fields.case;
  const canvas = await PdfCanvas.create();

  canvas.title("製作依頼書");
  canvas.keyValueGrid(
    [
      ["件名", c.projectName],
      ["図面番号", c.drawingNumber],
      ["注文先", c.orderer],
      ["管理番号", c.managementNumber],
      ["工事番号", c.constructionNumber],
    ],
    2,
  );

  canvas.sectionHeading("盤①〜⑦");
  canvas.table(
    ["盤", "盤名称", "盤構造", "面数", "見込時間", "実動時間"],
    [24, 150, 100, 50, 80, 80],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.panelName,
      p.panelStructure,
      p.faceCount != null ? String(p.faceCount) : "",
      p.productionEstimatedHours != null ? String(p.productionEstimatedHours) : "",
      p.productionActualHours != null ? String(p.productionActualHours) : "",
    ]),
  );

  canvas.sectionHeading("盤①〜⑦（製作仕様）");
  canvas.table(
    ["盤", "電気方式", "定格電圧", "定格電流", "定格短絡遮断容量", "周波数", "制御電圧", "保護等級"],
    [24, 65, 60, 55, 90, 50, 60, 60],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.electricalMethod,
      p.ratedVoltage,
      p.ratedCurrent,
      p.ratedBreakingCapacity,
      p.frequency,
      p.controlVoltage,
      p.protectionRating,
    ]),
  );

  canvas.sectionHeading("検査項目");
  canvas.table(
    ["検査表", "膜厚", "漏電", "漏電アラーム", "耐圧"],
    [95, 95, 95, 95, 95],
    [
      [
        fields.request.inspectionSheet,
        fields.request.filmThickness,
        fields.request.earthLeakage,
        fields.request.earthLeakageAlarm,
        fields.request.withstandVoltage,
      ],
    ],
  );

  canvas.sectionHeading("製作注意事項");
  canvas.paragraph(fields.request.productionNotes);

  const bytes = await canvas.save();
  const fileName = `製作依頼書_${c.drawingNumber}.pdf`;
  download(bytes, fileName);
  return { fileName };
}
