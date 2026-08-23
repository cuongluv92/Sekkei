"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { navItems } from "@/lib/nav";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { PageHeader } from "@/components/common/PageHeader";

/**
 * Every feature-specific settings that used to live here (設計管理設定,
 * 部品設定, 選定設定, 重量/母線銅帯/接地線/アースバー size settings, テンプレート管理
 * etc.) has moved to a "設定" button inside the screen it actually
 * configures — see each page's own PageHeader actions. This page keeps only
 * settings that apply to the whole app, not one feature: 言語設定 and
 * バックアップ. The quick-link panel below just helps people who are used to
 * finding everything here find the new location.
 */
const QUICK_LINK_KEYS = [
  "designManagement",
  "partData",
  "partDrawing",
  "catalog",
  "partAssembly",
  "selection",
  "weightCalc",
  "ventilationCalc",
  "seismicCalc",
] as const;

export default function SettingsPage() {
  const { t } = useTranslation();
  const quickLinks = QUICK_LINK_KEYS.map((key) =>
    navItems.find((item) => item.key === key),
  ).filter((item) => item !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.languageSection")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">
            {t("settings.languageDescription")}
          </p>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("backupSettings.title")}</span>
        </div>
        <div className="panel-body">
          <BackupSettings />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.quickLinksTitle")}</span>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="btn-secondary justify-start"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`nav.${item.key}`)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
