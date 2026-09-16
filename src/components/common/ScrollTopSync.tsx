"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

interface ScrollTopSyncProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * 横スクロールが必要な表(`.data-table-wrap`/`.table-scroll-wrap`など、この
 * ラッパーに渡すclassNameで指定)は、いちばん下までスクロールしないと横
 * スクロールバーが見えず操作しづらい — このラッパーの直前に内容を複製した
 * 薄いスクロールバーを描画し、上端でも左右にスクロールできるようにする。
 *
 * SSR/ハイドレーション時は必ず非表示(幅0)で描画し、実際の有無・幅は
 * マウント後の効果でだけ測定・反映する — サーバーとクライアントの初期HTML
 * が常に一致するため、ハイドレーション不整合は起きない。以前試した
 * 「後から外部スクリプトでDOMへスクロールバーを挿入する」方式は、Next.js
 * のストリーミングSSRでこの表のSuspense境界が遅れてハイドレートした際に
 * 「サーバーの描画結果と一致しない」エラーになることが分かったため、
 * ラップ本体と同じReactツリーの一部として描画する方式に直した。
 */
export const ScrollTopSync = forwardRef<HTMLDivElement, ScrollTopSyncProps>(
  function ScrollTopSync({ children, className, style, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);
    const topRef = useRef<HTMLDivElement>(null);
    const [overflowing, setOverflowing] = useState(false);
    const [contentWidth, setContentWidth] = useState(0);

    // 表の列幅はここで扱うすべての表(table-layout: fixedと明示的な列幅)で
    // データ到着前から確定しているため、内容自体の変化ではなく主に外側の
    // 表示幅(サイドバー開閉やウィンドウ幅)の変化だけを見ればよい —
    // ResizeObserverはwrap自身の実測サイズが変わるたびに再計算する。
    useEffect(() => {
      const wrap = innerRef.current;
      if (!wrap) return;
      const update = () => {
        setOverflowing(wrap.scrollWidth > wrap.clientWidth + 1);
        setContentWidth(wrap.scrollWidth);
      };
      update();
      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(wrap);
      return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
      const wrap = innerRef.current;
      const top = topRef.current;
      if (!wrap || !top) return;
      let syncing = false;
      const onTopScroll = () => {
        if (syncing) return;
        syncing = true;
        wrap.scrollLeft = top.scrollLeft;
        syncing = false;
      };
      const onWrapScroll = () => {
        if (syncing) return;
        syncing = true;
        top.scrollLeft = wrap.scrollLeft;
        syncing = false;
      };
      top.addEventListener("scroll", onTopScroll);
      wrap.addEventListener("scroll", onWrapScroll);
      return () => {
        top.removeEventListener("scroll", onTopScroll);
        wrap.removeEventListener("scroll", onWrapScroll);
      };
    }, []);

    return (
      <>
        <div
          ref={topRef}
          className="table-top-scroll"
          style={{ display: overflowing ? "block" : "none" }}
        >
          <div style={{ height: 1, width: contentWidth }} />
        </div>
        <div ref={innerRef} className={className} style={style} {...rest}>
          {children}
        </div>
      </>
    );
  },
);
