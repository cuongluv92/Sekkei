import { createContext, useContext, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BusbarCalculationView } from "./BusbarCalculationView";
import type { BusbarSize } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

// A minimal, real (not stubbed) active-案件 context so BusbarCalculationView's
// own case-switch effect (resetting the hydrate guard, reloading the saved
// record) runs exactly as it does in the app — only the underlying
// designCaseService/calculationRecordService calls are faked below.
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
      </div>
    );
  },
}));

const sizes: BusbarSize[] = [
  { id: "s1", thicknessMm: 4, widthMm: 20, order: 0 },
  { id: "s2", thicknessMm: 6, widthMm: 50, order: 1 },
];

const savedRecords: Record<
  string,
  {
    input: Record<string, unknown>;
    result: Record<string, unknown>;
    updatedAt: string;
  }
> = {
  "case-1": {
    input: {
      ratedCurrentRaw: "180",
      mode: "auto",
      thicknessRaw: "",
      widthRaw: "",
      barsRaw: "1",
    },
    result: {
      adopted: {
        sizeId: "s1",
        thicknessMm: 4,
        widthMm: 20,
        barsPerPhase: 1,
        totalAreaMm2: 80,
        actualDensityAPerMm2: 2.25,
        marginPercent: 11.1,
        judgment: "ok",
        adoptedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

vi.mock("@/lib/services", () => ({
  busbarSizeService: { list: vi.fn(async () => sizes) },
  calculationRecordService: {
    get: vi.fn(async (caseId: string, calculationType: string) => {
      const record = savedRecords[caseId];
      if (!record || calculationType !== "busbar") return null;
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
        savedRecords[caseId] = { input, result, updatedAt };
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
        <BusbarCalculationView />
      </FakeActiveCaseProvider>
    </LanguageProvider>,
  );
}

describe("BusbarCalculationView — saved calculation reload (spec #25)", () => {
  it("restores the saved rated current and adopted candidate for a 案件 that already has one", async () => {
    renderView();

    const currentInput = (await screen.findByPlaceholderText(
      "180",
    )) as HTMLInputElement;
    await waitFor(() => expect(currentInput.value).toBe("180"));

    // The previously-adopted 4×20×1本 should show as adopted, not re-offered with a 採用 button.
    await waitFor(() => {
      expect(screen.getByText("採用済み")).toBeInTheDocument();
    });
  });
});

describe("BusbarCalculationView — 案件 switching never mixes data (spec #18, #25)", () => {
  it("clears case-1's rated current/adopted state when switching to a 案件 with no saved calculation", async () => {
    const user = userEvent.setup();
    renderView();

    const currentInput = (await screen.findByPlaceholderText(
      "180",
    )) as HTMLInputElement;
    await waitFor(() => expect(currentInput.value).toBe("180"));
    await waitFor(() =>
      expect(screen.getByText("採用済み")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("switch-to-case-2"));

    await waitFor(() => {
      expect(screen.getByTestId("current-case").textContent).toBe("case-2");
    });
    // case-2 has no saved record — the rated current field must be blank, not
    // carrying over case-1's "180", and there must be no lingering 採用済み.
    await waitFor(() => {
      const freshInput = screen.getByPlaceholderText("180") as HTMLInputElement;
      expect(freshInput.value).toBe("");
    });
    expect(screen.queryByText("採用済み")).toBeNull();
  });
});

describe("BusbarCalculationView — Auto mode candidate search + adopt", () => {
  it("shows candidates for a valid rated current and lets the user adopt one", async () => {
    const user = userEvent.setup();
    renderView();

    // Switch to case-2 (blank slate) to test the full type→search→adopt flow independent of preloaded case-1 data.
    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-case").textContent).toBe("case-2"),
    );

    const input = await screen.findByPlaceholderText("180");
    await user.clear(input);
    await user.type(input, "180");

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(
        within(table).getAllByRole("button", { name: "この構成を採用" }).length,
      ).toBeGreaterThan(0);
    });

    await user.click(
      within(table).getAllByRole("button", { name: "この構成を採用" })[0],
    );

    await waitFor(() => {
      expect(within(table).getByText("採用済み")).toBeInTheDocument();
    });
  });
});
