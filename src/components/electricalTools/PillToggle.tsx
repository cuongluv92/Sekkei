"use client";

interface PillOption<V extends string> {
  value: V;
  label: string;
}

interface PillToggleProps<V extends string> {
  label: string;
  options: readonly PillOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** Shared small segmented-control look used for every mode/sub-tool switch across 電気技術計算 (相/結線/方式/用途/サブツール選択など) — one visual language instead of each calculator inventing its own toggle. */
export function PillToggle<V extends string>({
  label,
  options,
  value,
  onChange,
}: PillToggleProps<V>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="field-label !mb-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            opt.value === value
              ? "rounded-full border border-accent bg-accent/15 px-3 py-1 text-[12.5px] font-bold text-accent"
              : "rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-[12.5px] font-semibold text-muted hover:text-foreground"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
