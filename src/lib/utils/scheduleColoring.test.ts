import { describe, expect, it } from "vitest";
import {
  buildJunColorLookup,
  buildJunColorLookupByRow,
  computeColoredSegments,
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
    inspectionStartDate: null,
    inspectionEndDate: null,
    witnessStartDate: null,
    witnessEndDate: null,
    shippingStartDate: null,
    shippingEndDate: null,
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
