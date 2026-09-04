/**
 * JSIA 210:2020 表B.2「銅帯の許容電流」の国内公式公開値。
 * 選定画面の「基準・参考選定」だけで使う。
 *
 * ここでは表B.2のうち単一銅帯、周囲温度40℃、温度上昇30℃、
 * 裸・開放条件の値だけを扱う。JSIA 210は「開放形高圧受電設備」の規格なので、
 * 低圧盤へ一般化したJIS値として表示してはならない。
 */
export const JSIA_210_BUS_BAR_URL =
  "https://www.jsia.or.jp/wp-content/uploads/jsia_admin/media/2023/02/JSIA-210-2020.03-%E9%96%8B%E6%94%BE%E5%BD%A2%E9%AB%98%E5%9C%A7%E5%8F%97%E9%9B%BB%E8%A8%AD%E5%82%99Rev1.pdf";

export const JSIA_210_BUS_BAR_SOURCE = {
  standard: "JSIA 210:2020",
  reference: "表B.2 銅帯の許容電流",
  condition: "裸・開放、周囲温度40℃、温度上昇30℃、単一銅帯",
  scope: "開放形高圧受電設備。低圧盤のJIS値としての一般化は禁止。",
} as const;

export interface Jsia210SingleBusbarRow {
  thicknessMm: number;
  widthMm: number;
  allowableCurrentA: number;
}

export const JSIA_210_SINGLE_BUS_BAR_ROWS: readonly Jsia210SingleBusbarRow[] = [
  { thicknessMm: 3, widthMm: 25, allowableCurrentA: 230 },
  { thicknessMm: 4, widthMm: 25, allowableCurrentA: 290 },
  { thicknessMm: 4, widthMm: 50, allowableCurrentA: 510 },
  { thicknessMm: 5, widthMm: 25, allowableCurrentA: 340 },
  { thicknessMm: 5, widthMm: 50, allowableCurrentA: 610 },
  { thicknessMm: 6, widthMm: 25, allowableCurrentA: 380 },
  { thicknessMm: 6, widthMm: 30, allowableCurrentA: 430 },
  { thicknessMm: 6, widthMm: 40, allowableCurrentA: 550 },
  { thicknessMm: 6, widthMm: 50, allowableCurrentA: 680 },
  { thicknessMm: 6, widthMm: 75, allowableCurrentA: 940 },
  { thicknessMm: 6, widthMm: 100, allowableCurrentA: 1200 },
  { thicknessMm: 6, widthMm: 125, allowableCurrentA: 1440 },
  { thicknessMm: 6, widthMm: 150, allowableCurrentA: 1680 },
  { thicknessMm: 8, widthMm: 50, allowableCurrentA: 800 },
  { thicknessMm: 8, widthMm: 75, allowableCurrentA: 1100 },
  { thicknessMm: 8, widthMm: 100, allowableCurrentA: 1400 },
  { thicknessMm: 8, widthMm: 125, allowableCurrentA: 1650 },
  { thicknessMm: 8, widthMm: 150, allowableCurrentA: 1930 },
  { thicknessMm: 10, widthMm: 50, allowableCurrentA: 880 },
  { thicknessMm: 10, widthMm: 75, allowableCurrentA: 1220 },
  { thicknessMm: 10, widthMm: 100, allowableCurrentA: 1540 },
  { thicknessMm: 10, widthMm: 125, allowableCurrentA: 1820 },
  { thicknessMm: 10, widthMm: 150, allowableCurrentA: 2120 },
  { thicknessMm: 12, widthMm: 75, allowableCurrentA: 1320 },
  { thicknessMm: 12, widthMm: 100, allowableCurrentA: 1660 },
  { thicknessMm: 12, widthMm: 125, allowableCurrentA: 1950 },
  { thicknessMm: 12, widthMm: 150, allowableCurrentA: 2280 },
];

/** 入力電流以上の許容電流を持つものから、断面積最小→許容電流最小の順で選ぶ。 */
export function pickJsia210SingleBusbar(currentA: number): Jsia210SingleBusbarRow | null {
  if (!Number.isFinite(currentA) || currentA <= 0) return null;
  return (
    JSIA_210_SINGLE_BUS_BAR_ROWS
      .filter((row) => row.allowableCurrentA >= currentA)
      .sort((a, b) => {
        const areaA = a.thicknessMm * a.widthMm;
        const areaB = b.thicknessMm * b.widthMm;
        if (areaA !== areaB) return areaA - areaB;
        return a.allowableCurrentA - b.allowableCurrentA;
      })[0] ?? null
  );
}
