import { describe, it, expect, afterEach } from "vitest";
import { useRef } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import { useFloatingPopupPosition } from "./useFloatingPopupPosition";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

afterEach(() => {
  cleanup();
  setViewport(1024, 768);
});

function Harness({ open, heightEstimate }: { open: boolean; heightEstimate?: number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPopupPosition(open, anchorRef, heightEstimate);
  return (
    <>
      <div ref={anchorRef} data-testid="anchor" />
      <div data-testid="result">{position ? JSON.stringify(position) : "null"}</div>
    </>
  );
}

// jsdomはレイアウトを計算しないため getBoundingClientRect は常にゼロ矩形
// を返す — DateInput/SpecComboboxのテストと同じく、実ブラウザの測定結果を
// Object.definePropertyで差し替えて検証する。
function mockAnchorRect(container: HTMLElement, rect: Partial<DOMRect>) {
  const anchor = container.querySelector('[data-testid="anchor"]') as HTMLElement;
  anchor.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON() {},
    ...rect,
  });
  return anchor;
}

describe("useFloatingPopupPosition", () => {
  it("returns null while closed", () => {
    const { getByTestId } = render(<Harness open={false} />);
    expect(getByTestId("result").textContent).toBe("null");
  });

  it("computes a position anchored just below the element once open, matching its width", async () => {
    setViewport(1024, 768);
    const { container, rerender, getByTestId } = render(<Harness open={false} />);
    mockAnchorRect(container, { top: 100, left: 50, bottom: 130, width: 120, height: 30 });
    rerender(<Harness open={true} />);

    await waitFor(() => {
      expect(getByTestId("result").textContent).not.toBe("null");
    });
    const position = JSON.parse(getByTestId("result").textContent!);
    expect(position).toEqual({ top: 134, left: 50, width: 120 });
  });

  it("flips above the anchor when there isn't enough room below in the viewport", async () => {
    setViewport(1024, 200);
    const { container, rerender, getByTestId } = render(<Harness open={false} heightEstimate={300} />);
    mockAnchorRect(container, { top: 150, left: 50, bottom: 180, width: 120, height: 30 });
    rerender(<Harness open={true} heightEstimate={300} />);

    await waitFor(() => {
      expect(getByTestId("result").textContent).not.toBe("null");
    });
    const position = JSON.parse(getByTestId("result").textContent!);
    // 300pxの見積り高さは下(bottom=180)にも上(top=150)にも収まらないため、
    // viewport上端から8pxのマージンにクランプされる。
    expect(position.top).toBe(8);
  });

  it("clamps horizontally within the viewport when the anchor sits near the right edge", async () => {
    setViewport(400, 768);
    const { container, rerender, getByTestId } = render(<Harness open={false} />);
    mockAnchorRect(container, { top: 100, left: 380, bottom: 130, width: 120, height: 30 });
    rerender(<Harness open={true} />);

    await waitFor(() => {
      expect(getByTestId("result").textContent).not.toBe("null");
    });
    const position = JSON.parse(getByTestId("result").textContent!);
    // 400 - 120(width) - 8(margin) = 272
    expect(position.left).toBe(272);
  });
});
