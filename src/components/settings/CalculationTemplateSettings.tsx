"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationDefinitions } from "@/lib/mock/calculationDefinitions";
import { calculationTemplateService } from "@/lib/services";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { CalculationTemplate } from "@/lib/types";

interface CalculationTemplateSettingsProps {
  /** Which calculation keys to show a row for. Defaults to every registered calculation. */
  keys?: string[];
}

/**
 * Excel output template upload for `calculationDefinitions`-driven modules
 * (換気計算/耐震計算, and any future generic 計算 module). Split out of the
 * old single combined table on /settings so each calculation's own page can
 * show just its own row instead of one page listing every calculation in
 * the app.
 */
export function CalculationTemplateSettings({
  keys,
}: CalculationTemplateSettingsProps) {
  const { t, locale } = useTranslation();
  const [templates, setTemplates] = useState<
    Record<string, CalculationTemplate>
  >({});
  const { message, show } = useMockFeedback();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    calculationTemplateService.list().then((list) => {
      setTemplates(
        Object.fromEntries(list.map((tpl) => [tpl.calculationKey, tpl])),
      );
    });
  }, []);

  async function handleUpload(key: string, file: File) {
    const tpl = await calculationTemplateService.upload(key, file.name);
    setTemplates((prev) => ({ ...prev, [key]: tpl }));
    show(t("common.fileUploaded", { fileName: file.name }));
  }

  const definitions = keys
    ? calculationDefinitions.filter((def) => keys.includes(def.key))
    : calculationDefinitions;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {t("settings.templateDescription")}
      </p>
      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>{t("common.name")}</th>
              <th>{t("settings.templateSection")}</th>
              <th style={{ width: "160px" }} />
            </tr>
          </thead>
          <tbody>
            {definitions.map((def) => {
              const tpl = templates[def.key];
              return (
                <tr key={def.id}>
                  <td>
                    {locale === "vi" && def.nameVi ? def.nameVi : def.name}
                  </td>
                  <td className={tpl ? "text-foreground" : "text-muted-2"}>
                    {tpl ? tpl.fileName : t("settings.templateEmpty")}
                  </td>
                  <td>
                    <button
                      onClick={() => fileInputs.current[def.key]?.click()}
                      className="btn-secondary"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {t("settings.templateUpload")}
                    </button>
                    <input
                      ref={(el) => {
                        fileInputs.current[def.key] = el;
                      }}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(def.key, file);
                        e.target.value = "";
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
