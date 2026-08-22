import { describe, expect, it } from "vitest";
import {
  buildProjectOptionLabel,
  buildProjectOptions,
  matchesProjectOptionQuery,
} from "./projectSearch";
import type { CasePanel, DesignCase, DesignCaseWithPanels, Project } from "@/lib/types/design";

function makeProject(id: string, name: string): Project {
  return { id, name, createdAt: "2026-01-01" };
}

function makeCase(overrides: Partial<DesignCase> & { id: string; projectId: string }): DesignCase {
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
    ...overrides,
  };
}

function makePanel(overrides: Partial<CasePanel> & { id: string; caseId: string }): CasePanel {
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

// 26-001/26-002/26-003 all filed under ONE Project ("サンプルプロジェクト") — the
// exact real-world shape that caused "only the newest 案件 shows up" before,
// since the old code collapsed every 案件 under a Project into one row.
const project = makeProject("proj-1", "サンプルプロジェクト");
const case1 = makeCase({
  id: "case-1",
  projectId: "proj-1",
  drawingNumber: "26-001",
  managementNumber: "A260101",
  constructionNumber: "",
  projectName: "本社ビル電気設備",
});
const case2 = makeCase({
  id: "case-2",
  projectId: "proj-1",
  drawingNumber: "26-002",
  managementNumber: "A260102",
  constructionNumber: "R223301",
  projectName: "工場増設",
});
const case3 = makeCase({
  id: "case-3",
  projectId: "proj-1",
  drawingNumber: "26-003",
  managementNumber: "A260103",
  constructionNumber: "R223344",
  projectName: "倉庫照明更新",
});
const panel3 = makePanel({ id: "panel-3", caseId: "case-3", panelName: "照明盤" });

const allCases: DesignCaseWithPanels[] = [
  { case: case1, panels: [] },
  { case: case2, panels: [] },
  { case: case3, panels: [panel3] },
];

describe("buildProjectOptions — every 案件 under a Project is its own row (spec #1-#4)", () => {
  it("produces one option per 案件, not one collapsed row per Project", () => {
    const options = buildProjectOptions([project], allCases);
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.case?.drawingNumber).sort()).toEqual(["26-001", "26-002", "26-003"]);
  });

  it("sorts ascending by 図面番号 so 26-001 comes before 26-002 before 26-003", () => {
    const options = buildProjectOptions([project], allCases);
    expect(options.map((o) => o.case?.drawingNumber)).toEqual(["26-001", "26-002", "26-003"]);
  });

  it("still resolves every 案件 to the same underlying projectId", () => {
    const options = buildProjectOptions([project], allCases);
    expect(options.every((o) => o.projectId === "proj-1")).toBe(true);
  });

  it("gives a Project with no 案件 yet exactly one fallback option", () => {
    const emptyProject = makeProject("proj-2", "新規案件なしProject");
    const options = buildProjectOptions([project, emptyProject], allCases);
    const fallback = options.find((o) => o.projectId === "proj-2");
    expect(fallback).toBeDefined();
    expect(fallback?.case).toBeNull();
  });
});

describe("buildProjectOptionLabel — 図面番号〇管理番号（工事番号）　件名／盤名称 (spec #9-#10)", () => {
  it("matches the exact example format when every field is present", () => {
    const options = buildProjectOptions([project], allCases);
    const opt3 = options.find((o) => o.case?.drawingNumber === "26-003")!;
    expect(buildProjectOptionLabel(opt3)).toBe("26-003〇A260103（R223344）　倉庫照明更新／照明盤");
  });

  it("omits （工事番号） entirely when 工事番号 is blank, never leaving empty parens", () => {
    const options = buildProjectOptions([project], allCases);
    const opt1 = options.find((o) => o.case?.drawingNumber === "26-001")!;
    const label = buildProjectOptionLabel(opt1);
    expect(label).toBe("26-001〇A260101　本社ビル電気設備");
    expect(label).not.toContain("（）");
  });

  it("omits ／ entirely when 盤名称 is blank, never leaving a trailing ／", () => {
    const options = buildProjectOptions([project], allCases);
    const opt2 = options.find((o) => o.case?.drawingNumber === "26-002")!;
    const label = buildProjectOptionLabel(opt2);
    expect(label).toBe("26-002〇A260102（R223301）　工場増設");
    expect(label.endsWith("／")).toBe(false);
  });

  it("never uses the old | separator", () => {
    const options = buildProjectOptions([project], allCases);
    for (const option of options) {
      expect(buildProjectOptionLabel(option)).not.toContain("|");
      expect(buildProjectOptionLabel(option)).not.toContain("｜");
    }
  });

  it("falls back to the bare Project name for a Project with no 案件", () => {
    const emptyProject = makeProject("proj-2", "空のProject");
    const options = buildProjectOptions([emptyProject], []);
    expect(buildProjectOptionLabel(options[0])).toBe("空のProject");
  });
});

describe("matchesProjectOptionQuery — 26-001/26-002/26-003 must each be independently findable (spec #3-#5)", () => {
  const options = buildProjectOptions([project], allCases);

  it("finds 26-001 by its own 図面番号 without matching 26-002/26-003", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "26-001"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-001"]);
  });

  it("finds 26-002 by its own 図面番号", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "26-002"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-002"]);
  });

  it("finds 26-003 by its own 図面番号", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "26-003"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-003"]);
  });

  it("finds a case by 管理番号", () => {
    expect(options.some((o) => matchesProjectOptionQuery(o, "A260102"))).toBe(true);
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "A260102"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-002"]);
  });

  it("finds a case by 工事番号", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "R223344"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-003"]);
  });

  it("finds a case by 件名", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "倉庫照明更新"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-003"]);
  });

  it("finds a case by 盤名称", () => {
    const hits = options.filter((o) => matchesProjectOptionQuery(o, "照明盤"));
    expect(hits.map((o) => o.case?.drawingNumber)).toEqual(["26-003"]);
  });

  it("a blank query matches every option", () => {
    expect(options.every((o) => matchesProjectOptionQuery(o, ""))).toBe(true);
  });
});
