import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { EarthBarCalculationView } from "./EarthBarCalculationView";
import type { EarthBarSize } from "@/lib/types";

let currentSearch = new URLSearchParams("");
const searchListeners = new Set<() => void>();
function pushSearch(url: string) {
  const qIndex = url.indexOf("?");
  currentSearch = new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : "");
  searchListeners.forEach((l) => l());
}
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSearch }),
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
}));

vi.mock("@/components/common/CaseSelector", () => ({
  CaseSelector: () => {
    const { caseId, setCaseId } = useFakeActiveCase();
    return (
      <div>
        <span data-testid="current-case">{caseId}</span>
        <button onClick={() => setCaseId("case-2")}>switch-to-case-2</button>
        <button onClick={() => setCaseId("case-3")}>switch-to-case-3</button>
      </div>
    );
  },
}));

const sizes: EarthBarSize[] = [
  { id: "b1", thicknessMm: 3, widthMm: 25, order: 0 },
  { id: "b2", thicknessMm: 3, widthMm: 30, order: 1 },
];

type SavedRecord = {
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
};
const savedRecords: Record<string, Record<string, SavedRecord>> = {
  "case-1": {
    "earth-bar": {
      input: {
        equipmentTypeRaw: "cabinet",
        groundingTypeRaw: "D",
        faultCurrentRaw: "31.5",
        clearingTimeRaw: "0.5",
        mode: "auto",
        thicknessRaw: "",
        widthRaw: "",
        barsRaw: "1",
      },
      result: {
        adopted: {
          sizeId: "b1",
          thicknessMm: 3,
          widthMm: 25,
          barsPerPhase: 1,
          totalAreaMm2: 75,
          faultCurrentKA: 31.5,
          clearingTimeS: 0.5,
          requiredAreaMm2: null,
          marginPercent: null,
          judgment: "requiresVerification",
          method: "断熱法 S = I√t / k（JIS C 60364-5-54, k値未確認）",
          adoptedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  "case-3": {
    "earth-wire": {
      input: {
        ratedCurrentRaw: "400",
        groundingTypeRaw: "C",
        mode: "auto",
        manualSizeId: "",
      },
      result: { adopted: null },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
};

vi.mock("@/lib/services", () => ({
  earthBarSizeService: { list: vi.fn(async () => sizes) },
  calculationRecordService: {
    get: vi.fn(async (caseId: string, calculationType: string) => {
      const record = savedRecords[caseId]?.[calculationType];
      if (!record) return null;
      return { id: "r1", caseId, calculationType, ...record };
    }),
    save: vi.fn(
      async (
        caseId: string,
        calculationType: string,
        input: Record<string, unknown>,
        result: Record<string, unknown>,
      ) => {
        const updatedAt = new Date().toISOString();
        savedRecords[caseId] = {
          ...(savedRecords[caseId] ?? {}),
          [calculationType]: { input, result, updatedAt },
        };
        return {
          id: "r1",
          caseId,
          calculationType,
          input,
          result,
          updatedAt,
        };
      },
    ),
  },
}));

function renderView() {
  render(
    <LanguageProvider>
      <FakeActiveCaseProvider>
        <EarthBarCalculationView />
      </FakeActiveCaseProvider>
    </LanguageProvider>,
  );
}

describe("EarthBarCalculationView — saved calculation reload (spec #34)", () => {
  it("restores the saved candidate for a 案件 that already has one", async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText("採用済み")).toBeInTheDocument();
    });
  });
});

describe("EarthBarCalculationView — never a fabricated OK/NG (spec #19, #26-28, #37)", () => {
  it("shows real geometry candidates all marked 要確認, never ok/caution/ng, and lets the user adopt one", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    const table = await screen.findByRole("table");
    expect(within(table).queryByText("OK")).toBeNull();
    expect(within(table).queryByText("NG")).toBeNull();
    expect(within(table).getAllByText("要確認").length).toBeGreaterThan(0);
    // Real geometry: 3×25×1 = 75mm².
    expect(within(table).getByText("75 mm²")).toBeInTheDocument();

    await user.click(
      within(table).getAllByRole("button", { name: "この構成を採用" })[0],
    );
    await waitFor(() => {
      expect(within(table).getByText("採用済み")).toBeInTheDocument();
    });
  });
});

describe("EarthBarCalculationView — never reuses 接地線's 0.052×In formula (spec #26, #28)", () => {
  it("never computes a required area even when 事故電流/遮断時間 are supplied", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    const faultInput = await screen.findByPlaceholderText("31.5");
    await user.type(faultInput, "31.5");
    const timeInput = screen.getByPlaceholderText("0.5");
    await user.type(timeInput, "0.5");

    await waitFor(() => {
      expect(
        screen.getByText(/短絡耐量.*k値が未確認/),
      ).toBeInTheDocument();
    });
    const table = await screen.findByRole("table");
    expect(within(table).queryByText("OK")).toBeNull();
  });
});

describe("EarthBarCalculationView — prefill from 接地線's saved 接地工事種別 (spec #29)", () => {
  it("prefills 接地工事種別 from the same 案件's saved 接地線 record when no アースバー input exists yet", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-3"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-3"),
    );

    await waitFor(() => {
      const select = screen.getByLabelText("接地工事種別") as HTMLSelectElement;
      expect(select.value).toBe("C");
    });
    expect(
      screen.getByText("接地線の接地工事種別から自動入力されました（変更可能）"),
    ).toBeInTheDocument();
  });
});

describe("EarthBarCalculationView — 手動検証 what-if (e.g. 3×25/3×30/3×40)", () => {
  it("shows real total area for a manual configuration, always 要確認", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    await user.click(screen.getByRole("button", { name: "手動検証" }));

    const thicknessInput = await screen.findByPlaceholderText("3");
    await user.type(thicknessInput, "3");
    const widthInput = screen.getByPlaceholderText("25");
    await user.type(widthInput, "40");
    const barsInput = screen.getByDisplayValue("1");
    await user.clear(barsInput);
    await user.type(barsInput, "1");

    await waitFor(() => {
      expect(screen.getByText("120 mm²")).toBeInTheDocument(); // 3×40×1
    });
    expect(screen.getAllByText("要確認").length).toBeGreaterThan(0);
  });
});
