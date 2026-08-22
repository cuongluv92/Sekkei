import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { PartMasterSearch } from "./PartMasterSearch";
import type { SearchResultItem } from "@/lib/types";

const ITEMS: SearchResultItem[] = [
  {
    id: "1",
    source: "part-data",
    symbol: "MCCB-1",
    category: "配線用遮断器",
    manufacturerId: "",
    model: "NF250-CV",
    specification: "3P 250AF／125AT 25kA",
    sourceLabel: "部品データ",
    files: [],
  },
];

function renderSearch(onPick = vi.fn()) {
  render(
    <LanguageProvider>
      <PartMasterSearch items={ITEMS} onDownload={vi.fn()} onPick={onPick} />
    </LanguageProvider>,
  );
  return onPick;
}

describe("PartMasterSearch — single click selects, double click adds (spec #13)", () => {
  it("single click never calls onPick", async () => {
    const user = userEvent.setup();
    const onPick = renderSearch();

    // Type into 品名・型式 to reveal results (the panel is hidden until a filter is set).
    await user.type(screen.getByPlaceholderText(/記号・品名・型式/), "NF250");
    const row = await screen.findByText("NF250-CV");

    await user.click(row);

    expect(onPick).not.toHaveBeenCalled();
  });

  it("double click calls onPick with the row's item", async () => {
    const user = userEvent.setup();
    const onPick = renderSearch();

    await user.type(screen.getByPlaceholderText(/記号・品名・型式/), "NF250");
    const row = await screen.findByText("NF250-CV");

    await user.dblClick(row);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", model: "NF250-CV" }),
    );
  });
});
