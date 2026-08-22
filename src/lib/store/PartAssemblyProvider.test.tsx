import { createContext, useContext, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartAssemblyProvider, usePartAssembly } from "./PartAssemblyProvider";
import type { PartAssemblyRow } from "@/lib/types";

// A minimal, real active-案件 context so PartAssemblyProvider's own
// case-switch effect (reloading rows for the newly active 案件) runs
// exactly as it does in the app — only `partAssemblyService` is faked.
interface FakeActiveCaseValue {
  caseId: string;
  setCaseId: (id: string) => void;
  loading: boolean;
}
const FakeActiveCaseContext = createContext<FakeActiveCaseValue | null>(null);
function FakeActiveCaseProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState("case-1");
  return (
    <FakeActiveCaseContext.Provider
      value={{ caseId, setCaseId, loading: false }}
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

const storeByCase: Record<string, PartAssemblyRow[]> = {
  "case-1": [
    {
      id: "row-1",
      symbol: "S1",
      name: "26-0001の部品",
      manufacturerId: "",
      model: "M1",
      specification: "",
      quantity: 1,
    },
  ],
};

vi.mock("@/lib/services/partAssemblyService", () => ({
  partAssemblyService: {
    listByCase: vi.fn(async (caseId: string) => storeByCase[caseId] ?? []),
    saveRows: vi.fn(async (caseId: string, rows: PartAssemblyRow[]) => {
      storeByCase[caseId] = rows;
    }),
  },
}));

function TestConsumer() {
  const { caseId, setCaseId, rows, addRow } = usePartAssembly();
  return (
    <div>
      <span data-testid="case-id">{caseId}</span>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>{r.name}</li>
        ))}
      </ul>
      <button onClick={() => setCaseId("case-2")}>switch-to-case-2</button>
      <button
        onClick={() =>
          addRow({
            symbol: "S2",
            name: "case-2の部品",
            manufacturerId: "",
            model: "M2",
            specification: "",
            quantity: 1,
          })
        }
      >
        add-row
      </button>
    </div>
  );
}

function renderProvider() {
  render(
    <FakeActiveCaseProvider>
      <PartAssemblyProvider>
        <TestConsumer />
      </PartAssemblyProvider>
    </FakeActiveCaseProvider>,
  );
}

describe("PartAssemblyProvider — 案件 switching never mixes 部品製作 data (spec #18)", () => {
  it("loads case-1's own rows and does not carry them over when switching to case-2", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByText("26-0001の部品")).toBeInTheDocument();
    });

    await user.click(screen.getByText("switch-to-case-2"));

    await waitFor(() =>
      expect(screen.getByTestId("case-id").textContent).toBe("case-2"),
    );
    // case-2 starts with no rows — case-1's row must not leak across.
    await waitFor(() => {
      expect(screen.queryByText("26-0001の部品")).toBeNull();
    });
  });

  it("adding a row while case-2 is active saves it under case-2, not case-1", async () => {
    const user = userEvent.setup();
    renderProvider();

    await user.click(screen.getByText("switch-to-case-2"));
    await waitFor(() =>
      expect(screen.getByTestId("case-id").textContent).toBe("case-2"),
    );

    await user.click(screen.getByText("add-row"));

    await waitFor(() => {
      expect(screen.getByText("case-2の部品")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        storeByCase["case-2"]?.some((r) => r.name === "case-2の部品"),
      ).toBe(true);
    });
    expect(storeByCase["case-1"]?.some((r) => r.name === "case-2の部品")).toBe(
      false,
    );
  });
});
