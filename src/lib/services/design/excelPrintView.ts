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
 * merged cells, column widths, row heights, fills, borders, alignment,
 * print area, and page-fit scaling — and opens the browser's native print
 * dialog on it. This is how every 設計管理 "in" (print) button prints: always
 * in the exact format of whichever template is currently active in Storage,
 * never a separately hand-built layout that could drift from the real Excel
 * file.
 *
 * Page count matching the real file specifically relies on honoring the
 * template's own ws.pageSetup: printArea (so stray helper cells outside what
 * Excel actually prints are never rendered), and fitToPage/fitToWidth/
 * fitToHeight or scale (so a sheet the template author set to "fit to 1
 * page wide" prints on one page here too, instead of spilling across
 * several at 100%). Nothing is guessed — if the template has no such
 * settings, this renders unscaled, same as Excel would.
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
const DEFAULT_MARGIN_MM = 8;
const PX_PER_MM = 96 / 25.4;
const PX_PER_PT = 96 / 72;

/** ws.pageSetup.paperSize codes actually used in this codebase (ECMA-376 ST_PaperSize). */
const PAGE_SIZES_MM: Record<number, { name: string; width: number; height: number }> = {
  8: { name: "A3", width: 297, height: 420 },
  9: { name: "A4", width: 210, height: 297 },
};

/** Falls back to A4 (this codebase's previous only option) if the template didn't set a recognized paperSize. */
function pageSize(ws: Worksheet): { name: string; width: number; height: number } {
  const code = ws.pageSetup?.paperSize;
  return (typeof code === "number" && PAGE_SIZES_MM[code]) || PAGE_SIZES_MM[9];
}

interface CellRef {
  col: number;
  row: number;
}

interface CellRange {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
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

/** Parses pageSetup.printTitlesRow ("1:5" or "$1:$5") into an inclusive row range. */
function parseRowRange(value: string | undefined): { r1: number; r2: number } | null {
  if (!value) return null;
  const cleaned = value.replace(/\$/g, "");
  const [a, b] = cleaned.split(":");
  const r1 = Number(a);
  const r2 = Number(b ?? a);
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;
  return { r1: Math.min(r1, r2), r2: Math.max(r1, r2) };
}

function parseRange(range: string): CellRange {
  // A printArea like "Sheet1!$A$1:$P$36" carries a sheet-name prefix and $ anchors — strip both.
  const cleaned = range.includes("!") ? range.split("!").pop()! : range;
  const [a, b] = cleaned.replace(/\$/g, "").split(":");
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
  // Whole-pixel widths only — a fractional CSS border width (the old 1.5px/
  // 2.5px) gets anti-aliased by the browser at print time, which is what
  // made every line look soft/blurry and heavier than intended on paper.
  const width = side.style === "thick" ? "3px" : side.style === "medium" ? "2px" : "1px";
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

/**
 * Formats a number the way Excel would display it under a given numFmt —
 * the print view renders plain HTML text, so unlike a real .xlsx (where the
 * numFmt is applied by Excel itself at display time) it must apply the
 * format here or the raw float leaks through (e.g. 12.229999999999999).
 * Only covers the numeric "#,##0.00"-style codes actually used in this
 * codebase: decimal places = digits after ".", thousands separator = "," in
 * the integer part. Falls back to the raw string for anything else (dates,
 * percentages, "General", text formats).
 */
function formatNumberWithFmt(value: number, fmt: string | undefined): string {
  if (!fmt || fmt === "General" || fmt.includes("%") || fmt.includes("/")) return String(value);
  const decimalMatch = /\.(0+)/.exec(fmt);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;
  const useGrouping = fmt.includes(",");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });
}

function cellText(cell: Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  if (typeof v === "number") return formatNumberWithFmt(v, cell.numFmt);
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

/** Margins in mm, from the template's own pageSetup (stored in inches) — falls back to a plain 8mm on every side if unset. */
function marginsMm(ws: Worksheet): { top: number; right: number; bottom: number; left: number } {
  const m = ws.pageSetup?.margins;
  if (!m) return { top: DEFAULT_MARGIN_MM, right: DEFAULT_MARGIN_MM, bottom: DEFAULT_MARGIN_MM, left: DEFAULT_MARGIN_MM };
  return { top: m.top * 25.4, right: m.right * 25.4, bottom: m.bottom * 25.4, left: m.left * 25.4 };
}

/**
 * Scale factor to reproduce the template's own "fit to page" / "scale %"
 * print setting. Only ever shrinks (never enlarges past 100%), and only
 * acts on settings the template actually specifies — an unscaled template
 * renders at 1 here too, same as it would in Excel.
 */
function computeAutoFitScale(
  ws: Worksheet,
  orientation: "portrait" | "landscape",
  tableWidthPx: number,
  tableHeightPx: number,
): number {
  const margins = marginsMm(ws);
  const { width, height } = pageSize(ws);
  const pageWidthMm = orientation === "landscape" ? height : width;
  const pageHeightMm = orientation === "landscape" ? width : height;
  const printableWidthPx = (pageWidthMm - margins.left - margins.right) * PX_PER_MM;
  const printableHeightPx = (pageHeightMm - margins.top - margins.bottom) * PX_PER_MM;

  const setup = ws.pageSetup;
  if (setup?.fitToPage) {
    // ExcelJS/Excel both default an unset fitToWidth/fitToHeight to 1 page once fitToPage is on.
    const fitToWidth = setup.fitToWidth ?? 1;
    const fitToHeight = setup.fitToHeight ?? 1;
    const widthScale = fitToWidth > 0 ? Math.min(1, (printableWidthPx * fitToWidth) / tableWidthPx) : 1;
    const heightScale = fitToHeight > 0 ? Math.min(1, (printableHeightPx * fitToHeight) / tableHeightPx) : 1;
    return Math.min(widthScale, heightScale, 1);
  }
  if (typeof setup?.scale === "number" && setup.scale > 0 && setup.scale !== 100) {
    return Math.min(1, setup.scale / 100);
  }
  return 1;
}

export function renderWorksheetHtml(ws: Worksheet): string {
  const sheetColCount = ws.columnCount || ws.actualColumnCount || 1;
  const sheetRowCount = ws.rowCount || ws.actualRowCount || 1;

  // Honor the template's own print area (Excel never prints helper columns/rows left outside it) — falls back to the full used range if unset.
  const printArea = ws.pageSetup?.printArea ? parseRange(ws.pageSetup.printArea) : null;
  const colStart = printArea?.c1 ?? 1;
  const colEnd = printArea?.c2 ?? sheetColCount;
  const rowStart = printArea?.r1 ?? 1;
  const rowEnd = printArea?.r2 ?? sheetRowCount;

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
  for (let c = colStart; c <= colEnd; c++) {
    const w = ws.getColumn(c).width ?? DEFAULT_COL_WIDTH;
    colWidthsPx.push(Math.max(6, Math.round(w * 7 + 5)));
  }
  const rowHeightsPt: number[] = [];
  for (let r = rowStart; r <= rowEnd; r++) {
    rowHeightsPt.push(ws.getRow(r).height ?? DEFAULT_ROW_HEIGHT_PT);
  }

  const orientation = ws.pageSetup?.orientation === "portrait" ? "portrait" : "landscape";
  const tableWidthPx = colWidthsPx.reduce((a, b) => a + b, 0);
  const tableHeightPx = rowHeightsPt.reduce((a, b) => a + b * PX_PER_PT, 0);
  const scale = computeAutoFitScale(ws, orientation, tableWidthPx, tableHeightPx);

  // Rows repeated on every printed page (e.g. the title/legend/month header)
  // — ExcelJS's own pageSetup.printTitlesRow, honored the same way a real
  // Excel print would. Left out of the scrolling body below so it isn't
  // duplicated, and rendered inside <thead>, which browsers natively repeat
  // on each page when a <table> spans more than one.
  const titleRows = parseRowRange(ws.pageSetup?.printTitlesRow);

  // Rows that came from the same vertical cell merge (e.g. one 案件's whole
  // multi-row block) must land on the same page together — otherwise a
  // page break can fall in the middle of a block, splitting its label/color
  // band across two sheets. Rows outside any vertical merge are their own
  // single-row group. min() picks a merge's own r1 as the whole group's
  // anchor so nested/adjacent merges never fight over cells that belong to
  // more than one merge.
  const groupRootByRow = new Map<number, number>();
  for (const m of merges) {
    if (m.r2 <= m.r1) continue;
    for (let r = m.r1; r <= m.r2; r++) {
      groupRootByRow.set(r, Math.min(groupRootByRow.get(r) ?? m.r1, m.r1));
    }
  }

  function renderRow(r: number): string {
    const rowModel = ws.getRow(r);
    const heightPt = (rowModel.height ?? DEFAULT_ROW_HEIGHT_PT) * scale;
    const cellsHtml: string[] = [];
    for (let c = colStart; c <= colEnd; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = rowModel.getCell(c);
      const span = anchorSpan.get(`${r}:${c}`);
      const font = cell.font;
      const align = cell.alignment;
      const fill = cell.fill;
      const border = cell.border ?? {};

      const rawText = cellText(cell);
      // Real Excel lets a cell's text spill into an adjacent EMPTY cell
      // instead of clipping — this matters a lot for the narrow per-day
      // columns in 納入工程, where an end-of-range label ("15", "済") is
      // wider than its own 1-day column. Reproduce that here (only for
      // cells that actually hold text — an empty cell has nothing to spill,
      // and clipping wrapped/normal table text is still correct elsewhere).
      const overflowStyle = rawText && !align?.wrapText ? "overflow:visible;position:relative;z-index:1" : "overflow:hidden";
      const styles: string[] = [
        `border-top:${borderSideCss(border.top)}`,
        `border-left:${borderSideCss(border.left)}`,
        `border-right:${borderSideCss(border.right)}`,
        `border-bottom:${borderSideCss(border.bottom)}`,
        `font-size:${(font?.size ?? 10) * scale}pt`,
        `text-align:${align?.horizontal ?? "left"}`,
        `vertical-align:${align?.vertical === "middle" ? "middle" : align?.vertical === "bottom" ? "bottom" : "top"}`,
        `white-space:${align?.wrapText ? "pre-wrap" : "nowrap"}`,
        `padding:${Math.max(0.5, 1 * scale)}px ${Math.max(1, 3 * scale)}px`,
        overflowStyle,
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
      const text = escapeHtml(rawText).replace(/\n/g, "<br/>");
      cellsHtml.push(`<td${spanAttr} style="${styles.join(";")}">${text}</td>`);
    }
    return `<tr style="height:${heightPt}pt">${cellsHtml.join("")}</tr>`;
  }

  const theadRowsHtml: string[] = [];
  const bodyGroupsHtml: string[] = [];
  let currentGroupRoot: number | null = null;
  let currentGroupRows: string[] = [];
  const flushGroup = () => {
    if (currentGroupRows.length === 0) return;
    bodyGroupsHtml.push(
      `<tbody style="break-inside:avoid;page-break-inside:avoid">${currentGroupRows.join("")}</tbody>`,
    );
    currentGroupRows = [];
  };
  for (let r = rowStart; r <= rowEnd; r++) {
    if (titleRows && r >= titleRows.r1 && r <= titleRows.r2) {
      theadRowsHtml.push(renderRow(r));
      continue;
    }
    const groupRoot = groupRootByRow.get(r) ?? r;
    if (groupRoot !== currentGroupRoot) {
      flushGroup();
      currentGroupRoot = groupRoot;
    }
    currentGroupRows.push(renderRow(r));
  }
  flushGroup();

  // Rounded to whole pixels — a fractional column width leaves cell edges
  // (and the borders drawn on them) off the pixel grid, which is the other
  // half of the same blurriness the border-width fix above addresses.
  const colgroup = colWidthsPx.map((w) => `<col style="width:${Math.round(w * scale)}px" />`).join("");
  const thead = theadRowsHtml.length > 0 ? `<thead>${theadRowsHtml.join("")}</thead>` : "";
  return (
    `<table style="border-collapse:collapse;table-layout:fixed;font-family:'Yu Gothic','Meiryo',sans-serif;background:#ffffff;color:#000000">` +
    `<colgroup>${colgroup}</colgroup>${thead}${bodyGroupsHtml.join("")}</table>`
  );
}

/** Renders `ws` into a hidden print-only container and opens the browser print dialog on it. */
export function printWorksheet(ws: Worksheet): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const orientation = ws.pageSetup?.orientation === "portrait" ? "portrait" : "landscape";
  const margins = marginsMm(ws);
  const { name: paperName } = pageSize(ws);
  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.style.cssText = "background:#ffffff;color:#000000;color-scheme:light";
  root.innerHTML = renderWorksheetHtml(ws);
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page { size: ${paperName} ${orientation}; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
      html, body { background: #ffffff !important; }
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { display: block !important; color-scheme: light; }
      #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
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
