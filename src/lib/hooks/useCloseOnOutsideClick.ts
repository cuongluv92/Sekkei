"use client";

import { useEffect, type RefObject } from "react";

/**
 * ポップアップをdocument.bodyへポータル表示する場合、ポップアップ自体は
 * もう元の入力欄のDOM上の子孫ではなくなるため、「外側クリックで閉じる」
 * 判定は入力欄側のrefだけでなくポップアップ側のrefも含めて「どちらにも
 * 入っていなければ閉じる」としなければならない — ポップアップ内の候補を
 * クリックしただけで閉じてしまう不具合を防ぐ。
 */
export function useCloseOnOutsideClick(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refsの各要素はuseRefが返す安定した参照オブジェクト
  }, [open, setOpen]);
}
