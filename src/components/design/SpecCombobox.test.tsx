import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpecCombobox } from "./SpecCombobox";

vi.mock("@/lib/services/design", () => ({
  masterListService: {
    listByKey: vi.fn(async () => [{ id: "1", key: "electricalMethod", value: "三相3線式" }]),
    add: vi.fn(),
  },
}));

// Regression: this combobox backs every 盤①〜⑦(製作仕様) cell inside the
// horizontally-scrolling panel table (.data-table-wrap), e.g. 電気方式.
// The dropdown used to be position: absolute relative to the cell itself,
// so the table's overflow-x: auto clipped most of the option list — only a
// sliver was visible with no way to actually pick an option.
describe("SpecCombobox", () => {
  it("renders the option list outside any clipping ancestor (overflow-x: auto container)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <div style={{ overflow: "hidden", width: 100, height: 40 }} data-testid="clipping-ancestor">
        <SpecCombobox listKey="electricalMethod" value="" onChange={onChange} />
      </div>,
    );

    const input = screen.getByRole("textbox");
    await user.click(input);

    const option = await screen.findByText("三相3線式");
    const clippingAncestor = container.querySelector('[data-testid="clipping-ancestor"]');
    expect(clippingAncestor?.contains(option)).toBe(false);

    await user.click(option);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("三相3線式"));
  });
});
