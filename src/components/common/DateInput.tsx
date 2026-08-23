"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DateInputProps {
  /** ISO "YYYY-MM-DD", or null/"" for empty — same contract as the native `<input type="date">` this replaces. */
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function formatJa(iso: string | null): string {
  if (!iso) return "";
  const parts = iso.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${y}/${pad2(m)}/${pad2(d)}`;
}

function parseIso(
  iso: string | null,
): { year: number; month0: number; day: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month0: m - 1, day: d };
}

/**
 * Native `<input type="date">` renders its calendar popup, placeholder, and
 * weekday/month names in the browser's own OS/UI locale — not the page's
 * `lang` attribute, so it can't be forced to Japanese from HTML/JS alone
 * (spec follow-up: dates must always display Japanese-style YYYY/MM/DD
 * regardless of host locale). This replaces it with a fully custom popup so
 * every label is hard-coded Japanese, independent of the viewer's browser.
 */
export function DateInput({ value, onChange, className }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const parsed = parseIso(value);
    const now = new Date();
    return parsed ?? { year: now.getFullYear(), month0: now.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function openPicker() {
    setView(parseIso(value) ?? view);
    setOpen((o) => !o);
  }

  function shiftMonth(delta: number) {
    setView(({ year, month0 }) => {
      const total = year * 12 + month0 + delta;
      return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 };
    });
  }

  const firstWeekday = new Date(view.year, view.month0, 1).getDay();
  const daysInMonth = new Date(view.year, view.month0 + 1, 0).getDate();
  const selected = parseIso(value);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={`${className ?? "field-input"} text-left`}
      >
        {value ? (
          <span className="font-mono tabular-nums">{formatJa(value)}</span>
        ) : (
          <span className="text-muted-2">YYYY/MM/DD</span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-border-strong bg-surface-2 p-2.5 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded p-1 text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[13px] font-bold tabular-nums text-foreground">
              {view.year}年{view.month0 + 1}月
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded p-1 text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-2">
            {WEEKDAYS_JA.map((w) => (
              <span key={w} className="py-0.5">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[12px]">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const isSelected =
                selected?.year === view.year &&
                selected.month0 === view.month0 &&
                selected.day === d;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    onChange(toIso(view.year, view.month0, d));
                    setOpen(false);
                  }}
                  className={
                    isSelected
                      ? "rounded bg-accent py-1 font-bold text-white"
                      : "rounded py-1 text-foreground hover:bg-surface-hover"
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="text-[11px] text-muted-2 hover:text-foreground"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(toIso(now.getFullYear(), now.getMonth(), now.getDate()));
                setView({ year: now.getFullYear(), month0: now.getMonth() });
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-accent hover:underline"
            >
              今日
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
