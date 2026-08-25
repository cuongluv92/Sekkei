import { describe, expect, it } from "vitest";
import { applyCascade, applyCreationDefaults, junDateRange } from "./schedule";
import type { CaseSchedule } from "@/lib/types/design";

function emptySchedule(): CaseSchedule {
  return {
    caseId: "case-1",
    sheetMetalOrderDate: null,
    sheetMetalDeliveryDate: null,
    sheetMetalManufacturer: "",
    boxOrderDate: null,
    boxDeliveryDate: null,
    boxManufacturer: "",
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
  };
}

describe("applyCascade", () => {
  it("鈑金納入日 → 製作開始日が空欄なら自動で埋める", () => {
    const s = { ...emptySchedule(), sheetMetalDeliveryDate: "2026-09-10" };
    const result = applyCascade(s, "sheetMetalDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-10");
  });

  it("鈑金・BOX・部材の3納期がすべて埋まっている場合は最も遅い日付を採用する", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-09-10",
      boxDeliveryDate: "2026-09-15",
      accessoryDeliveryDate: "2026-09-05",
    };
    const result = applyCascade(s, "boxDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-15");
  });

  it("既に手入力済みの次工程開始日は絶対に上書きしない", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-09-10",
      productionStartDate: "2026-09-01",
    };
    const result = applyCascade(s, "sheetMetalDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-01");
  });

  it("製作完了日 → 検査開始日のカスケードが連鎖する", () => {
    const s = { ...emptySchedule(), productionEndDate: "2026-09-25" };
    const result = applyCascade(s, "productionEndDate");
    expect(result.inspectionStartDate).toBe("2026-09-25");
  });

  it("出荷完了日 → 納入日まで連鎖する", () => {
    const s = { ...emptySchedule(), shippingEndDate: "2026-10-05" };
    const result = applyCascade(s, "shippingEndDate");
    expect(result.deliveryDate).toBe("2026-10-05");
  });

  it("起点ではないキーの変更は何も埋めない", () => {
    const s = { ...emptySchedule(), sheetMetalManufacturer: "A社" };
    const result = applyCascade(s, "sheetMetalManufacturer" as keyof CaseSchedule);
    expect(result).toEqual(s);
  });
});

describe("applyCreationDefaults", () => {
  it("発注日が全て空欄なら案件の作成日をデフォルト値として埋める", () => {
    const result = applyCreationDefaults(emptySchedule(), "2026-08-20T03:00:00.000Z");
    expect(result.sheetMetalOrderDate).toBe("2026-08-20");
    expect(result.boxOrderDate).toBe("2026-08-20");
    expect(result.accessoryOrderDate).toBe("2026-08-20");
  });

  it("既に値がある発注日は上書きしない", () => {
    const s = { ...emptySchedule(), boxOrderDate: "2026-08-01" };
    const result = applyCreationDefaults(s, "2026-08-20T00:00:00.000Z");
    expect(result.boxOrderDate).toBe("2026-08-01");
    expect(result.sheetMetalOrderDate).toBe("2026-08-20");
  });

  it("createdAtが無ければ何もしない", () => {
    const s = emptySchedule();
    expect(applyCreationDefaults(s, undefined)).toEqual(s);
    expect(applyCreationDefaults(s, null)).toEqual(s);
  });
});

describe("junDateRange", () => {
  it("初 = 1〜10日", () => {
    expect(junDateRange(2026, 9, "初")).toEqual({ start: "2026-09-01", end: "2026-09-10" });
  });

  it("中 = 11〜20日", () => {
    expect(junDateRange(2026, 9, "中")).toEqual({ start: "2026-09-11", end: "2026-09-20" });
  });

  it("下 = 21日〜月末 (30日の月)", () => {
    expect(junDateRange(2026, 9, "下")).toEqual({ start: "2026-09-21", end: "2026-09-30" });
  });

  it("下 = 21日〜月末 (31日の月)", () => {
    expect(junDateRange(2026, 8, "下")).toEqual({ start: "2026-08-21", end: "2026-08-31" });
  });

  it("下 = 21日〜月末 (うるう年でない2月)", () => {
    expect(junDateRange(2026, 2, "下")).toEqual({ start: "2026-02-21", end: "2026-02-28" });
  });

  it("下 = 21日〜月末 (うるう年の2月)", () => {
    expect(junDateRange(2028, 2, "下")).toEqual({ start: "2028-02-21", end: "2028-02-29" });
  });
});
