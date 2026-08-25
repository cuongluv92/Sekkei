import { describe, expect, it } from "vitest";
import { buildJunColorLookup, computeColoredSegments, junCellKey } from "./scheduleColoring";
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
