"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { masterListService } from "@/lib/services/design";

interface SpecComboboxProps {
  /** Master list key (spec field key, or any other master-list-backed field such as requestType/panelStructure). */
  listKey: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Creatable/searchable combobox backing every 仕様Ⅰ・Ⅱ・Ⅲ cell. Options come
 * from `masterListService` (never hard-coded) — typing a value that isn't in
 * the list yet and committing it (Enter, blur, or picking it) saves it to
 * the master list so it's a normal option next time.
 */
export function SpecCombobox({ listKey, value, onChange }: SpecComboboxProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    masterListService.listByKey(listKey).then((items) => setOptions(items.map((i) => i.value)));
  }, [listKey]);

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

  async function commit(finalValue: string) {
    const trimmed = finalValue.trim();
    onChange(trimmed);
    setOpen(false);
    if (trimmed && !options.includes(trimmed)) {
      await masterListService.add(listKey, trimmed);
      setOptions((prev) => [...prev, trimmed]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={draft}
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
        className="field-input py-1 text-[12px]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-40 w-full min-w-[140px] overflow-y-auto rounded-md border border-border-strong bg-surface-2 shadow-lg">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(opt)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-hover"
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
