import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BusbarCalculationView } from "./BusbarCalculationView";
import type { BusbarSize } from "@/lib/types";

// PageHeader's own "← 戻る" button calls useRouter().back() — this view no
// longer uses next/navigation itself (no more 案件/URL-driven state), but
// PageHeader still needs an App Router context to render at all.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const sizes: BusbarSize[] = [
  { id: "s1", thicknessMm: 4, widthMm: 20, order: 0 },
  { id: "s2", thicknessMm: 6, widthMm: 50, order: 1 },
];

vi.mock("@/lib/services", () => ({
  busbarSizeService: { list: vi.fn(async () => sizes) },
}));

function renderView() {
  render(
    <LanguageProvider>
      <BusbarCalculationView />
    </LanguageProvider>,
  );
}

describe("BusbarCalculationView — stateless calculator (no 案件/save, like every other 電気技術計算 tool)", () => {
  it("renders directly with no 案件 selection gating", async () => {
    renderView();
    // No CaseSelector / 案件選択 prompt — the input is available immediately.
    expect(await screen.findByPlaceholderText("180")).toBeInTheDocument();
    expect(screen.queryByText("案件を選択してください")).toBeNull();
  });
});

describe("BusbarCalculationView — Auto mode candidate search + adopt (purely local, no persistence)", () => {
  it("shows candidates for a valid rated current and lets the user adopt one", async () => {
    const user = userEvent.setup();
    renderView();

    const input = await screen.findByPlaceholderText("180");
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

describe("BusbarCalculationView — 定格電流 is two independent range-scoped boxes, not one auto-switching field (spec follow-up)", () => {
  it("filling the ～630A box disables the 630A～ box, and vice versa, so only one range is ever active at once", async () => {
    const user = userEvent.setup();
    renderView();

    const lowInput = (await screen.findByPlaceholderText(
      "180",
    )) as HTMLInputElement;
    const highInput = (await screen.findByPlaceholderText(
      "800",
    )) as HTMLInputElement;
    expect(lowInput).not.toBeDisabled();
    expect(highInput).not.toBeDisabled();

    await user.type(lowInput, "180");
    await waitFor(() => expect(highInput).toBeDisabled());
    expect(highInput.value).toBe("");

    await user.clear(lowInput);
    await waitFor(() => expect(highInput).not.toBeDisabled());

    await user.type(highInput, "1000");
    await waitFor(() => expect(lowInput).toBeDisabled());
    expect(lowInput.value).toBe("");
  });

  it("shows the 計算式 (with real substituted numbers) inside the ～630A 定格電流 panel itself, not only in 計算根拠", async () => {
    const user = userEvent.setup();
    renderView();

    const lowInput = await screen.findByPlaceholderText("180");
    await user.type(lowInput, "180");

    const lowPanelTitle = await screen.findByText("定格電流（～630A）");
    const lowPanel = lowPanelTitle.closest(".panel") as HTMLElement;
    await waitFor(() => {
      expect(within(lowPanel).getByText("180 / 2.5 = 72 mm²")).toBeInTheDocument();
    });
  });

  it("shows real geometry candidates marked 要確認 (never a fabricated OK) for a value typed into the 630A～ box, and still lets the user adopt one", async () => {
    const user = userEvent.setup();
    renderView();

    const highInput = await screen.findByPlaceholderText("800");
    await user.type(highInput, "1000");

    const table = await screen.findByRole("table");
    // Every judgment cell must read 要確認 — never ok/caution/ng for this range.
    expect(within(table).queryByText("OK")).toBeNull();
    expect(within(table).queryByText("NG")).toBeNull();
    expect(within(table).getAllByText("要確認").length).toBeGreaterThan(0);

    await user.click(
      within(table).getAllByRole("button", { name: "この構成を採用" })[0],
    );

    await waitFor(() => {
      expect(within(table).getByText("採用済み")).toBeInTheDocument();
    });
  });

  it("directs the user to the 630A～ box instead of silently extrapolating, when a value over 630A is typed into the ～630A box", async () => {
    const user = userEvent.setup();
    renderView();

    const lowInput = await screen.findByPlaceholderText("180");
    await user.type(lowInput, "1000");

    await waitFor(() => {
      expect(
        screen.getByText(/定格電流（630A～）」欄をご利用ください/),
      ).toBeInTheDocument();
    });
    // No JIS candidate list is offered for an out-of-range ～630A value.
    expect(screen.queryByText("候補（～630A）")).toBeNull();
  });

  it("手動検証 for 6×50×2本 against a 630A～ target shows real geometry (no fabricated 許容電流/OK)", async () => {
    const user = userEvent.setup();
    renderView();

    const highInput = await screen.findByPlaceholderText("800");
    await user.type(highInput, "1000");

    await user.click(screen.getByRole("button", { name: "手動検証" }));

    const thicknessInput = await screen.findByPlaceholderText("6");
    await user.type(thicknessInput, "6");
    const widthInput = await screen.findByPlaceholderText("50");
    await user.type(widthInput, "50");
    const barsInput = screen.getByDisplayValue("1");
    await user.clear(barsInput);
    await user.type(barsInput, "2");

    await waitFor(() => {
      // 6×50×2本 = 600mm², shown as real geometry.
      expect(screen.getByText("600 mm²")).toBeInTheDocument();
    });
    expect(screen.getAllByText("要確認").length).toBeGreaterThan(0);
  });
});

describe("BusbarCalculationView — 断面積→電流 reverse lookup (spec follow-up: menseki→A must be a real, discoverable mode)", () => {
  it("shows a max-current readout for a directly-entered area in the ～630A box, independent of the 定格電流 field", async () => {
    const user = userEvent.setup();
    renderView();

    const areaInput = await screen.findByPlaceholderText("72");
    await user.type(areaInput, "72");

    // 72mm² is exactly the area 180A requires at 2.5 A/mm² (180 / 2.5 = 72).
    await waitFor(() => {
      expect(screen.getByText("180 A")).toBeInTheDocument();
    });
  });

  it("caps at 630A for an area far beyond the simplified table's ceiling, never extrapolating", async () => {
    const user = userEvent.setup();
    renderView();

    const areaInput = await screen.findByPlaceholderText("72");
    await user.type(areaInput, "400");

    await waitFor(() => {
      expect(screen.getByText("630+ A")).toBeInTheDocument();
    });
  });

  it("never fabricates a number for an area implying >630A — shows the honest unavailable explanation alongside the capped 630+A reading, in the same panel", async () => {
    const user = userEvent.setup();
    renderView();

    const areaInput = await screen.findByPlaceholderText("72");
    await user.type(areaInput, "400");

    await waitFor(() => {
      expect(screen.getByText("630+ A")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/630Aを超える範囲では断面積から電流を逆算できません/),
    ).toBeInTheDocument();
    // There is only ever one 断面積→電流 panel now — no separate always-empty
    // "630A～" tool duplicating this explanation.
    expect(screen.queryByPlaceholderText("800")).not.toBeNull();
    expect(screen.getAllByText("断面積 → 電流").length).toBe(1);
  });
});
