"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { partTemplateService } from "@/lib/services";
import { getPublicUrl } from "@/lib/supabase/storage";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { PartTemplate, PartTemplateKind } from "@/lib/types";

const PART_TEMPLATE_KINDS: { kind: PartTemplateKind; accept: string }[] = [
  { kind: "excel", accept: ".xlsx,.xls" },
  { kind: "dwg", accept: ".dwg" },
];

/**
 * Excel/DWG output template upload for 部品製作 — moved off the old combined
 * /settings page so it lives with the feature it actually configures.
 */
export function PartTemplateSettings() {
  const { t } = useTranslation();
  const [partTemplates, setPartTemplates] = useState<
    Record<string, PartTemplate>
  >({});
  const { message, show } = useMockFeedback();
  const partFileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    partTemplateService.list().then((list) => {
      setPartTemplates(Object.fromEntries(list.map((tpl) => [tpl.kind, tpl])));
    });
  }, []);

  async function handlePartUpload(kind: PartTemplateKind, file: File) {
    const tpl = await partTemplateService.upload(kind, file);
    setPartTemplates((prev) => ({ ...prev, [kind]: tpl }));
    show(t("common.fileUploaded", { fileName: file.name }));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {t("settings.partTemplateDescription")}
      </p>
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
                  <td>
                    {kind === "excel"
                      ? t("settings.kindExcel")
                      : t("settings.kindDwg")}
                  </td>
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
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
