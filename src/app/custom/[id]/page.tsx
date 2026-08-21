"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useNavSettings } from "@/lib/store/NavSettingsProvider";
import { PageHeader } from "@/components/common/PageHeader";

/**
 * Landing page for user-created sidebar shortcuts (設定 > メニュー管理). These
 * items have no real feature behind them yet — this placeholder exists so
 * adding a menu entry never 404s, while making clear it still needs an
 * actual page built for it.
 */
export default function CustomNavPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { allEntries } = useNavSettings();
  const entry = allEntries.find((e) => e.id === id);
  const Icon = entry?.Icon;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={entry?.label ?? id} />
      <div className="panel">
        <div className="panel-body flex flex-col items-center gap-3 py-12 text-center">
          {Icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-strong bg-surface-2 text-muted">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <p className="max-w-sm text-[12.5px] text-muted">{t("customPage.body")}</p>
        </div>
      </div>
    </div>
  );
}
