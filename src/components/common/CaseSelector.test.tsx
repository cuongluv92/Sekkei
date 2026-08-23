import { createContext, useContext, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { CaseSelector } from "./CaseSelector";
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
  drawingNumber: "26-0003",
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
  designCaseService: {
    listAll: vi.fn(async () => allCases),
  },
}));

// NewCaseModal itself (and its own SpecCombobox/masterListService
// dependencies) isn't the point of these tests — only whether CaseSelector
// renders "＋新規案件" and which `autoNumberDrawingNumber` it forwards. See
// NewCaseModal.test.tsx for the auto-vs-manual 図面番号 behavior itself.
// Captured via an object wrapper (not a bare reassigned `let`) so TS
// doesn't narrow it to `null` from control-flow analysis of a same-scope
// assignment that actually happens later, inside the mocked component.
const newCaseModalCall: { props: { autoNumberDrawingNumber?: boolean } | null } =
  { props: null };
vi.mock("@/components/common/NewCaseModal", () => ({
  NewCaseModal: (props: { autoNumberDrawingNumber?: boolean }) => {
    newCaseModalCall.props = props;
    return <div data-testid="new-case-modal" />;
  },
}));

interface FakeActiveCaseValue {
  caseId: string;
  setCaseId: (id: string) => void;
  loading: boolean;
  dirty: boolean;
  registerSaveHandler: () => void;
  runSaveHandler: () => Promise<void>;
}
const FakeActiveCaseContext = createContext<FakeActiveCaseValue | null>(null);
function FakeActiveCaseProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState("");
  return (
    <FakeActiveCaseContext.Provider
      value={{
        caseId,
        setCaseId,
        loading: false,
        dirty: false,
        registerSaveHandler: () => {},
        runSaveHandler: async () => {},
      }}
    >
      {children}
    </FakeActiveCaseContext.Provider>
  );
}
vi.mock("@/lib/store/ActiveCaseProvider", () => ({
  useActiveCase: () => {
    const ctx = useContext(FakeActiveCaseContext);
    if (!ctx) throw new Error("missing FakeActiveCaseProvider in test");
    return ctx;
  },
}));

// Testing Library's default text normalizer collapses all Unicode
// whitespace (including the label's full-width "　" separator) down to a
// plain space before comparing — so matching against the literal label
// string with its real "　" character never succeeds. Match by regex
// instead, treating any whitespace run as equivalent.
function labelMatcher(label: string): RegExp {
  const escaped = label
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[\s\u3000]+/g, "\\s+");
  return new RegExp(`^${escaped}$`);
}

function Harness({
  autoNumberDrawingNumber,
}: { autoNumberDrawingNumber?: boolean } = {}) {
  return (
    <LanguageProvider>
      <FakeActiveCaseProvider>
        <CaseSelector autoNumberDrawingNumber={autoNumberDrawingNumber} />
      </FakeActiveCaseProvider>
    </LanguageProvider>
  );
}

describe("CaseSelector — 26-0001/26-0002/26-0003 each independently findable (spec #1, #5, #18)", () => {
  it("finds, selects, and displays 26-0001 in the 〇（）／ format — distinct from 26-0002/26-0003", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-0001");

    const row = await screen.findByText(
      labelMatcher("26-0001〇A260101　本社ビル電気設備"),
    );
    expect(screen.queryByText(/26-0002/)).toBeNull();
    expect(screen.queryByText(/26-0003/)).toBeNull();

    await user.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(labelMatcher("26-0001〇A260101　本社ビル電気設備")),
      ).toBeInTheDocument();
    });
  });

  it("finds and selects 26-0002 with its 工事番号 shown, format has no | separator", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-0002");

    const row = await screen.findByText(
      labelMatcher("26-0002〇A260102（R223301）　工場増設"),
    );
    expect(row.textContent).not.toContain("|");
    await user.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(labelMatcher("26-0002〇A260102（R223301）　工場増設")),
      ).toBeInTheDocument();
    });
  });

  it("finds 26-0003 by its 盤名称 (照明盤) and selects it with the full format including panel name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "照明盤");

    const row = await screen.findByText(
      labelMatcher("26-0003〇A260103（R223344）　倉庫照明更新／照明盤"),
    );
    await user.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(
          labelMatcher("26-0003〇A260103（R223344）　倉庫照明更新／照明盤"),
        ),
      ).toBeInTheDocument();
    });
  });

  it("選択解除 clears the selection and reopens the searchable picker", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const search = await screen.findByPlaceholderText(/図面番号/);
    await user.type(search, "26-0001");
    const row = await screen.findByText(
      labelMatcher("26-0001〇A260101　本社ビル電気設備"),
    );
    await user.click(row);

    await waitFor(() =>
      screen.getByText(labelMatcher("26-0001〇A260101　本社ビル電気設備")),
    );

    await user.click(screen.getByRole("button", { name: /選択解除/ }));

    // Back to the picking view: the search box is visible again and the
    // "現在の案件" display (only rendered in the collapsed view) is gone.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/図面番号/)).toBeInTheDocument();
    });
    expect(screen.queryByText("現在の案件")).toBeNull();
  });
});

describe("CaseSelector — ＋新規案件 is always available; only 図面番号 auto-numbering is 設計依頼-only", () => {
  it("shows ＋新規案件 by default and does not auto-number 図面番号 (autoNumberDrawingNumber defaults to false)", async () => {
    const user = userEvent.setup();
    newCaseModalCall.props = null;
    render(<Harness />);

    const button = await screen.findByRole("button", { name: /新規案件/ });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(await screen.findByTestId("new-case-modal")).toBeInTheDocument();
    const props1 = newCaseModalCall.props as { autoNumberDrawingNumber?: boolean } | null;
    expect(props1?.autoNumberDrawingNumber).toBeFalsy();
  });

  it("still shows ＋新規案件 and enables 図面番号 auto-numbering when autoNumberDrawingNumber is passed (設計管理's own CaseSelector)", async () => {
    const user = userEvent.setup();
    newCaseModalCall.props = null;
    render(<Harness autoNumberDrawingNumber />);

    const button = await screen.findByRole("button", { name: /新規案件/ });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(await screen.findByTestId("new-case-modal")).toBeInTheDocument();
    const props2 = newCaseModalCall.props as { autoNumberDrawingNumber?: boolean } | null;
    expect(props2?.autoNumberDrawingNumber).toBe(true);
  });
});
