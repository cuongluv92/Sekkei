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

// A minimal, real (not stubbed) active-Project context so BusbarCalculationView's
// own project-switch effect (resetting the hydrate guard, reloading the saved
// record) runs exactly as it does in the app — only the underlying
// projectService/calculationRecordService calls are faked below.
interface FakeActiveProjectValue {
  projectId: string;
  setProjectId: (id: string) => void;
  loading: boolean;
}
const FakeActiveProjectContext = createContext<FakeActiveProjectValue | null>(
  null,
);
function FakeActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState("proj-1");
  return (
    <FakeActiveProjectContext.Provider
      value={{ projectId, setProjectId, loading: false }}
    >
      {children}
    </FakeActiveProjectContext.Provider>
  );
}
vi.mock("@/lib/store/ActiveProjectProvider", () => ({
  useActiveProject: () => {
    const ctx = useContext(FakeActiveProjectContext);
    if (!ctx) throw new Error("missing FakeActiveProjectProvider in test");
    return ctx;
  },
}));

vi.mock("@/components/common/ProjectSelector", () => ({
  ProjectSelector: ({
    projectId,
    onProjectChange,
  }: {
    projectId: string;
    onProjectChange: (id: string) => void;
  }) => (
    <div>
      <span data-testid="current-project">{projectId}</span>
      <button onClick={() => onProjectChange("proj-2")}>
        switch-to-proj-2
      </button>
    </div>
  ),
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
  "proj-1": {
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
    get: vi.fn(async (projectId: string, calculationType: string) => {
      const record = savedRecords[projectId];
      if (!record || calculationType !== "busbar") return null;
      return { id: "r1", projectId, calculationType, ...record };
    }),
    save: vi.fn(
      async (
        projectId: string,
        calculationType: string,
        input: Record<string, unknown>,
        result: Record<string, unknown>,
      ) => {
        const updatedAt = new Date().toISOString();
        savedRecords[projectId] = { input, result, updatedAt };
        return {
          id: "r1",
          projectId,
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
      <FakeActiveProjectProvider>
        <BusbarCalculationView />
      </FakeActiveProjectProvider>
    </LanguageProvider>,
  );
}

describe("BusbarCalculationView — saved calculation reload (spec #25)", () => {
  it("restores the saved rated current and adopted candidate for a Project that already has one", async () => {
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

describe("BusbarCalculationView — Project switching never mixes data (spec #25)", () => {
  it("clears proj-1's rated current/adopted state when switching to a Project with no saved calculation", async () => {
    const user = userEvent.setup();
    renderView();

    const currentInput = (await screen.findByPlaceholderText(
      "180",
    )) as HTMLInputElement;
    await waitFor(() => expect(currentInput.value).toBe("180"));
    await waitFor(() =>
      expect(screen.getByText("採用済み")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("switch-to-proj-2"));

    await waitFor(() => {
      expect(screen.getByTestId("current-project").textContent).toBe("proj-2");
    });
    // proj-2 has no saved record — the rated current field must be blank, not
    // carrying over proj-1's "180", and there must be no lingering 採用済み.
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

    // Switch to proj-2 (blank slate) to test the full type→search→adopt flow independent of preloaded proj-1 data.
    await user.click(screen.getByText("switch-to-proj-2"));
    await waitFor(() =>
      expect(screen.getByTestId("current-project").textContent).toBe("proj-2"),
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
