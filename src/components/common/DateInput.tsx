"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isIsoDate, JUN_BUCKETS, junDateRange, type JunBucket } from "@/lib/utils/schedule";

interface DateInputProps {
  /**
   * ISO "YYYY-MM-DD" for an exact date, null/"" for empty, or free text
   * (e.g. "9月中旬", "下旬") when the exact day isn't known yet — the field
   * is typeable directly, the calendar button is only for picking an exact
   * day.
   */
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  /**
   * Shows 初/中/下 quick-pick buttons for the currently-viewed month, so a
   * "9月中" style entry doesn't require finding the exact day. `"start"`
   * picks the bucket's first day, `"end"` its last day — matching whichever
   * end of a date-range field this input represents.
   */
  quickJun?: "start" | "end";
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

const DATE_LIKE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;

/**
 * Typed text that looks like a date (either separator, single-digit month/
 * day allowed) is normalized back to canonical ISO "YYYY-MM-DD" so it keeps
 * round-tripping through cascade/coloring/print logic — otherwise the raw
 * text is kept as-is (free text, e.g. "9月中旬").
 */
function normalizeTyped(raw: string): string {
  const m = raw.match(DATE_LIKE);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Native `<input type="date">` renders its calendar popup, placeholder, and
 * weekday/month names in the browser's own OS/UI locale — not the page's
 * `lang` attribute, so it can't be forced to Japanese from HTML/JS alone
 * (spec follow-up: dates must always display Japanese-style YYYY/MM/DD
 * regardless of host locale). This replaces it with a fully custom popup so
 * every label is hard-coded Japanese, independent of the viewer's browser.
 */
export function DateInput({ value, onChange, className, quickJun }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => (isIsoDate(value) ? formatJa(value) : (value ?? "")));
  const [view, setView] = useState(() => {
    const parsed = parseIso(value);
    const now = new Date();
    return parsed ?? { year: now.getFullYear(), month0: now.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(isIsoDate(value) ? formatJa(value) : (value ?? ""));
  }, [value]);

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

  function commitText() {
    const trimmed = text.trim();
    const normalized = trimmed ? normalizeTyped(trimmed) : null;
    if (normalized === (value ?? null)) return; // 未編集 (blurしただけ) なら何もしない — 表示用フォーマットで上書きしてしまうのを防ぐ
    onChange(normalized);
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
    <div ref={rootRef} className="relative flex items-stretch gap-1">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitText();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="YYYY/MM/DD"
        className={`${className ?? "field-input"} font-mono tabular-nums`}
      />
      <button
        type="button"
        onClick={openPicker}
        title="カレンダーから選択"
        className="flex shrink-0 items-center justify-center rounded-md border border-border-strong px-2 text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <CalendarDays className="h-3.5 w-3.5" />
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
          {quickJun && (
            <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
              <span className="text-[11px] text-muted-2">旬選択</span>
              {JUN_BUCKETS.map((bucket: JunBucket) => (
                <button
                  type="button"
                  key={bucket}
                  onClick={() => {
                    const range = junDateRange(view.year, view.month0 + 1, bucket);
                    onChange(quickJun === "start" ? range.start : range.end);
                    setOpen(false);
                  }}
                  className="rounded border border-border-strong px-1.5 py-0.5 text-[11px] font-semibold text-foreground hover:bg-surface-hover"
                >
                  {bucket}
                </button>
              ))}
            </div>
          )}
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
