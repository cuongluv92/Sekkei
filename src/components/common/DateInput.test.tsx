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
});
