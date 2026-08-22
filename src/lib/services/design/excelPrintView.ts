import type {
  Cell,
  CellErrorValue,
  CellFormulaValue,
  CellHyperlinkValue,
  CellRichTextValue,
  CellSharedFormulaValue,
  Worksheet,
} from "exceljs";

/**
 * Renders an already-filled ExcelJS worksheet (same workbook the "Excel"
 * button downloads) as an HTML table that reproduces its real layout —
 * merged cells, column widths, row heights, fills, borders, alignment — and
 * opens the browser's native print dialog on it. This is how every 設計管理
 * "in" (print) button prints: always in the exact format of whichever
 * template is currently active in Storage, never a separately hand-built
 * layout that could drift from the real Excel file.
 *
 * Printer selection and remembering the last-used printer are both handled
 * by the browser/OS print dialog itself (window.print()) — there is no web
 * API that lets a page enumerate printers or persist a default beyond what
 * the native dialog already does automatically.
 */

const PRINT_ROOT_ID = "__design_print_root__";
const PRINT_STYLE_ID = "__design_print_style__";
const DEFAULT_ROW_HEIGHT_PT = 15;
const DEFAULT_COL_WIDTH = 8.43;

interface CellRef {
  col: number;
  row: number;
}

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseCellRef(ref: string): CellRef {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return { col: 1, row: 1 };
  return { col: colLettersToNumber(m[1]), row: Number(m[2]) };
}

function parseRange(range: string): { c1: number; r1: number; c2: number; r2: number } {
  const [a, b] = range.split(":");
  const p1 = parseCellRef(a);
  const p2 = parseCellRef(b ?? a);
  return { c1: Math.min(p1.col, p2.col), r1: Math.min(p1.row, p2.row), c2: Math.max(p1.col, p2.col), r2: Math.max(p1.row, p2.row) };
}

function argbToCss(argb?: string): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return `#${hex}`;
}

function borderSideCss(side?: { style?: string; color?: { argb?: string } }): string {
  if (!side?.style) return "none";
  const width = side.style === "thick" ? "2.5px" : side.style === "medium" ? "1.5px" : "1px";
  const style = side.style === "double" ? "double" : side.style === "dashed" || side.style === "dotted" ? "dashed" : "solid";
  const color = argbToCss(side.color?.argb) ?? "#000000";
  return `${width} ${style} ${color}`;
}

function isRichText(v: unknown): v is CellRichTextValue {
  return typeof v === "object" && v !== null && Array.isArray((v as CellRichTextValue).richText);
}
function isFormulaValue(v: unknown): v is CellFormulaValue | CellSharedFormulaValue {
  return typeof v === "object" && v !== null && ("formula" in v || "sharedFormula" in v);
}
function isHyperlinkValue(v: unknown): v is CellHyperlinkValue {
  return typeof v === "object" && v !== null && "hyperlink" in v && "text" in v;
}
function isErrorValue(v: unknown): v is CellErrorValue {
  return typeof v === "object" && v !== null && "error" in v;
}

function cellText(cell: Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  if (typeof v === "object") {
    if (isRichText(v)) return v.richText.map((r) => r.text ?? "").join("");
    if (isFormulaValue(v)) return v.result != null ? String(v.result) : "";
    if (isHyperlinkValue(v)) return v.text;
    if (isErrorValue(v)) return v.error;
    return "";
  }
  return String(v);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderWorksheetHtml(ws: Worksheet): string {
  const colCount = ws.columnCount || ws.actualColumnCount || 1;
  const rowCount = ws.rowCount || ws.actualRowCount || 1;

  const merges = (ws.model.merges ?? []).map(parseRange);
  const covered = new Set<string>();
  const anchorSpan = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const m of merges) {
    anchorSpan.set(`${m.r1}:${m.c1}`, { rowSpan: m.r2 - m.r1 + 1, colSpan: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) {
        if (r === m.r1 && c === m.c1) continue;
        covered.add(`${r}:${c}`);
      }
    }
  }

  const colWidthsPx: number[] = [];
  for (let c = 1; c <= colCount; c++) {
    const w = ws.getColumn(c).width ?? DEFAULT_COL_WIDTH;
    colWidthsPx.push(Math.max(6, Math.round(w * 7 + 5)));
  }

  const rowsHtml: string[] = [];
  for (let r = 1; r <= rowCount; r++) {
    const rowModel = ws.getRow(r);
    const heightPt = rowModel.height ?? DEFAULT_ROW_HEIGHT_PT;
    const cellsHtml: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = rowModel.getCell(c);
      const span = anchorSpan.get(`${r}:${c}`);
      const font = cell.font;
      const align = cell.alignment;
      const fill = cell.fill;
      const border = cell.border ?? {};

      const styles: string[] = [
        `border-top:${borderSideCss(border.top)}`,
        `border-left:${borderSideCss(border.left)}`,
        `border-right:${borderSideCss(border.right)}`,
        `border-bottom:${borderSideCss(border.bottom)}`,
        `font-size:${font?.size ?? 10}pt`,
        `text-align:${align?.horizontal ?? "left"}`,
        `vertical-align:${align?.vertical === "middle" ? "middle" : align?.vertical === "bottom" ? "bottom" : "top"}`,
        `white-space:${align?.wrapText ? "pre-wrap" : "nowrap"}`,
        "padding:1px 3px",
        "overflow:hidden",
      ];
      if (fill?.type === "pattern" && fill.fgColor?.argb) {
        const bg = argbToCss(fill.fgColor.argb);
        if (bg) styles.push(`background-color:${bg}`);
      }
      if (font?.bold) styles.push("font-weight:700");
      if (font?.italic) styles.push("font-style:italic");
      const color = argbToCss(font?.color?.argb);
      if (color) styles.push(`color:${color}`);

      const spanAttr = span ? ` rowspan="${span.rowSpan}" colspan="${span.colSpan}"` : "";
      const text = escapeHtml(cellText(cell)).replace(/\n/g, "<br/>");
      cellsHtml.push(`<td${spanAttr} style="${styles.join(";")}">${text}</td>`);
    }
    rowsHtml.push(`<tr style="height:${heightPt}pt">${cellsHtml.join("")}</tr>`);
  }

  const colgroup = colWidthsPx.map((w) => `<col style="width:${w}px" />`).join("");
  return (
    `<table style="border-collapse:collapse;table-layout:fixed;font-family:'Yu Gothic','Meiryo',sans-serif">` +
    `<colgroup>${colgroup}</colgroup><tbody>${rowsHtml.join("")}</tbody></table>`
  );
}

/** Renders `ws` into a hidden print-only container and opens the browser print dialog on it. */
export function printWorksheet(ws: Worksheet): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const orientation = ws.pageSetup?.orientation === "portrait" ? "portrait" : "landscape";
  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.innerHTML = renderWorksheetHtml(ws);
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: A4 ${orientation}; margin: 8mm; }
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { display: block !important; }
    }
    @media screen {
      #${PRINT_ROOT_ID} { display: none; }
    }
  `;
  document.head.appendChild(style);

  const cleanup = () => {
    root.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  setTimeout(cleanup, 60000);
}
