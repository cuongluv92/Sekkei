import { describe, expect, it } from "vitest";
import {
  buildDayColorLookupByRow,
  buildJunColorLookup,
  buildJunColorLookupByRow,
  buildMilestoneLabelsByRow,
  computeColoredDays,
  computeColoredSegments,
  computeMilestones,
  dayCellKeyRow,
  daysInMonth,
  junCellKey,
  junCellKeyRow,
} from "./scheduleColoring";
import type { CaseSchedule, ScheduleColorConfig } from "@/lib/types/design";

function blankSchedule(caseId: string): CaseSchedule {
  return {
    caseId,
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
    deliveryDate: null,
    boxManufacturer: "",
    sheetMetalManufacturer: "",
  };
}

const COLORS: ScheduleColorConfig[] = [
  { category: "sheetMetal", color: "#111111" },
  { category: "box", color: "#222222" },
  { category: "accessory", color: "#333333" },
  { category: "production", color: "#444444" },
  { category: "inspection", color: "#555555" },
  { category: "witness", color: "#666666" },
  { category: "shipping", color: "#777777" },
];

describe("computeColoredSegments + buildJunColorLookup — end-to-end 工程表 coloring pipeline", () => {
  it("colors a 製作 date range spanning two 旬 buckets in the same month", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-08-03"; // 初 (day <=10 within 初1/初2)
    schedule.productionEndDate = "2026-08-12"; // 中 (中1)

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 8, "初"))).toBe("#444444");
    expect(lookup.get(junCellKey(2026, 8, "中"))).toBe("#444444");
    expect(lookup.get(junCellKey(2026, 8, "下"))).toBeUndefined();
  });

  it("colors a range spanning a month boundary", () => {
    const schedule = blankSchedule("c1");
    schedule.inspectionStartDate = "2026-08-28";
    schedule.inspectionEndDate = "2026-09-03";

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 8, "下"))).toBe("#555555");
    expect(lookup.get(junCellKey(2026, 9, "初"))).toBe("#555555");
  });

  it("falls back to the End Ref Date when the completion date is free text (e.g. \"9月下旬\")", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-09-01";
    schedule.productionEndDate = "9月下旬"; // 自由記入テキスト — isIsoDateがfalseになる
    schedule.productionEndRefDate = "2026-09-25"; // 色分け専用の実日付

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 9, "下"))).toBe("#444444");
  });

  it("without an End Ref Date, free-text completion falls back to a single-day range at the start date (pre-existing behavior, not extended by the free text)", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-09-01";
    schedule.productionEndDate = "9月下旬";

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 9, "初"))).toBe("#444444"); // start date only (day 1)
    expect(lookup.get(junCellKey(2026, 9, "下"))).toBeUndefined(); // never reaches 下旬 — the free text itself isn't interpreted
  });

  it("folds box onto sheetMetal's color (real template's combined legend swatch)", () => {
    const schedule = blankSchedule("c1");
    schedule.boxOrderDate = "2026-08-01";
    schedule.boxDeliveryDate = "2026-08-05";

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 8, "初"))).toBe("#111111"); // sheetMetal's color, not box's #222222
  });

  it("colors a single delivery date under the shipping category", () => {
    const schedule = blankSchedule("c1");
    schedule.deliveryDate = "2026-08-15";

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKey(2026, 8, "中"))).toBe("#777777");
  });

  it("produces no colors for a schedule with every date null", () => {
    const lookup = buildJunColorLookup(computeColoredSegments(blankSchedule("c1")), COLORS);
    expect(lookup.size).toBe(0);
  });

  it("produces no colors when the category has no configured color (工程色設定 not yet set)", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-08-03";
    schedule.productionEndDate = "2026-08-03";

    const lookup = buildJunColorLookup(computeColoredSegments(schedule), []);
    expect(lookup.size).toBe(0);
  });
});

describe("buildJunColorLookupByRow — 実テンプレートの4行ブロック分け (板金・BOX・部材/製作/検査/立会・出荷)", () => {
  it("鈑金・BOXは行0、製作は行1、検査は行2、立会は行3に分かれる", () => {
    const schedule = blankSchedule("c1");
    schedule.sheetMetalOrderDate = "2026-08-01";
    schedule.sheetMetalDeliveryDate = "2026-08-05";
    schedule.productionStartDate = "2026-08-06";
    schedule.productionEndDate = "2026-08-10";
    schedule.inspectionStartDate = "2026-08-11";
    schedule.inspectionEndDate = "2026-08-15";
    schedule.witnessStartDate = "2026-08-16";
    schedule.witnessEndDate = "2026-08-18";

    const lookup = buildJunColorLookupByRow(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKeyRow(2026, 8, "初", 0))).toBe("#111111");
    expect(lookup.get(junCellKeyRow(2026, 8, "初", 1))).toBe("#444444");
    expect(lookup.get(junCellKeyRow(2026, 8, "中", 2))).toBe("#555555");
    expect(lookup.get(junCellKeyRow(2026, 8, "中", 3))).toBe("#666666");
  });

  it("板金・BOX・部材が同じ旬に重なっても、行0で共存しどちらも消えない (先勝ちだが行自体は別カテゴリのために失われない)", () => {
    const schedule = blankSchedule("c1");
    schedule.sheetMetalOrderDate = "2026-08-01";
    schedule.sheetMetalDeliveryDate = "2026-08-05";
    schedule.boxOrderDate = "2026-08-01";
    schedule.boxDeliveryDate = "2026-08-05";
    schedule.accessoryOrderDate = "2026-08-01";
    schedule.accessoryDeliveryDate = "2026-08-05";
    schedule.productionStartDate = "2026-08-01";
    schedule.productionEndDate = "2026-08-05";

    const lookup = buildJunColorLookupByRow(computeColoredSegments(schedule), COLORS);
    // 板金・BOX・部材は同じ行0だが sheetMetal色に統一される (box は表示上sheetMetal色)
    expect(lookup.get(junCellKeyRow(2026, 8, "初", 0))).toBe("#111111");
    // 同じ旬でも製作は行1にあるので、行0の材料調達と共存して見える
    expect(lookup.get(junCellKeyRow(2026, 8, "初", 1))).toBe("#444444");
  });

  it("出荷完了と納品はどちらも行3 (立会・出荷) に入る", () => {
    const schedule = blankSchedule("c1");
    schedule.deliveryDate = "2026-08-25";

    const lookup = buildJunColorLookupByRow(computeColoredSegments(schedule), COLORS);
    expect(lookup.get(junCellKeyRow(2026, 8, "下", 3))).toBe("#777777");
  });

  it("設定色がなければ何も入らない", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-08-03";
    schedule.productionEndDate = "2026-08-03";

    const lookup = buildJunColorLookupByRow(computeColoredSegments(schedule), []);
    expect(lookup.size).toBe(0);
  });
});

describe("computeColoredDays + buildDayColorLookupByRow — 画面タイムライン用の実日単位カラー化 (旬の途中で色が切り替わっても正確な日で表現する)", () => {
  it("鈑金・BOX納入(行0)とアクセサリー納入(行1)は別行のため、同じ期間でも両方とも正確な日だけ色が付き重ならない", () => {
    const schedule = blankSchedule("c1");
    schedule.sheetMetalOrderDate = "2026-09-01";
    schedule.sheetMetalDeliveryDate = "2026-09-08";
    schedule.accessoryOrderDate = "2026-09-01";
    schedule.accessoryDeliveryDate = "2026-09-08"; // 鈑金と全く同じ期間でも行が違うので両方残る

    const lookup = buildDayColorLookupByRow(computeColoredDays(schedule), COLORS);
    expect(lookup.get(dayCellKeyRow(2026, 9, 5, 0))).toBe("#111111"); // sheetMetal, 行0
    expect(lookup.get(dayCellKeyRow(2026, 9, 5, 1))).toBe("#333333"); // accessory, 行1
    // 範囲外の日には何も入らない
    expect(lookup.get(dayCellKeyRow(2026, 9, 9, 0))).toBeUndefined();
  });

  it("製作と検査は同じ行(2)にまとめても、開始日が前工程の翌日にずれるため重ならず正確な日で色が切り替わる", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-09-01";
    schedule.productionEndDate = "2026-09-10";
    schedule.inspectionStartDate = "2026-09-11";
    schedule.inspectionEndDate = "2026-09-15";

    const lookup = buildDayColorLookupByRow(computeColoredDays(schedule), COLORS);
    expect(lookup.get(dayCellKeyRow(2026, 9, 10, 2))).toBe("#444444"); // production, 行2
    expect(lookup.get(dayCellKeyRow(2026, 9, 11, 2))).toBe("#555555"); // inspection, 行2 (同じ行だが正確な日で切り替わる)
    expect(lookup.get(dayCellKeyRow(2026, 9, 15, 2))).toBe("#555555");
  });

  it("完了日が自由記入テキストでも End Ref Date があれば実日まで正確に塗られる", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-09-01";
    schedule.productionEndDate = "9月下旬";
    schedule.productionEndRefDate = "2026-09-25";

    const lookup = buildDayColorLookupByRow(computeColoredDays(schedule), COLORS);
    expect(lookup.get(dayCellKeyRow(2026, 9, 25, 2))).toBe("#444444"); // production, 行2
    expect(lookup.get(dayCellKeyRow(2026, 9, 26, 2))).toBeUndefined();
  });

  it("設定色がなければ何も入らない", () => {
    const schedule = blankSchedule("c1");
    schedule.productionStartDate = "2026-08-03";
    schedule.productionEndDate = "2026-08-05";

    const lookup = buildDayColorLookupByRow(computeColoredDays(schedule), []);
    expect(lookup.size).toBe(0);
  });
});

describe("computeMilestones + buildMilestoneLabelsByRow — タイムラインの日付ラベル (納入日/完了日)", () => {
  it("鈑金納入日とBOX納入日が同じ日なら、行0のラベルは1つだけになる", () => {
    const schedule = blankSchedule("c1");
    schedule.sheetMetalDeliveryDate = "2026-09-10";
    schedule.boxDeliveryDate = "2026-09-10";

    const labels = buildMilestoneLabelsByRow(computeMilestones(schedule));
    expect(labels.get(dayCellKeyRow(2026, 9, 10, 0))).toBe("10");
    expect(labels.size).toBe(1);
  });

  it("アクセサリー納入日(行1)は日だけの文字列になる", () => {
    const schedule = blankSchedule("c1");
    schedule.accessoryDeliveryDate = "2026-08-28";

    const labels = buildMilestoneLabelsByRow(computeMilestones(schedule));
    expect(labels.get(dayCellKeyRow(2026, 8, 28, 1))).toBe("28");
  });

  it("製作完了日と検査完了日は同じ行(2)でも別の日なので両方ラベルが付く", () => {
    const schedule = blankSchedule("c1");
    schedule.productionEndDate = "2026-09-10";
    schedule.inspectionEndDate = "2026-09-15";

    const labels = buildMilestoneLabelsByRow(computeMilestones(schedule));
    expect(labels.get(dayCellKeyRow(2026, 9, 10, 2))).toBe("10");
    expect(labels.get(dayCellKeyRow(2026, 9, 15, 2))).toBe("15");
  });

  it("完了日が自由記入テキストでも End Ref Date があればそちらの日でラベルが付く", () => {
    const schedule = blankSchedule("c1");
    schedule.witnessEndDate = "10月上旬";
    schedule.witnessEndRefDate = "2026-10-05";

    const labels = buildMilestoneLabelsByRow(computeMilestones(schedule));
    expect(labels.get(dayCellKeyRow(2026, 10, 5, 3))).toBe("5");
  });

  it("日付が何もなければ空になる", () => {
    const labels = buildMilestoneLabelsByRow(computeMilestones(blankSchedule("c1")));
    expect(labels.size).toBe(0);
  });
});

describe("daysInMonth", () => {
  it("31日の月・30日の月・うるう年でない2月・うるう年の2月をそれぞれ正しく返す", () => {
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});
