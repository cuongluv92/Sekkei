import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateInput } from "./DateInput";

/**
 * Regression coverage for a real bug: making the field free-text-typeable
 * (for "9月中旬" style entries) meant every blur committed the *displayed*
 * "YYYY/MM/DD" text back through onChange — silently corrupting a clean ISO
 * value into a slash-format string on every focus/blur, even with no edit,
 * which then broke cascade/coloring/print formatting downstream (all of
 * which require dash-separated ISO).
 */
describe("DateInput", () => {
  it("does not call onChange on blur when the value wasn't edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput value="2026-09-10" onChange={onChange} />);

    const input = screen.getByDisplayValue("2026/09/10");
    await user.click(input);
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("normalizes a typed slash-format date back to ISO", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput value={null} onChange={onChange} />);

    const input = screen.getByPlaceholderText("YYYY/MM/DD");
    await user.type(input, "2026/9/5");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("2026-09-05");
  });

  it("keeps free text (non-date) as-is", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput value={null} onChange={onChange} />);

    const input = screen.getByPlaceholderText("YYYY/MM/DD");
    await user.type(input, "9月中旬");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("9月中旬");
  });

  it("clears the value when the text is emptied", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput value="2026-09-10" onChange={onChange} />);

    const input = screen.getByDisplayValue("2026/09/10");
    await user.clear(input);
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Regression: inside a horizontally-scrolling table wrap
  // (.data-table-wrap/.table-scroll-wrap use overflow-x: auto), the popup
  // used to be position: absolute relative to the field itself, so an
  // ancestor's overflow clipped it to a thin sliver — only the top edge of
  // the calendar was visible, with no way to actually pick a day.
  it("renders the calendar popup outside any clipping ancestor (overflow-x: auto container)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <div style={{ overflow: "hidden", width: 100, height: 50 }} data-testid="clipping-ancestor">
        <DateInput value="2026-09-10" onChange={onChange} />
      </div>,
    );

    await user.click(screen.getByTitle("カレンダーから選択"));

    const popupHeading = await screen.findByText("2026年9月");
    const clippingAncestor = container.querySelector('[data-testid="clipping-ancestor"]');
    expect(clippingAncestor?.contains(popupHeading)).toBe(false);
  });
});
