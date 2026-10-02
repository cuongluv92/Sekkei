"use client";

import { useEffect, useState, type RefObject } from "react";

export interface FloatingPopupPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * 横スクロールする表(.data-table-wrap/.table-scroll-wrap)などoverflow:
 * auto/hiddenな祖先の中に置かれたドロップダウン/カレンダー/候補リストは、
 * position: absoluteのままだと祖先の枠で途中から切り取られてしまう —
 * anchorRefの実際の画面上の位置を測定し、呼び出し元がdocument.bodyへ
 * ポータル表示する際にposition: fixedでそのまま使える座標を返す。どの
 * 祖先のoverflow/スクロールにも影響されず常に手前に浮かせられる。open中
 * はスクロール(キャプチャフェーズ、ネストしたスクロールコンテナの操作も
 * 含む)とウィンドウリサイズのたびに再計算する。
 */
export function useFloatingPopupPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  heightEstimate = 160,
): FloatingPopupPosition | null {
  const [position, setPosition] = useState<FloatingPopupPosition | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const MARGIN = 8;
    function update() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      let left = rect.left;
      if (left + rect.width > window.innerWidth - MARGIN) {
        left = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
      }
      const fitsBelow = rect.bottom + heightEstimate <= window.innerHeight - MARGIN;
      const top = fitsBelow
        ? rect.bottom + 4
        : Math.max(MARGIN, rect.top - heightEstimate - 4);
      setPosition({ top, left, width: rect.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchorRefはuseRefが返す安定した参照オブジェクトなので依存配列に含める必要はない
  }, [open, heightEstimate]);

  return position;
}
