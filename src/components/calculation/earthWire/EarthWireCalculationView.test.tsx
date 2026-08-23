import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { EarthWireCalculationView } from "./EarthWireCalculationView";
import type { EarthWireSize } from "@/lib/types";

// PageHeader's own "← 戻る" button calls useRouter().back() — this view no
// longer uses next/navigation itself (no more 案件/URL-driven state), but
// PageHeader still needs an App Router context to render at all.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const sizes: EarthWireSize[] = [
  { id: "e1", areaMm2: 14, order: 0 },
  { id: "e2", areaMm2: 22, order: 1 },
  { id: "e3", areaMm2: 38, order: 2 },
];

vi.mock("@/lib/services", () => ({
  earthWireSizeService: { list: vi.fn(async () => sizes) },
}));

function renderView() {
  render(
    <LanguageProvider>
      <EarthWireCalculationView />
    </LanguageProvider>,
  );
}

describe("EarthWireCalculationView — stateless calculator (no 案件/save, like every other 電気技術計算 tool)", () => {
  it("renders directly with no 案件 selection gating", async () => {
    renderView();
    expect(await screen.findByPlaceholderText("400")).toBeInTheDocument();
    expect(screen.queryByText("案件を選択してください")).toBeNull();
  });
});

describe("EarthWireCalculationView — C種/D種 auto candidate search + adopt (spec #23, #24)", () => {
  it("computes 0.052×In and lets the user adopt a candidate for D種接地工事", async () => {
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "D");
    const input = await screen.findByPlaceholderText("400");
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

describe("EarthWireCalculationView — A種/B種 never reuse the C/D formula", () => {
  it("shows the unsupported message and no fabricated candidates for A種接地工事", async () => {
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "A");
    const input = await screen.findByPlaceholderText("400");
    await user.type(input, "400");

    await waitFor(() => {
      expect(
        screen.getByText(/A種・B種接地工事の接地線太さ選定には対応していません/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("EarthWireCalculationView — 手動検証 what-if (spec #17, #30)", () => {
  it("shows real margin/judgment when a master size is picked against a required area", async () => {
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(screen.getByLabelText("接地工事種別"), "C");
    const input = await screen.findByPlaceholderText("400");
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
