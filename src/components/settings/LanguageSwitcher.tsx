"use client";

import { useTranslation, type Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "vi", label: "Tiếng Việt" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="inline-flex rounded-md border border-border-strong bg-surface p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
            locale === opt.value
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
