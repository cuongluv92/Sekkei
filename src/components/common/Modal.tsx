"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

/** Minimal centered overlay dialog, used for compact inline forms (e.g. 新規案件) that don't warrant a full page. */
export function Modal({ title, onClose, children, widthClassName = "max-w-lg" }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 sm:items-center">
      <button
        aria-label="close"
        onClick={onClose}
        className="fixed inset-0 -z-10 cursor-default"
        tabIndex={-1}
      />
      <div className={`w-full ${widthClassName} rounded-lg border border-border-strong bg-surface shadow-2xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-[16px] font-bold text-foreground">{title}</span>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
