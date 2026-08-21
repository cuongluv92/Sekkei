"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationDefinitions } from "@/lib/mock/calculationDefinitions";
import { calculationTemplateService } from "@/lib/services";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { PageHeader } from "@/components/common/PageHeader";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { CalculationTemplate } from "@/lib/types";

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const [templates, setTemplates] = useState<Record<string, CalculationTemplate>>({});
  const { message, show } = useMockFeedback();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    calculationTemplateService.list().then((list) => {
      setTemplates(Object.fromEntries(list.map((tpl) => [tpl.calculationKey, tpl])));
    });
  }, []);

  async function handleUpload(key: string, file: File) {
    const tpl = await calculationTemplateService.upload(key, file.name);
    setTemplates((prev) => ({ ...prev, [key]: tpl }));
    show(`${file.name} を登録しました`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} />

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.languageSection")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">{t("settings.languageDescription")}</p>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.calcSection")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">{t("settings.calcDescription")}</p>
          <div className="data-table-wrap">
            <table className="data-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th style={{ width: "130px" }}>{t("common.status")}</th>
                  <th style={{ width: "120px" }} />
                </tr>
              </thead>
              <tbody>
                {calculationDefinitions.map((def) => (
                  <tr key={def.id}>
                    <td>{locale === "vi" && def.nameVi ? def.nameVi : def.name}</td>
                    <td>
                      <span className="badge-warning">{t("settings.formulaEmpty")}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => show(t("common.notImplemented"))}
                        className="btn-ghost"
                      >
                        {t("settings.configureButton")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.templateSection")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">{t("settings.templateDescription")}</p>
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
                {calculationDefinitions.map((def) => {
                  const tpl = templates[def.key];
                  return (
                    <tr key={def.id}>
                      <td>{locale === "vi" && def.nameVi ? def.nameVi : def.name}</td>
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
        </div>
      </div>

      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
