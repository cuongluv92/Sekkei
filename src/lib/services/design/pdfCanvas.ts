import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Shared A4 PDF layout primitives for every 設計管理 PDF export. There is no
 * official PDF template for any of the real Excel templates, so every export
 * lays its fields out as a plain document via this canvas instead of trying
 * to replicate an Excel grid pixel-for-pixel. Renders real Japanese text via
 * an embedded Noto Sans JP subset (SIL OFL 1.1, public/fonts/) — pdf-lib's
 * built-in StandardFonts have no CJK glyphs.
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

export class PdfCanvas {
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

  /** Simple bordered table, repeating the header on a new page when the rows overflow. */
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
      if (this.y - rowHeight < MARGIN) {
        this.newPage();
        drawRow(headers, this.y, true);
        this.y -= rowHeight;
      }
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

export function downloadPdf(bytes: Uint8Array, fileName: string) {
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
