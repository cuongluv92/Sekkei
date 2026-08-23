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
import { EarthWireCalculationView } from "./EarthWireCalculationView";
import type { EarthWireSize } from "@/lib/types";

// Reactive query-string store — see BusbarCalculationView.test.tsx for why a
// static mock would break the タブ切り替え UI's real router.push() flow.
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
  useEffectiveCaseId: () => useFakeActiveCase().caseId,
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

const sizes: EarthWireSize[] = [
  { id: "e1", areaMm2: 14, order: 0 },
  { id: "e2", areaMm2: 22, order: 1 },
  { id: "e3", areaMm2: 38, order: 2 },
];

type SavedRecord = {
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
};
const savedRecords: Record<string, Record<string, SavedRecord>> = {
  "case-1": {
    "earth-wire": {
      input: {
        ratedCurrentRaw: "400",
        groundingTypeRaw: "D",
        mode: "auto",
        manualSizeId: "",
      },
      result: {
        adopted: {
          sizeId: "e2",
          areaMm2: 22,
          marginPercent: 5.77,
          judgment: "ok",
          adoptedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  "case-3": {
    busbar: {
      input: {
        ratedCurrentRaw: "400",
        mode: "auto",
        thicknessRaw: "",
        widthRaw: "",
        barsRaw: "1",
      },
      result: { adopted: null },
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
};

vi.mock("@/lib/services", () => ({
  earthWireSizeService: { list: vi.fn(async () => sizes) },
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
        <EarthWireCalculationView />
      </FakeActiveCaseProvider>
    </LanguageProvider>,
  );
}

describe("EarthWireCalculationView — saved calculation reload (spec #34)", () => {
  it("restores the saved rated current and adopted candidate for a 案件 that already has one", async () => {
    renderView();

    const currentInput = (await screen.findByPlaceholderText(
      "400",
    )) as HTMLInputElement;
    await waitFor(() => expect(currentInput.value).toBe("400"));
    await waitFor(() => {
      expect(screen.getByText("採用済み")).toBeInTheDocument();
    });
  });
});

describe("EarthWireCalculationView — 案件 switching never mixes data (spec #34)", () => {
  it("clears case-1's state when switching to a 案件 with no saved 接地線 calculation", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() =>
      expect(screen.getByText("採用済み")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("switch-to-case-2"));

    await waitFor(() => {
      expect(screen.getByTestId("current-case").textContent).toBe("case-2");
    });
    await waitFor(() => {
      const freshInput = screen.getByPlaceholderText("400") as HTMLInputElement;
      expect(freshInput.value).toBe("");
    });
    expect(screen.queryByText("採用済み")).toBeNull();
  });
});

describe("EarthWireCalculationView — C種/D種 auto candidate search + adopt (spec #23, #24, #34)", () => {
  it("computes 0.052×In and lets the user adopt a candidate for D種接地工事", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "D");
    const input = await screen.findByPlaceholderText("400");
    await user.clear(input);
    await user.type(input, "400");

    // 0.052 × 400 = 20.8mm² required — visible in the formula panel.
    await waitFor(() => {
      expect(screen.getByText(/0.052 × 400 = 20.8/)).toBeInTheDocument();
    });

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(
        within(table).getAllByRole("button", { name: "この構成を採用" }).length,
      ).toBeGreaterThan(0);
    });
    // 14mm² is below the 20.8mm² requirement, so it must not appear as a candidate.
    expect(within(table).queryByText("14 mm²")).toBeNull();

    await user.click(
      within(table).getAllByRole("button", { name: "この構成を採用" })[0],
    );
    await waitFor(() => {
      expect(within(table).getByText("採用済み")).toBeInTheDocument();
    });
  });
});

describe("EarthWireCalculationView — A種/B種 never reuse the C/D formula (spec #23, #34)", () => {
  it("shows the unsupported message and no fabricated candidates for A種接地工事", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "A");
    const input = await screen.findByPlaceholderText("400");
    await user.clear(input);
    await user.type(input, "400");

    await waitFor(() => {
      expect(
        screen.getByText(/A種・B種接地工事の接地線太さ選定には対応していません/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("EarthWireCalculationView — prefill from 母線銅帯's saved 定格電流 (spec #29)", () => {
  it("prefills 定格電流 from the same 案件's saved busbar record when no 接地線 input exists yet", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-3"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-3"),
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText("400") as HTMLInputElement;
      expect(input.value).toBe("400");
    });
    expect(
      screen.getByText("母線銅帯の定格電流から自動入力されました（変更可能）"),
    ).toBeInTheDocument();
  });
});

describe("EarthWireCalculationView — 手動検証 what-if (spec #17, #30)", () => {
  it("shows real margin/judgment when a master size is picked against a required area", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "C");
    const input = await screen.findByPlaceholderText("400");
    await user.clear(input);
    await user.type(input, "150"); // required = 7.8mm²

    await user.click(screen.getByRole("button", { name: "手動検証" }));
    await user.selectOptions(
      screen.getByLabelText("検証するサイズ"),
      "e1", // 14mm² vs 7.8mm² required — within the non-oversized margin
    );

    await waitFor(() => {
      expect(screen.getByText("OK")).toBeInTheDocument();
    });
  });
});
