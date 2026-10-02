"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { masterListService } from "@/lib/services/design";
import { useFloatingPopupPosition } from "@/lib/hooks/useFloatingPopupPosition";
import { useCloseOnOutsideClick } from "@/lib/hooks/useCloseOnOutsideClick";

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
  const popupRef = useRef<HTMLUListElement>(null);
  const position = useFloatingPopupPosition(open, containerRef);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    masterListService.listByKey(listKey).then((items) => setOptions(items.map((i) => i.value)));
  }, [listKey]);

  useCloseOnOutsideClick(open, [containerRef, popupRef], setOpen);

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
        className="field-input py-1.5 text-[13.5px]"
      />
      {open &&
        filtered.length > 0 &&
        position &&
        createPortal(
          <ul
            ref={popupRef}
            className="fixed z-50 max-h-40 min-w-[140px] overflow-y-auto rounded-md border border-border-strong bg-surface-2 shadow-lg"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[13.5px] text-foreground hover:bg-surface-hover"
                >
                  {opt === draft && <Check className="h-3 w-3 shrink-0 text-accent" />}
                  <span className="truncate">{opt}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
