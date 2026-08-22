import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToast } from "./useToast";

describe("useToast — success/error feedback on add (spec #14, #17)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a success toast after a successful add", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();

    act(() => result.current.showToast("NF250-CV を部品リストに追加しました"));

    expect(result.current.toast).toMatchObject({
      message: "NF250-CV を部品リストに追加しました",
      variant: "success",
    });
  });

  it("shows an error toast after a failed add", () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast("部品の追加に失敗しました", "error"));

    expect(result.current.toast).toMatchObject({
      message: "部品の追加に失敗しました",
      variant: "error",
    });
  });

  it("auto-dismisses after the timeout", () => {
    const { result } = renderHook(() => useToast(1800));

    act(() => result.current.showToast("added"));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(1800));
    expect(result.current.toast).toBeNull();
  });

  it("a new toast replaces the pending dismiss timer instead of both disappearing early", () => {
    const { result } = renderHook(() => useToast(1800));

    act(() => result.current.showToast("first"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.showToast("second"));
    act(() => vi.advanceTimersByTime(1000));

    // second toast should still be visible (its own 1800ms hasn't elapsed yet)
    expect(result.current.toast?.message).toBe("second");
  });
});
