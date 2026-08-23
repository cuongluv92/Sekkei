import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { NewCaseModal } from "./NewCaseModal";
import type { DesignCase } from "@/lib/types/design";

const createdCase: DesignCase = {
  id: "case-new",
  year: 2026,
  sequenceNo: 4,
  drawingNumber: "26-004",
  requestType: "",
  managementNumber: "",
  constructionNumber: "",
  orderer: "",
  customerContact: "",
  projectName: "新しい案件",
  specs: {},
  designRemarks: "",
  indexCategory: "other",
  assignee: "",
  caseStatus: "",
  manufacturingComplete: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  deletedAt: null,
};

// vi.mock factories are hoisted above regular top-level statements, so
// anything they reference must itself be created inside vi.hoisted (the
// documented escape hatch), not a plain top-level const.
const { mockPreviewNextDrawingNumber, mockCreate } = vi.hoisted(() => ({
  mockPreviewNextDrawingNumber: vi.fn(async () => "26-0004"),
  mockCreate: vi.fn(async () => ({}) as DesignCase),
}));
mockCreate.mockImplementation(async () => createdCase);

vi.mock("@/lib/services/design", () => ({
  designCaseService: {
    previewNextDrawingNumber: mockPreviewNextDrawingNumber,
    create: mockCreate,
  },
  masterListService: {
    listByKey: vi.fn(async () => []),
    add: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderModal(autoNumberDrawingNumber?: boolean) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <NewCaseModal
        onClose={onClose}
        onCreated={onCreated}
        autoNumberDrawingNumber={autoNumberDrawingNumber}
      />
    </LanguageProvider>,
  );
  return { onCreated, onClose };
}

describe("NewCaseModal — 図面番号 auto-numbering is 設計依頼-only (spec follow-up #2)", () => {
  it("auto-suggests the next 図面番号 and never asks the user to type it, when autoNumberDrawingNumber is true (設計管理's own flow)", async () => {
    renderModal(true);

    await waitFor(() => {
      expect(screen.getByText("26-0004")).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText("26-004")).toBeNull();
  });

  it("lets the user type 図面番号 by hand when autoNumberDrawingNumber is false (every other 案件-creation entry point), without requiring it", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderModal(false);

    expect(mockPreviewNextDrawingNumber).not.toHaveBeenCalled();
    const drawingNumberInput = await screen.findByPlaceholderText("26-004");

    const projectNameInput = screen.getByLabelText("件名", { exact: false });
    await user.type(projectNameInput, "新しい案件");

    // No field is required to submit (spec follow-up: 新規案件 saves
    // whatever's filled in, nothing blocks 作成する).
    const submitButton = screen.getByRole("button", { name: /作成|Tạo/i });
    expect(submitButton).not.toBeDisabled();

    await user.type(drawingNumberInput, "26-005");
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ drawingNumber: "26-005" }),
      );
    });
    expect(onCreated).toHaveBeenCalled();
  });

  it("never auto-numbers 26-004 following an existing 26-003 outside the 設計依頼 flow — the field starts blank, not pre-filled", async () => {
    renderModal(false);
    const drawingNumberInput = (await screen.findByPlaceholderText(
      "26-004",
    )) as HTMLInputElement;
    expect(drawingNumberInput.value).toBe("");
  });

  it("submits with 図面番号 left blank as an empty string, never as undefined (which the service reads as 'auto-number this')", async () => {
    const user = userEvent.setup();
    renderModal(false);

    const submitButton = await screen.findByRole("button", {
      name: /作成|Tạo/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ drawingNumber: "" }),
      );
    });
  });
});
