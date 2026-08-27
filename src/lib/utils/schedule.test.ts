import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAllCascades, applyCascade, applyTodayDefaults, junDateRange } from "./schedule";
import type { CaseSchedule } from "@/lib/types/design";

function emptySchedule(): CaseSchedule {
  return {
    caseId: "case-1",
    sheetMetalOrderDate: null,
    sheetMetalDeliveryDate: null,
    sheetMetalDeliveryDone: false,
    sheetMetalManufacturer: "",
    boxOrderDate: null,
    boxDeliveryDate: null,
    boxDeliveryDone: false,
    boxManufacturer: "",
    accessoryOrderDate: null,
    accessoryDeliveryDate: null,
    accessoryDeliveryDone: false,
    productionStartDate: null,
    productionEndDate: null,
    productionEndRefDate: null,
    productionEndDone: false,
    inspectionStartDate: null,
    inspectionEndDate: null,
    inspectionEndRefDate: null,
    inspectionEndDone: false,
    witnessStartDate: null,
    witnessEndDate: null,
    witnessEndRefDate: null,
    witnessEndDone: false,
    shippingStartDate: null,
    shippingEndDate: null,
    shippingEndRefDate: null,
    shippingEndDone: false,
    deliveryDate: null,
    deliveryDone: false,
  };
}

describe("applyCascade", () => {
  it("鈑金納入日 → 製作開始日は翌日にずれる", () => {
    const s = { ...emptySchedule(), sheetMetalDeliveryDate: "2026-09-10" };
    const result = applyCascade(s, "sheetMetalDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-11");
  });

  it("鈑金・BOXの納期がどちらも埋まっている場合は遅い方の日付+1を採用する", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-09-10",
      boxDeliveryDate: "2026-09-15",
    };
    const result = applyCascade(s, "boxDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-16");
  });

  it("アクセサリー納入日は製作開始日のカスケードに影響しない", () => {
    const s = {
      ...emptySchedule(),
      accessoryDeliveryDate: "2026-09-20",
    };
    const result = applyCascade(s, "accessoryDeliveryDate");
    expect(result.productionStartDate).toBeNull();
  });

  it("既に値が入っていても、前工程の日付が変わったら常に最新の値で再計算する (過去の古い自動計算値が残り続けるのを防ぐ)", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-09-10",
      productionStartDate: "2026-08-01", // 古い(ずれた)値が既に入っている想定
    };
    const result = applyCascade(s, "sheetMetalDeliveryDate");
    expect(result.productionStartDate).toBe("2026-09-11");
  });

  it("lockedKeys に含まれる開始日欄は、ユーザーが手動編集欄を開いている印なので上書きしない", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-09-10",
      productionStartDate: "2026-09-01",
    };
    const result = applyCascade(s, "sheetMetalDeliveryDate", new Set(["productionStartDate"]));
    expect(result.productionStartDate).toBe("2026-09-01");
  });

  it("完了日が自由記入テキストでも、参考日欄(EndRefDate)を編集すればカスケードが発火する", () => {
    const s = {
      ...emptySchedule(),
      productionEndDate: "9月下旬",
      productionEndRefDate: "2026-09-25",
    };
    const result = applyCascade(s, "productionEndRefDate");
    expect(result.inspectionStartDate).toBe("2026-09-26");
  });

  it("製作完了日 → 検査開始日は翌日にずれる", () => {
    const s = { ...emptySchedule(), productionEndDate: "2026-09-25" };
    const result = applyCascade(s, "productionEndDate");
    expect(result.inspectionStartDate).toBe("2026-09-26");
  });

  it("立会完了日が入力済みなら、検査完了日 → 立会開始日は翌日にずれる", () => {
    const s = { ...emptySchedule(), inspectionEndDate: "2026-09-30", witnessEndDate: "2026-10-10" };
    const result = applyCascade(s, "inspectionEndDate");
    expect(result.witnessStartDate).toBe("2026-10-01");
  });

  it("立会完了日が空欄なら、検査完了日が変わっても立会開始日は自動で埋めない (立会は実施されないことも多いため)", () => {
    const s = { ...emptySchedule(), inspectionEndDate: "2026-09-30" };
    const result = applyCascade(s, "inspectionEndDate");
    expect(result.witnessStartDate).toBeNull();
  });

  it("立会完了日を入力すると、既に埋まっている検査完了日から立会開始日が発火する", () => {
    const s = { ...emptySchedule(), inspectionEndDate: "2026-09-30", witnessEndDate: "2026-10-10" };
    const result = applyCascade(s, "witnessEndDate");
    expect(result.witnessStartDate).toBe("2026-10-01");
  });

  it("一度自動計算された立会開始日も、立会完了日を消すとクリアされる (ロックされていない限り)", () => {
    const s = {
      ...emptySchedule(),
      inspectionEndDate: "2026-09-30",
      witnessEndDate: "",
      witnessStartDate: "2026-10-01", // 過去に自動計算された値
    };
    const result = applyCascade(s, "witnessEndDate");
    expect(result.witnessStartDate).toBeNull();
  });

  it("立会完了日 → 出荷開始日は翌日にずれる", () => {
    const s = { ...emptySchedule(), witnessEndDate: "2026-10-05" };
    const result = applyCascade(s, "witnessEndDate");
    expect(result.shippingStartDate).toBe("2026-10-06");
  });

  it("立会が実施されない場合、出荷開始日は検査完了日+1にフォールバックする", () => {
    const s = { ...emptySchedule(), inspectionEndDate: "2026-09-30" };
    const result = applyCascade(s, "inspectionEndDate");
    expect(result.shippingStartDate).toBe("2026-10-01");
  });

  it("出荷完了日 → 納入日まで連鎖する (オフセットなし)", () => {
    const s = { ...emptySchedule(), shippingEndDate: "2026-10-05" };
    const result = applyCascade(s, "shippingEndDate");
    expect(result.deliveryDate).toBe("2026-10-05");
  });

  it("自由記入テキスト (旬指定) は日付として扱わずカスケードしない", () => {
    const s = { ...emptySchedule(), sheetMetalDeliveryDate: "9月中旬" };
    const result = applyCascade(s, "sheetMetalDeliveryDate");
    expect(result.productionStartDate).toBeNull();
  });

  it("起点ではないキーの変更は何も埋めない", () => {
    const s = { ...emptySchedule(), sheetMetalManufacturer: "A社" };
    const result = applyCascade(s, "sheetMetalManufacturer" as keyof CaseSchedule);
    expect(result).toEqual(s);
  });
});

describe("applyAllCascades", () => {
  it("DBから読み込んだ直後など、個々の変更イベントを経ていなくても全リンクを一括で再計算する", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-08-28",
      boxDeliveryDate: "2026-09-03",
      inspectionEndDate: "2026-09-30",
    };
    const result = applyAllCascades(s);
    expect(result.productionStartDate).toBe("2026-09-04"); // 遅い方(boxDeliveryDate)+1
    expect(result.shippingStartDate).toBe("2026-10-01"); // 検査完了日+1 (立会なし)
  });

  it("lockedKeys で指定した欄は一括再計算でも上書きしない", () => {
    const s = {
      ...emptySchedule(),
      sheetMetalDeliveryDate: "2026-08-28",
      productionStartDate: "2026-09-01", // 手動で編集中の値
    };
    const result = applyAllCascades(s, new Set(["productionStartDate"]));
    expect(result.productionStartDate).toBe("2026-09-01");
  });
});

describe("applyTodayDefaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("発注日が全て空欄なら今日の日付をデフォルト値として埋める", () => {
    const result = applyTodayDefaults(emptySchedule());
    expect(result.sheetMetalOrderDate).toBe("2026-08-26");
    expect(result.boxOrderDate).toBe("2026-08-26");
    expect(result.accessoryOrderDate).toBe("2026-08-26");
  });

  it("既に値がある発注日は上書きしない", () => {
    const s = { ...emptySchedule(), boxOrderDate: "2026-08-01" };
    const result = applyTodayDefaults(s);
    expect(result.boxOrderDate).toBe("2026-08-01");
    expect(result.sheetMetalOrderDate).toBe("2026-08-26");
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
