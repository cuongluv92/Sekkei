import ExcelJS from "exceljs";
import { downloadWorkbook } from "./excelWorkbook";
import { scheduleColorService } from "./scheduleColorService";
import { printWorksheet } from "./excelPrintView";
import {
  addMonths,
  buildDayColorLookupByRow,
  buildMilestoneLabelsByRow,
  computeColoredDays,
  computeMilestones,
  dayCellKeyRow,
  daysInMonth,
  SCREEN_MONTHS_AFTER,
  SCREEN_MONTHS_BEFORE,
  SCREEN_PROCESS_ROWS,
} from "@/lib/utils/scheduleColoring";
import { buildCaseDisplayLabel, buildProjectPanelLines } from "@/lib/utils/designNumbering";
import type { CaseSchedule, DesignCaseWithPanels, ScheduleCategoryKey } from "@/lib/types/design";

/**
 * 納入工程(旧⑤工程表) — 自前生成のA3横1枚レイアウト。以前は取込済みの実テンプレート
 * ファイル(旬3列/月・板金/BOX/部材が同じ行の4行構成)をそのまま使っていた
 * が、画面のタイムライン(ScheduleTimeline.tsx)が実日単位の色分けや行構成
 * (鈑金・BOX納入/アクセサリー納入/製作・検査/立会・出荷の4行)へ進化した
 * ため、Excel側もテンプレートファイルに縛られず画面と同じ構成・同じ表示
 * 月数(SCREEN_MONTHS_BEFORE/AFTER)で出力するように作り直した。
 *
 * 列は画面と同じ実日単位(1日=1列)。以前は旬(初/中/下・3列/月)に丸めて
 * いたが、同じ行・同じ旬内に2つの区分(例: 製作の残り日数と検査の開始
 * 直後)が両方収まる場合、後から処理する側が「同じセルは上書きしない」
 * ルールで完全に見えなくなる(色もラベルも消える)問題があった — 画面は
 * 1日ごとに別セルなので絶対に起きない。実日単位にすることで画面と全く
 * 同じ計算(computeColoredDays/buildDayColorLookupByRow)を使い、この
 * 種の情報欠落を構造的になくす。
 */

// 列幅・行の高さは全て5刻みの整数(端数なし)に揃える — Excel/印刷どちらも
// 同じワークシートの値をそのまま使うため、ここを整数にすれば両方に効く。
const LABEL_COL_A_WIDTH = 15;
// 件名／盤名称は実際の案件名が長いことが多いため、月グリッド側より広め
// に確保する — 全体はA3の印刷幅に収まるようオートフィットで縮小される
// ので、ここを広げても他の帳票のようにはみ出すことはない。
const LABEL_COL_B_WIDTH = 60;
// 5ヶ月分だと日単位で約150列になる — 幅を欲張ると合計の列幅が広くなり
// すぎて、A3の印刷可能幅に収めるためのオートフィット倍率が大きく下がり、
// 文字が小さくなりすぎる(前回の値2だと合計幅が旧・旬レイアウトの1.6倍
// 近くになっていた)。1にすると旧レイアウトとほぼ同じ合計幅になり、
// 追加の縮小がほぼ要らなくなる。
const DAY_COL_WIDTH = 1;
// タイトル/凡例/月見出し行は文字が1行分収まればよく、案件データ行ほどの
// 高さは要らない — この3行だけ低くしてヘッダー部分をコンパクトにする
// (データ行はガントバーのラベルが収まる余裕を保つため20のまま)。
const HEADER_ROW_HEIGHT = 10;
const ROW_HEIGHT = 20;
const TITLE_ROW = 1;
const LEGEND_ROW = 2;
const MONTH_HEADER_ROW = 4;
// 実日単位の列だけだと月のどのあたりかが掴みにくいため、月見出しの下に
// 初(1〜10日)/中(11〜20日)/下(21日〜)の目安見出しを復活させる — 色分け・
// データ列自体は実日単位のまま、あくまで見出しラベルとして重ねるだけ。
const JUN_HEADER_ROW = 5;
const DATA_START_ROW = 6;
const ROW_SPAN = SCREEN_PROCESS_ROWS.length; // 1案件あたりの行数(画面と共通)

// 実テンプレートの凡例と同じ並び(box は sheetMetal の色見本に統合されるため単独では出さない)。
const LEGEND_CATEGORIES: { key: ScheduleCategoryKey; label: string }[] = [
  { key: "sheetMetal", label: "鈑金・BOX納入" },
  { key: "accessory", label: "アクセサリー納入" },
  { key: "production", label: "製作" },
  { key: "inspection", label: "検査" },
  { key: "witness", label: "立会" },
  { key: "shipping", label: "出荷" },
];

// 既存の実テンプレート帳票と同じ、均一に細い罫線(style: "thin")にして、
// 太さではなく色の濃さだけで主要な区切り(案件ブロックの上下端・月の
// 変わり目)を強調する — 以前は THICK に"medium"(実質2倍近い太さ)を
// 使っていたが、印刷すると他の帳票と質感が違って見えるうえ太く滲んで
// 見えたため。THIN(日/旬・行の区切りなどの補助線)はできるだけ主張しない
// よう薄いグレーにし、THICK(案件ブロックの上下端・月の変わり目)との
// 濃淡差で「主要な区切り」と「補助的な区切り」を分ける — 幅は両方とも
// 1pxのまま(端数pxにすると印刷時ににじむため、これ以上は細くしない)。
const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD1D5DB" } };
const THICK: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF1F2937" } };

function toArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

interface LegendEntry {
  key: ScheduleCategoryKey;
  label: string;
  swatchCol: number;
  labelColStart: number;
  labelColEnd: number;
}

// 色見本の幅(列数) — データ列(DAY_COL_WIDTH=1)を実日単位に細分化して
// からは、色見本を「1列」のままにすると米粒のように小さくなってしまう
// (以前の旬グリッドはDAY_COL_WIDTHの実質10倍幅だったため気付かなかった)。
// データ列の細さとは関係なく、色見本自体は複数列分をまとめて確保する。
const LEGEND_SWATCH_SPAN = 6;

/**
 * 凡例(色見本+ラベル)の列配置を1箇所で計算する — 実際に描画する buildHeader
 * と、必要な最終列数を知りたい buildScheduleWorkbook (印刷範囲・列幅設定)
 * の両方がこれを使うことで、2箇所に同じ配置ロジックを重複させない。
 *
 * 行全体に間延びさせず、コンパクトに(エントリ間の間隔なし)まとめた上で
 * `endCol`(月グリッドの最終列)に右詰めする — 1列目から間隔を空けて
 * 並べると、行の左端から右端まで間延びして見えてしまうため。
 */
function layoutLegend(endCol: number): LegendEntry[] {
  const spans = LEGEND_CATEGORIES.map(({ label }) => (label.length > 4 ? 2 : 1));
  const totalWidth = spans.reduce((sum, span) => sum + LEGEND_SWATCH_SPAN + span, 0); // 色見本(LEGEND_SWATCH_SPAN列)+ラベル(span列) の合計
  // 右詰めの開始列 — シート左端(1列目)より前にはみ出さないようクランプする。
  let col = Math.max(1, endCol - totalWidth + 1);
  return LEGEND_CATEGORIES.map(({ key, label }, i) => {
    const swatchCol = col;
    const labelColStart = swatchCol + LEGEND_SWATCH_SPAN;
    const labelColEnd = labelColStart + spans[i] - 1;
    col = labelColEnd + 1; // 次のエントリはすぐ隣(色見本の枠線で区切りが分かるため間隔は空けない)
    return { key, label, swatchCol, labelColStart, labelColEnd };
  });
}

interface MonthColumn {
  year: number;
  month: number;
  colStart: number; // 1日の絶対列番号
  days: number; // その月の実日数(色付け・ラベル用)
}

// 月ごとの列数(=見出しセルの幅)を固定して全ての月見出しを同じ幅に揃える
// — 実日数(28〜31)のまま可変にすると、日数が少ない月(2月・4月・6月・
// 9月・11月)の見出しだけ狭く見えて不揃いになるため。31より短い月は、
// その月の最終日より後ろの列を空欄のまま残す(データは書き込まない)。
const MONTH_SLOT_DAYS = 31;

/** 今日を中心に、画面のタイムラインと同じ月数(SCREEN_MONTHS_BEFORE〜AFTER)分の月を並べる。 */
function computeMonths(): MonthColumn[] {
  const now = new Date();
  const months: MonthColumn[] = [];
  let col = 3; // A/Bの次から
  for (let i = -SCREEN_MONTHS_BEFORE; i <= SCREEN_MONTHS_AFTER; i++) {
    const m = addMonths(now.getFullYear(), now.getMonth() + 1, i);
    const days = daysInMonth(m.year, m.month);
    months.push({ year: m.year, month: m.month, colStart: col, days });
    col += MONTH_SLOT_DAYS;
  }
  return months;
}

function buildHeader(
  ws: ExcelJS.Worksheet,
  months: MonthColumn[],
  colorByCategory: Map<ScheduleCategoryKey, string>,
  printLastCol: number,
  legendEntries: LegendEntry[],
) {
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, printLastCol);
  const titleCell = ws.getCell(TITLE_ROW, 1);
  titleCell.value = "納入工程";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(TITLE_ROW).height = HEADER_ROW_HEIGHT;

  // 凡例 — 色見本(1列)+ラベル(文字数に応じて複数列を結合)を、間隔を空けず
  // コンパクトにまとめて月グリッドの右端に寄せる(layoutLegend参照)。
  for (const { key, label, swatchCol, labelColStart, labelColEnd } of legendEntries) {
    ws.mergeCells(LEGEND_ROW, swatchCol, LEGEND_ROW, swatchCol + LEGEND_SWATCH_SPAN - 1);
    const swatch = ws.getCell(LEGEND_ROW, swatchCol);
    const color = colorByCategory.get(key);
    if (color) swatch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(color) } };
    swatch.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
    if (labelColEnd > labelColStart) ws.mergeCells(LEGEND_ROW, labelColStart, LEGEND_ROW, labelColEnd);
    const labelCell = ws.getCell(LEGEND_ROW, labelColStart);
    labelCell.value = label;
    labelCell.font = { size: 10 };
    labelCell.alignment = { horizontal: "left", vertical: "middle" };
  }
  ws.getRow(LEGEND_ROW).height = HEADER_ROW_HEIGHT;

  ws.mergeCells(MONTH_HEADER_ROW, 1, JUN_HEADER_ROW, 1);
  const colACaption = ws.getCell(MONTH_HEADER_ROW, 1);
  colACaption.value = "図面番号\n管理番号";
  ws.mergeCells(MONTH_HEADER_ROW, 2, JUN_HEADER_ROW, 2);
  const colBCaption = ws.getCell(MONTH_HEADER_ROW, 2);
  colBCaption.value = "件名／盤名称";
  for (const cell of [colACaption, colBCaption]) {
    cell.font = { size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
  }

  // 初(1〜10日)/中(11〜20日)/下(21日〜月末)の目安見出し — 実日単位の列は
  // 細すぎて月内のどのあたりか掴みにくいため、月見出しの下に付ける。
  const JUN_RANGES: { label: string; startDay: number; endDay: number }[] = [
    { label: "初", startDay: 1, endDay: 10 },
    { label: "中", startDay: 11, endDay: 20 },
    { label: "下", startDay: 21, endDay: MONTH_SLOT_DAYS },
  ];

  for (const m of months) {
    ws.mergeCells(MONTH_HEADER_ROW, m.colStart, MONTH_HEADER_ROW, m.colStart + MONTH_SLOT_DAYS - 1);
    const monthCell = ws.getCell(MONTH_HEADER_ROW, m.colStart);
    monthCell.value = `${m.year}/${String(m.month).padStart(2, "0")}`;
    monthCell.font = { size: 10, bold: true };
    monthCell.alignment = { horizontal: "center", vertical: "middle" };
    monthCell.border = { top: THIN, left: THICK, right: THIN, bottom: THIN };

    JUN_RANGES.forEach(({ label, startDay, endDay }, i) => {
      const colStart = m.colStart + startDay - 1;
      const colEnd = m.colStart + endDay - 1;
      ws.mergeCells(JUN_HEADER_ROW, colStart, JUN_HEADER_ROW, colEnd);
      const cell = ws.getCell(JUN_HEADER_ROW, colStart);
      cell.value = label;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: THIN, left: i === 0 ? THICK : THIN, right: THIN, bottom: THIN };
    });
  }
  ws.getRow(MONTH_HEADER_ROW).height = HEADER_ROW_HEIGHT;
  ws.getRow(JUN_HEADER_ROW).height = HEADER_ROW_HEIGHT;
}

function buildScheduleWorkbook(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
  colorConfigs: { category: ScheduleCategoryKey; color: string }[],
): ExcelJS.Worksheet {
  const months = computeMonths();
  const lastCol = 2 + months.length * MONTH_SLOT_DAYS; // データ(月/日)グリッドの最終列
  const legendEntries = layoutLegend(lastCol); // 月グリッドの右端に右詰め
  const legendLastCol = Math.max(...legendEntries.map((e) => e.labelColEnd));
  const printLastCol = Math.max(lastCol, legendLastCol); // 凡例がそれでもはみ出す場合はそちらに合わせる
  const colorByCategory = new Map(colorConfigs.map((c) => [c.category, c.color]));

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("納入工程", {
    pageSetup: {
      // exceljs's typed PaperSize enum omits A3 (OOXML code 8) even though the
      // file format itself supports it — cast past the incomplete enum.
      paperSize: 8 as ExcelJS.PaperSize, // A3
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3, header: 0, footer: 0 },
    },
    views: [{ state: "frozen", xSplit: 2, ySplit: JUN_HEADER_ROW }],
  });

  ws.columns = [
    { width: LABEL_COL_A_WIDTH },
    { width: LABEL_COL_B_WIDTH },
    ...Array.from({ length: printLastCol - 2 }, () => ({ width: DAY_COL_WIDTH })),
  ];

  buildHeader(ws, months, colorByCategory, printLastCol, legendEntries);

  cases.forEach(({ case: c, panels }, i) => {
    const blockStart = DATA_START_ROW + i * ROW_SPAN;
    const { projectName, panelNames } = buildProjectPanelLines(c, panels);
    const faceCount = panels[0]?.faceCount;

    ws.mergeCells(blockStart, 1, blockStart + ROW_SPAN - 1, 1);
    const colA = ws.getCell(blockStart, 1);
    colA.value = [c.drawingNumber, c.managementNumber, c.constructionNumber].filter(Boolean).join("\n");
    ws.mergeCells(blockStart, 2, blockStart + ROW_SPAN - 1, 2);
    const colB = ws.getCell(blockStart, 2);
    colB.value = [projectName, panelNames, faceCount != null ? `${faceCount}面` : ""].filter(Boolean).join("\n");
    for (const cell of [colA, colB]) {
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      cell.border = { top: THICK, left: THIN, right: THIN, bottom: THICK };
    }
    colA.note = buildCaseDisplayLabel(c, panels);

    const schedule = schedules[c.id];
    const lookup = schedule ? buildDayColorLookupByRow(computeColoredDays(schedule), colorConfigs) : new Map<string, string>();
    const labels = schedule ? buildMilestoneLabelsByRow(computeMilestones(schedule)) : new Map<string, string>();

    // 画面(ScheduleTimeline.tsx)と全く同じ考え方 — 月/旬の変わり目(1日・
    // 11日・21日)にだけ区切り線を検討し、直前の日と同じ色(=同じ期間が
    // 続いている)なら線を消す。それ以外の日の間には元々線を引かない
    // (画面もそう)。実日単位なので、同じ行・同じ日に2つの区分が重なる
    // ことは構造的に起こらない — 起きるのは「先勝ち」が必要な本当の重複
    // (例: 鈑金納入日とBOX納入日が同日)だけで、その場合も見た目は1色の
    // ままで正しい。
    for (let rowIndex = 0; rowIndex < ROW_SPAN; rowIndex++) {
      const row = ws.getRow(blockStart + rowIndex);
      row.height = ROW_HEIGHT;
      for (const monthEntry of months) {
        // その月の実日数を超えた分(MONTH_SLOT_DAYS参照)は実日付が無いので
        // 本来は空欄だが、月末の実日と翌月1日が同じ色(=同じ期間が続いた
        // まま月をまたぐ)場合はその色で埋めて、空欄列のせいで帯が途切れて
        // 見えないようにする(例: 立会が9/28〜10/3のように月をまたぐ場合)。
        const lastRealColor = lookup.get(dayCellKeyRow(monthEntry.year, monthEntry.month, monthEntry.days, rowIndex));
        const nextMonth = addMonths(monthEntry.year, monthEntry.month, 1);
        const nextFirstColor = lookup.get(dayCellKeyRow(nextMonth.year, nextMonth.month, 1, rowIndex));
        const paddingBridgeColor = lastRealColor && lastRealColor === nextFirstColor ? lastRealColor : undefined;

        for (let day = 1; day <= MONTH_SLOT_DAYS; day++) {
          const isRealDay = day <= monthEntry.days;
          const key = isRealDay ? dayCellKeyRow(monthEntry.year, monthEntry.month, day, rowIndex) : null;
          const hex = key ? lookup.get(key) : paddingBridgeColor;
          const isMonthStart = day === 1;
          const isJunStart = day === 11 || day === 21;
          const col = monthEntry.colStart + day - 1;
          let drawLeft: Partial<ExcelJS.Border> | undefined;
          if (isMonthStart || isJunStart) {
            const prevMonth = isMonthStart ? addMonths(monthEntry.year, monthEntry.month, -1) : monthEntry;
            const prevDay = isMonthStart ? daysInMonth(prevMonth.year, prevMonth.month) : day - 1;
            const prevColor = lookup.get(dayCellKeyRow(prevMonth.year, prevMonth.month, prevDay, rowIndex));
            if (!hex || hex !== prevColor) drawLeft = isMonthStart ? THICK : THIN;
          }
          const cell = row.getCell(col);
          cell.border = {
            top: rowIndex === 0 ? THICK : undefined,
            // 案件ブロック内の行(鈑金・BOX/アクセサリー/製作・検査/立会・出荷)
            // 同士の間には元々どんな線も引いていなかった — 色が途切れている
            // 所(空欄の行など)では色の境目だけでは行の変わり目が分かりに
            // くく、隣の行の帯とつながって/重なって見える原因になっていた。
            // 最終行だけ太い線(案件ブロックの下端)、それ以外は細い線で行を
            // 区切る。
            bottom: rowIndex === ROW_SPAN - 1 ? THICK : THIN,
            left: drawLeft,
            right: col === lastCol ? THIN : undefined,
          };
          if (hex) {
            // 空欄埋め(paddingBridgeColor)の場合は key が無い(実日付でない)
            // ため、ラベルは実日付のセルにしか付けない。
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } };
            const label = key ? labels.get(key) : undefined;
            if (label) {
              cell.value = label;
              cell.font = { size: 8, bold: true, color: { argb: "FFFFFFFF" } };
              cell.alignment = { horizontal: "right", vertical: "bottom" };
            }
          }
        }
      }
    }
  });

  const lastRow = DATA_START_ROW + cases.length * ROW_SPAN - 1;
  ws.pageSetup.printArea = `A1:${ws.getColumn(printLastCol).letter}${Math.max(lastRow, JUN_HEADER_ROW)}`;
  // 案件が1ページに収まらない数まで増えた場合、タイトル/凡例/月見出しを
  // 各ページの先頭に繰り返し、1案件分の4行ブロックがページの境目で分断
  // されないようにする(印刷ビュー側でthead/1グループ=1tbodyとして解釈
  // する — excelPrintView.tsのrenderWorksheetHtml参照)。
  ws.pageSetup.printTitlesRow = `${TITLE_ROW}:${JUN_HEADER_ROW}`;

  return ws;
}

export async function exportScheduleExcel(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<{ fileName: string }> {
  const colorConfigs = await scheduleColorService.list();
  const ws = buildScheduleWorkbook(cases, schedules, colorConfigs);
  const fileName = "納入工程.xlsx";
  await downloadWorkbook(ws.workbook, fileName);
  return { fileName };
}

// 実日単位の列は幅に余裕があり、そのままだと文字が小さめに収まってしまう
// ため、印刷時だけオートフィット後にさらに1.2倍拡大する(ダウンロードする
// .xlsx自体はそのまま — 実Excelで開いた時の見た目は変えない)。
const PRINT_EXTRA_SCALE = 1.2;

/** Prints 納入工程 in the exact layout the Excel download produces (same colored Gantt). */
export async function printSchedule(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<void> {
  const colorConfigs = await scheduleColorService.list();
  const ws = buildScheduleWorkbook(cases, schedules, colorConfigs);
  printWorksheet(ws, PRINT_EXTRA_SCALE);
}
