"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationDefinitions } from "@/lib/mock/calculationDefinitions";
import { calculationTemplateService, partTemplateService } from "@/lib/services";
import { getPublicUrl } from "@/lib/supabase/storage";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { MasterListEditor } from "@/components/design/MasterListEditor";
import { ScheduleColorSettings } from "@/components/design/ScheduleColorSettings";
import { ManufacturerSettings } from "@/components/settings/ManufacturerSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { SelectionRuleSettings } from "@/components/settings/SelectionRuleSettings";
import { TemplateManagementSettings } from "@/components/settings/TemplateManagementSettings";
import { WeightMaterialSettings } from "@/components/settings/WeightMaterialSettings";
import { PageHeader } from "@/components/common/PageHeader";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { CalculationTemplate, PartTemplate, PartTemplateKind } from "@/lib/types";

const PART_TEMPLATE_KINDS: { kind: PartTemplateKind; accept: string }[] = [
  { kind: "excel", accept: ".xlsx,.xls" },
  { kind: "dwg", accept: ".dwg" },
];

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const [templates, setTemplates] = useState<Record<string, CalculationTemplate>>({});
  const [partTemplates, setPartTemplates] = useState<Record<string, PartTemplate>>({});
  const { message, show } = useMockFeedback();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const partFileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    calculationTemplateService.list().then((list) => {
      setTemplates(Object.fromEntries(list.map((tpl) => [tpl.calculationKey, tpl])));
    });
    partTemplateService.list().then((list) => {
      setPartTemplates(Object.fromEntries(list.map((tpl) => [tpl.kind, tpl])));
    });
  }, []);

  async function handleUpload(key: string, file: File) {
    const tpl = await calculationTemplateService.upload(key, file.name);
    setTemplates((prev) => ({ ...prev, [key]: tpl }));
    show(`${file.name} を登録しました`);
  }

  async function handlePartUpload(kind: PartTemplateKind, file: File) {
    const tpl = await partTemplateService.upload(kind, file);
    setPartTemplates((prev) => ({ ...prev, [kind]: tpl }));
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
          <span className="panel-title">{t("designSettings.title")}</span>
        </div>
        <div className="panel-body">
          <MasterListEditor />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("scheduleColorSettings.title")}</span>
        </div>
        <div className="panel-body">
          <ScheduleColorSettings />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("partSettings.title")}</span>
        </div>
        <div className="panel-body flex flex-col gap-5">
          <MasterListEditor keys={["category", "symbol"]} namespace="partSettings" />
          <div className="border-t border-border pt-4">
            <span className="mb-2 block text-[13px] font-bold text-foreground">
              {t("partSettings.manufacturers.title")}
            </span>
            <ManufacturerSettings />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("selectionSettings.title")}</span>
        </div>
        <div className="panel-body">
          <SelectionRuleSettings />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("weightMaterialSettings.title")}</span>
        </div>
        <div className="panel-body">
          <WeightMaterialSettings />
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
          <span className="panel-title">{t("settings.templateManagement.title")}</span>
        </div>
        <div className="panel-body">
          <TemplateManagementSettings />
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

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("settings.partTemplateSection")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">{t("settings.partTemplateDescription")}</p>
          <div className="data-table-wrap">
            <table className="data-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>{t("common.kind")}</th>
                  <th>{t("settings.templateSection")}</th>
                  <th style={{ width: "160px" }} />
                </tr>
              </thead>
              <tbody>
                {PART_TEMPLATE_KINDS.map(({ kind, accept }) => {
                  const tpl = partTemplates[kind];
                  return (
                    <tr key={kind}>
                      <td>{kind === "excel" ? t("settings.kindExcel") : t("settings.kindDwg")}</td>
                      <td className={tpl ? "text-foreground" : "text-muted-2"}>
                        {tpl ? (
                          <a
                            href={getPublicUrl(tpl.storagePath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            {tpl.fileName}
                          </a>
                        ) : (
                          t("settings.templateEmpty")
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => partFileInputs.current[kind]?.click()}
                          className="btn-secondary"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {t("settings.templateUpload")}
                        </button>
                        <input
                          ref={(el) => {
                            partFileInputs.current[kind] = el;
                          }}
                          type="file"
                          accept={accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePartUpload(kind, file);
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
