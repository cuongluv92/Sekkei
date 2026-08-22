import { describe, expect, it } from "vitest";
import {
  buildCaseOptionLabel,
  buildCaseOptions,
  matchesCaseOptionQuery,
} from "./caseSearch";
import type {
  CasePanel,
  DesignCase,
  DesignCaseWithPanels,
} from "@/lib/types/design";

function makeCase(overrides: Partial<DesignCase> & { id: string }): DesignCase {
  return {
    year: 2026,
    sequenceNo: 1,
    drawingNumber: "",
    requestType: "",
    managementNumber: "",
    constructionNumber: "",
    orderer: "",
    customerContact: "",
    projectName: "",
    specs: {},
    designRemarks: "",
    indexCategory: "other",
    assignee: "",
    caseStatus: "",
    manufacturingComplete: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    deletedAt: null,
    ...overrides,
  };
}

function makePanel(
  overrides: Partial<CasePanel> & { id: string; caseId: string },
): CasePanel {
  return {
    panelNo: 1,
    panelName: "",
    panelStructure: "",
    faceCount: null,
    designDueDate: null,
    designEstimatedHours: null,
    designActualHours: null,
    productionEstimatedHours: null,
    productionActualHours: null,
    electricalMethod: "",
    ratedVoltage: "",
    ratedCurrent: "",
    ratedBreakingCapacity: "",
    frequency: "",
    controlVoltage: "",
    protectionRating: "",
    ...overrides,
  };
}

// 26-0001/26-0002/26-0003 are three independent 案件 — no Project grouping
// above them to accidentally collapse them into one option (spec #1-#5).
const case1 = makeCase({
  id: "case-1",
  drawingNumber: "26-0001",
  managementNumber: "A260101",
  projectName: "本社ビル電気設備",
});
const case2 = makeCase({
  id: "case-2",
  drawingNumber: "26-0002",
  managementNumber: "A260102",
  constructionNumber: "R223301",
  projectName: "工場増設",
});
const case3 = makeCase({
  id: "case-3",
  drawingNumber: "26-0003",
  managementNumber: "A260103",
  constructionNumber: "R223344",
  projectName: "倉庫照明更新",
});
const panel3 = makePanel({
  id: "panel-3",
  caseId: "case-3",
  panelName: "照明盤",
});

const allCases: DesignCaseWithPanels[] = [
  { case: case1, panels: [] },
  { case: case2, panels: [] },
  { case: case3, panels: [panel3] },
];

describe("buildCaseOptions — every 案件 is its own row (spec #1, #5, #18)", () => {
  it("produces one option per 案件", () => {
    const options = buildCaseOptions(allCases);
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.case.drawingNumber).sort()).toEqual([
      "26-0001",
      "26-0002",
      "26-0003",
    ]);
  });

  it("sorts ascending by 図面番号 so 26-0001 comes before 26-0002 before 26-0003", () => {
    const options = buildCaseOptions(allCases);
    expect(options.map((o) => o.case.drawingNumber)).toEqual([
      "26-0001",
      "26-0002",
      "26-0003",
    ]);
  });

  it("resolves each option to its own distinct caseId", () => {
    const options = buildCaseOptions(allCases);
    expect(new Set(options.map((o) => o.caseId)).size).toBe(3);
  });
});

describe("buildCaseOptionLabel — 図面番号〇管理番号（工事番号）　件名／盤名称 (spec #4)", () => {
  it("matches the exact example format when every field is present", () => {
    const options = buildCaseOptions(allCases);
    const opt3 = options.find((o) => o.case.drawingNumber === "26-0003")!;
    expect(buildCaseOptionLabel(opt3)).toBe(
      "26-0003〇A260103（R223344）　倉庫照明更新／照明盤",
    );
  });

  it("omits （工事番号） entirely when 工事番号 is blank, never leaving empty parens", () => {
    const options = buildCaseOptions(allCases);
    const opt1 = options.find((o) => o.case.drawingNumber === "26-0001")!;
    const label = buildCaseOptionLabel(opt1);
    expect(label).toBe("26-0001〇A260101　本社ビル電気設備");
    expect(label).not.toContain("（）");
  });

  it("omits ／ entirely when 盤名称 is blank, never leaving a trailing ／", () => {
    const options = buildCaseOptions(allCases);
    const opt2 = options.find((o) => o.case.drawingNumber === "26-0002")!;
    const label = buildCaseOptionLabel(opt2);
    expect(label).toBe("26-0002〇A260102（R223301）　工場増設");
    expect(label.endsWith("／")).toBe(false);
  });

  it("never uses the old | separator", () => {
    const options = buildCaseOptions(allCases);
    for (const option of options) {
      expect(buildCaseOptionLabel(option)).not.toContain("|");
      expect(buildCaseOptionLabel(option)).not.toContain("｜");
    }
  });
});

describe("matchesCaseOptionQuery — 26-0001/26-0002/26-0003 must each be independently findable (spec #5, #18)", () => {
  const options = buildCaseOptions(allCases);

  it("finds 26-0001 by its own 図面番号 without matching 26-0002/26-0003", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "26-0001"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0001"]);
  });

  it("finds 26-0002 by its own 図面番号", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "26-0002"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0002"]);
  });

  it("finds 26-0003 by its own 図面番号", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "26-0003"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0003"]);
  });

  it("finds a case by 管理番号", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "A260102"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0002"]);
  });

  it("finds a case by 工事番号", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "R223344"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0003"]);
  });

  it("finds a case by 件名", () => {
    const hits = options.filter((o) =>
      matchesCaseOptionQuery(o, "倉庫照明更新"),
    );
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0003"]);
  });

  it("finds a case by 盤名称", () => {
    const hits = options.filter((o) => matchesCaseOptionQuery(o, "照明盤"));
    expect(hits.map((o) => o.case.drawingNumber)).toEqual(["26-0003"]);
  });

  it("a blank query matches every option", () => {
    expect(options.every((o) => matchesCaseOptionQuery(o, ""))).toBe(true);
  });
});
