"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable + creatable text combobox: pick an existing option or type a
 * value that isn't in the list yet — the parent decides what "new value
 * committed" means (e.g. creating a manufacturer record), this component
 * only reports the committed string. Used where existing-vs-new must both
 * be allowed (Import's メーカー/分類 fallback); plain search filters that
 * should only ever match existing values use a normal `<select>` instead.
 */
export function Combobox({ options, value, onChange, placeholder, className }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(draft.trim().toLowerCase()));

  function commit(finalValue: string) {
    const trimmed = finalValue.trim();
    setDraft(trimmed);
    onChange(trimmed);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
        }}
        className={className ?? "field-input"}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-40 w-full min-w-[160px] overflow-y-auto rounded-md border border-border-strong bg-surface-2 shadow-lg">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(opt)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-surface-hover"
              >
                {opt === draft && <Check className="h-3 w-3 shrink-0 text-accent" />}
                <span className="truncate">{opt}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
