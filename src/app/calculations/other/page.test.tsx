import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import OtherCalculationPage from "./page";
import type { DesignCase, DesignCaseWithPanels } from "@/lib/types/design";

// Reactive query-string store — router.push() flows back into
// useSearchParams(), same pattern as BusbarCalculationView.test.tsx.
let currentSearch = new URLSearchParams("");
const searchListeners = new Set<() => void>();
function pushSearch(url: string) {
  const qIndex = url.indexOf("?");
  currentSearch = new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : "");
  searchListeners.forEach((l) => l());
}
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSearch, replace: pushSearch }),
  useSearchParams: () =>
    useSyncExternalStore(
      (onStoreChange) => {
        searchListeners.add(onStoreChange);
        return () => searchListeners.delete(onStoreChange);
      },
      () => currentSearch,
    ),
}));

beforeEach(() => {
  currentSearch = new URLSearchParams("");
});

interface FakeActiveCaseValue {
  caseId: string;
  setCaseId: (id: string) => void;
  loading: boolean;
  dirty: boolean;
  registerSaveHandler: (
    id: string,
    handler: (() => Promise<void>) | null,
  ) => void;
  runSaveHandler: () => Promise<void>;
}
const FakeActiveCaseContext = createContext<FakeActiveCaseValue | null>(null);
function FakeActiveCaseProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState("case-1");
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
function useFakeActiveCase() {
  const ctx = useContext(FakeActiveCaseContext);
  if (!ctx) throw new Error("missing FakeActiveCaseProvider in test");
  return ctx;
}
vi.mock("@/lib/store/ActiveCaseProvider", () => ({
  useActiveCase: () => useFakeActiveCase(),
  useEffectiveCaseId: () => useFakeActiveCase().caseId,
}));

vi.mock("@/components/common/CaseSelector", () => ({
  CaseSelector: () => {
    const { caseId } = useFakeActiveCase();
    return <span data-testid="current-case">{caseId}</span>;
  },
}));

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

const case2 = makeCase({
  id: "case-2",
  drawingNumber: "26-0002",
  managementNumber: "A260102",
  projectName: "倉庫照明更新",
});
const allCases: DesignCaseWithPanels[] = [{ case: case2, panels: [] }];

vi.mock("@/lib/services/design", () => ({
  designCaseService: {
    listAll: vi.fn(async () => allCases),
  },
}));

vi.mock("@/lib/services", () => ({
  busbarSizeService: { list: vi.fn(async () => []) },
  earthWireSizeService: { list: vi.fn(async () => []) },
  earthBarSizeService: { list: vi.fn(async () => []) },
  partAssemblyService: { listByCase: vi.fn(async () => []) },
  calculationRecordService: {
    get: vi.fn(async () => null),
    listByCase: vi.fn(async () => []),
    save: vi.fn(),
  },
}));

function renderPage() {
  render(
    <LanguageProvider>
      <FakeActiveCaseProvider>
        <OtherCalculationPage />
      </FakeActiveCaseProvider>
    </LanguageProvider>,
  );
}

describe("他計算 hub — 母線銅帯/接地線/アースバー consolidated as tabs (no separate sidebar pages)", () => {
  it("defaults to 母線銅帯 when no ?module is given", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "母線銅帯計算" })).toBeInTheDocument();
  });

  it("switches to 接地線 when its tab is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "母線銅帯計算" });

    await user.click(screen.getByRole("button", { name: "接地線計算" }));
    expect(await screen.findByRole("heading", { name: "接地線計算" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "母線銅帯計算" })).toBeNull();
  });

  it("switches to アースバー when its tab is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "母線銅帯計算" });

    await user.click(screen.getByRole("button", { name: "アースバー計算" }));
    expect(await screen.findByRole("heading", { name: "アースバー計算" })).toBeInTheDocument();
  });
});

describe("他計算 hub — 保存済み tab (spec follow-up: replace a bare '保存済み' badge with a real reachable tab)", () => {
  it("lists saved 案件 and 開く sets it active + jumps to 母線銅帯", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "母線銅帯計算" });

    await user.click(screen.getByRole("button", { name: "保存済み" }));
    const row = await screen.findByText(/26-0002/);
    expect(row).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-case").textContent).toBe("case-2");
    });
    // 開く jumps straight back to 母線銅帯 so the reopened 案件's calculation is immediately visible.
    expect(await screen.findByRole("heading", { name: "母線銅帯計算" })).toBeInTheDocument();
  });
});
