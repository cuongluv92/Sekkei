import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdomはResizeObserverを実装していない(レイアウト計算自体を行わないため
// scrollWidth/clientWidth同様サイズは常に0)。ScrollTopSyncなどサイズ監視を
// 使うコンポーネントがマウントされるだけでテストが落ちないよう、最小限の
// no-opスタブを用意する。
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
