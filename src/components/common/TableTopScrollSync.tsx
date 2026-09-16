"use client";

import { useEffect } from "react";

const WRAP_SELECTOR = ".data-table-wrap";

interface TrackedWrap {
  update: () => void;
  cleanup: () => void;
}

/**
 * 横スクロールが必要な表は、いちばん下までスクロールしないと横スクロール
 * バーが見えず操作しづらい — アプリ全体の`.data-table-wrap`(表を横スクロール
 * させる共通クラス、個々の表コンポーネントは触らずここ一箇所で対応)の直上
 * に、内容を複製した薄いスクロールバーを自動挿入し、上端でも左右にスクロール
 * できるようにする。ルートレイアウトに一度だけマウントする。
 */
export function TableTopScrollSync() {
  useEffect(() => {
    const tracked = new Map<HTMLElement, TrackedWrap>();
    let rafId: number | null = null;

    function setup(wrap: HTMLElement): TrackedWrap {
      const container = document.createElement("div");
      container.className = "table-top-scroll-container";

      const topBar = document.createElement("div");
      topBar.className = "table-top-scroll";
      topBar.style.display = "none";
      const spacer = document.createElement("div");
      spacer.style.height = "1px";
      topBar.appendChild(spacer);

      wrap.parentElement?.insertBefore(container, wrap);
      container.appendChild(topBar);
      container.appendChild(wrap);

      let syncing = false;
      const onTopScroll = () => {
        if (syncing) return;
        syncing = true;
        wrap.scrollLeft = topBar.scrollLeft;
        syncing = false;
      };
      const onWrapScroll = () => {
        if (syncing) return;
        syncing = true;
        topBar.scrollLeft = wrap.scrollLeft;
        syncing = false;
      };
      topBar.addEventListener("scroll", onTopScroll);
      wrap.addEventListener("scroll", onWrapScroll);

      const update = () => {
        const overflowing = wrap.scrollWidth > wrap.clientWidth + 1;
        topBar.style.display = overflowing ? "block" : "none";
        spacer.style.width = `${wrap.scrollWidth}px`;
      };

      const cleanup = () => {
        topBar.removeEventListener("scroll", onTopScroll);
        wrap.removeEventListener("scroll", onWrapScroll);
        container.parentElement?.insertBefore(wrap, container);
        container.remove();
      };

      return { update, cleanup };
    }

    function scan() {
      rafId = null;
      const seen = new Set<HTMLElement>();
      document.querySelectorAll<HTMLElement>(WRAP_SELECTOR).forEach((wrap) => {
        seen.add(wrap);
        let entry = tracked.get(wrap);
        if (!entry) {
          entry = setup(wrap);
          tracked.set(wrap, entry);
        }
        entry.update();
      });
      for (const [wrap, entry] of tracked) {
        if (!seen.has(wrap) || !wrap.isConnected) {
          entry.cleanup();
          tracked.delete(wrap);
        }
      }
    }

    function scheduleScan() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(scan);
    }

    scheduleScan();

    const mutationObserver = new MutationObserver(scheduleScan);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", scheduleScan);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleScan);
      tracked.forEach((entry) => entry.cleanup());
      tracked.clear();
    };
  }, []);

  return null;
}
