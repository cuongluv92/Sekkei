import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { EarthBarCalculationView } from "./EarthBarCalculationView";
import type { EarthBarSize } from "@/lib/types";

// PageHeader's own "← 戻る" button calls useRouter().back() — this view no
// longer uses next/navigation itself (no more 案件/URL-driven state), but
// PageHeader still needs an App Router context to render at all.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const sizes: EarthBarSize[] = [
  { id: "b1", thicknessMm: 3, widthMm: 25, order: 0 },
  { id: "b2", thicknessMm: 3, widthMm: 30, order: 1 },
];

vi.mock("@/lib/services", () => ({
  earthBarSizeService: { list: vi.fn(async () => sizes) },
}));

function renderView() {
  render(
    <LanguageProvider>
      <EarthBarCalculationView />
    </LanguageProvider>,
  );
}

describe("EarthBarCalculationView — stateless calculator (no 案件/save, like every other 電気技術計算 tool)", () => {
  it("renders directly with no 案件 selection gating", async () => {
    renderView();
    expect(await screen.findByText("入力条件")).toBeInTheDocument();
    expect(screen.queryByText("案件を選択してください")).toBeNull();
  });
});

describe("EarthBarCalculationView — never a fabricated OK/NG (spec #19, #26-28, #37)", () => {
  it("shows real geometry candidates all marked 要確認, never ok/caution/ng, and lets the user adopt one", async () => {
    const user = userEvent.setup();
    renderView();

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

    const faultInput = await screen.findByPlaceholderText("31.5");
    await user.type(faultInput, "31.5");
    const timeInput = screen.getByPlaceholderText("0.5");
    await user.type(timeInput, "0.5");

    await waitFor(() => {
      expect(screen.getByText(/短絡耐量.*k値が未確認/)).toBeInTheDocument();
    });
    const table = await screen.findByRole("table");
    expect(within(table).queryByText("OK")).toBeNull();
  });
});

describe("EarthBarCalculationView — 手動検証 what-if (e.g. 3×25/3×30/3×40)", () => {
  it("shows real total area for a manual configuration, always 要確認", async () => {
    const user = userEvent.setup();
    renderView();

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
