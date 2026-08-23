import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActiveCaseProvider,
  useActiveCase,
  useEffectiveCaseId,
} from "./ActiveCaseProvider";
import type { DesignCaseWithPanels } from "@/lib/types/design";

const detailByCaseId: Record<string, DesignCaseWithPanels> = {
  "case-1": {
    case: {
      id: "case-1",
      year: 2026,
      sequenceNo: 1,
      drawingNumber: "26-001",
      requestType: "",
      managementNumber: "",
      constructionNumber: "",
      orderer: "",
      customerContact: "",
      projectName: "restored-case",
      specs: {},
      designRemarks: "",
      indexCategory: "other",
      assignee: "",
      caseStatus: "",
      manufacturingComplete: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      deletedAt: null,
    },
    panels: [],
  },
};

vi.mock("@/lib/services/design", () => ({
  designCaseService: {
    getDetail: vi.fn(async (id: string) => detailByCaseId[id] ?? null),
  },
}));

let storedCaseId = "";
vi.mock("@/lib/utils/localStore", () => ({
  loadFromStorage: vi.fn(() => storedCaseId),
  saveToStorage: vi.fn((_key: string, value: string) => {
    storedCaseId = value;
  }),
}));

function Consumer({ suppress }: { suppress: boolean }) {
  const { caseId: rawCaseId, setCaseId } = useActiveCase();
  const effectiveCaseId = useEffectiveCaseId(suppress);
  return (
    <div>
      <span data-testid="raw">{rawCaseId || "(none)"}</span>
      <span data-testid="effective">{effectiveCaseId || "(none)"}</span>
      <button onClick={() => setCaseId("case-2")}>pick-case-2</button>
      <button onClick={() => setCaseId("")}>deselect</button>
    </div>
  );
}

describe("useEffectiveCaseId — hides a restored 案件 from 設計依頼書/製作依頼書 without touching the app-wide active 案件", () => {
  it("suppress=true hides the restored 案件 until a genuine pick happens, then passes it through normally", async () => {
    storedCaseId = "case-1";
    const user = userEvent.setup();
    render(
      <ActiveCaseProvider>
        <Consumer suppress />
      </ActiveCaseProvider>,
    );

    // The raw context caseId restores from storage as usual...
    await waitFor(() => {
      expect(screen.getByTestId("raw").textContent).toBe("case-1");
    });
    // ...but the suppressed view never shows it.
    expect(screen.getByTestId("effective").textContent).toBe("(none)");

    // A genuine pick (here, or anywhere else sharing the same context)
    // un-suppresses immediately.
    await user.click(screen.getByText("pick-case-2"));
    await waitFor(() => {
      expect(screen.getByTestId("effective").textContent).toBe("case-2");
    });
    expect(screen.getByTestId("raw").textContent).toBe("case-2");
  });

  it("suppress=false always mirrors the raw caseId, including the restored value", async () => {
    storedCaseId = "case-1";
    render(
      <ActiveCaseProvider>
        <Consumer suppress={false} />
      </ActiveCaseProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("raw").textContent).toBe("case-1");
    });
    expect(screen.getByTestId("effective").textContent).toBe("case-1");
  });

  it("suppress=true is a no-op when there was nothing to restore", async () => {
    storedCaseId = "";
    render(
      <ActiveCaseProvider>
        <Consumer suppress />
      </ActiveCaseProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("raw").textContent).toBe("(none)");
    });
    expect(screen.getByTestId("effective").textContent).toBe("(none)");
  });
});
