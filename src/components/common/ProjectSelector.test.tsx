import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ProjectSelector } from "./ProjectSelector";
import type { CasePanel, DesignCase, DesignCaseWithPanels, Project } from "@/lib/types/design";

const project: Project = { id: "proj-1", name: "サンプルプロジェクト", createdAt: "2026-01-01" };

function makeCase(overrides: Partial<DesignCase> & { id: string }): DesignCase {
  return {
    projectId: "proj-1",
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

const case1 = makeCase({
  id: "case-1",
  drawingNumber: "26-001",
  managementNumber: "A260101",
  projectName: "本社ビル電気設備",
});
const case2 = makeCase({
  id: "case-2",
  drawingNumber: "26-002",
  managementNumber: "A260102",
  constructionNumber: "R223301",
  projectName: "工場増設",
});
const panel3: CasePanel = {
  id: "panel-3",
  caseId: "case-3",
  panelNo: 1,
  panelName: "照明盤",
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
};
const case3 = makeCase({
  id: "case-3",
  drawingNumber: "26-003",
  managementNumber: "A260103",
  constructionNumber: "R223344",
  projectName: "倉庫照明更新",
});

const allCases: DesignCaseWithPanels[] = [
  { case: case1, panels: [] },
  { case: case2, panels: [] },
  { case: case3, panels: [panel3] },
];

vi.mock("@/lib/services/design", () => ({
  projectService: {
    list: vi.fn(async () => [project]),
    create: vi.fn(),
    getById: vi.fn(),
  },
  designCaseService: {
    listAll: vi.fn(async () => allCases),
  },
}));

// Testing Library's default text normalizer collapses all Unicode
// whitespace (including the label's full-width "　" separator) down to a
// plain space before comparing — so matching against the literal label
// string with its real "　" character never succeeds. Match by regex
// instead, treating any whitespace run as equivalent.
function labelMatcher(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s\u3000]+/g, "\\s+");
  return new RegExp(`^${escaped}$`);
}

function Harness() {
  const [projectId, setProjectId] = useState("");
  return (
    <LanguageProvider>
      <ProjectSelector projectId={projectId} onProjectChange={setProjectId} />
    </LanguageProvider>
  );
}

describe("ProjectSelector — 26-001/26-002/26-003 under one Project (bug report repro)", () => {
  it("finds, selects, and displays 26-001 in the new 〇（）／ format — distinct from 26-002/26-003", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-001");

    const row = await screen.findByText(labelMatcher("26-001〇A260101　本社ビル電気設備"));
    // 26-002/26-003 must NOT be in the filtered results.
    expect(screen.queryByText(/26-002/)).toBeNull();
    expect(screen.queryByText(/26-003/)).toBeNull();

    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText(labelMatcher("26-001〇A260101　本社ビル電気設備"))).toBeInTheDocument();
    });
  });

  it("finds and selects 26-002 with its 工事番号 shown, format has no | separator", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-002");

    const row = await screen.findByText(labelMatcher("26-002〇A260102（R223301）　工場増設"));
    expect(row.textContent).not.toContain("|");
    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText(labelMatcher("26-002〇A260102（R223301）　工場増設"))).toBeInTheDocument();
    });
  });

  it("finds 26-003 by its 盤名称 (照明盤) and selects it with the full format including panel name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "照明盤");

    const row = await screen.findByText(labelMatcher("26-003〇A260103（R223344）　倉庫照明更新／照明盤"));
    await user.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(labelMatcher("26-003〇A260103（R223344）　倉庫照明更新／照明盤")),
      ).toBeInTheDocument();
    });
  });

  it("選択解除 clears the selection and reopens the searchable picker", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-001");
    const row = await screen.findByText(labelMatcher("26-001〇A260101　本社ビル電気設備"));
    await user.click(row);

    await waitFor(() => screen.getByText(labelMatcher("26-001〇A260101　本社ビル電気設備")));

    await user.click(screen.getByRole("button", { name: "選択解除" }));

    // Back to the picking view: the search box is visible again and the
    // "現在のProject" display (only rendered in the collapsed view) is gone —
    // 26-001 legitimately still appears as one of the pickable rows in the
    // reopened list, so that alone isn't what "deselected" means here.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/図面番号/)).toBeInTheDocument();
    });
    expect(screen.queryByText("現在のProject")).toBeNull();
  });
});
