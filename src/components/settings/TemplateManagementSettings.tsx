"use client";

import { Download, History, Upload } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designTemplateService } from "@/lib/services/design";
import { getPublicUrl } from "@/lib/supabase/storage";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { DESIGN_TEMPLATE_KINDS, type DesignTemplateKind, type DesignTemplateVersion } from "@/lib/types/design";

const KIND_ACCEPT: Record<DesignTemplateKind, string> = {
  designRequestForm: ".xlsx",
  productionRequestForm: ".xlsx",
  drawingLedger: ".xlsx",
  designRequestIndexKeio: ".xlsx",
  designRequestIndexOther: ".xlsx",
  scheduleSheet: ".xlsx",
  costLaborSheet: ".xlsx",
  dwgTemplate: ".dwg",
};

/**
 * Every Excel/DWG template used by 設計管理's export buttons, managed here
 * instead of being bundled as a static file in the app. Uploading replaces
 * the active version (previous versions are kept, just deactivated, so a
 * bad upload can be rolled back without re-uploading the old file).
 */
export function TemplateManagementSettings() {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();
  const [active, setActive] = useState<Record<string, DesignTemplateVersion | null>>({});
  const [history, setHistory] = useState<Record<string, DesignTemplateVersion[]>>({});
  const [openHistory, setOpenHistory] = useState<DesignTemplateKind | null>(null);
  const [uploadingKind, setUploadingKind] = useState<DesignTemplateKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active_ = true;
    Promise.all(DESIGN_TEMPLATE_KINDS.map((kind) => designTemplateService.getActive(kind))).then((results) => {
      if (!active_) return;
      setActive(Object.fromEntries(DESIGN_TEMPLATE_KINDS.map((kind, i) => [kind, results[i]])));
    });
    return () => {
      active_ = false;
    };
  }, []);

  async function refreshHistory(kind: DesignTemplateKind) {
    const list = await designTemplateService.listByKind(kind);
    setHistory((prev) => ({ ...prev, [kind]: list }));
  }

  async function handleUpload(kind: DesignTemplateKind, file: File) {
    setError(null);
    setUploadingKind(kind);
    try {
      const tpl = await designTemplateService.upload(kind, file);
      setActive((prev) => ({ ...prev, [kind]: tpl }));
      if (history[kind]) await refreshHistory(kind);
      show(t("settings.templateManagement.uploadedMessage", { fileName: file.name }));
    } catch {
      setError(t("settings.templateManagement.uploadError"));
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleActivate(kind: DesignTemplateKind, id: string) {
    setError(null);
    try {
      await designTemplateService.activate(kind, id);
      const [tpl, list] = await Promise.all([
        designTemplateService.getActive(kind),
        designTemplateService.listByKind(kind),
      ]);
      setActive((prev) => ({ ...prev, [kind]: tpl }));
      setHistory((prev) => ({ ...prev, [kind]: list }));
      show(t("settings.templateManagement.activatedMessage"));
    } catch {
      setError(t("settings.templateManagement.uploadError"));
    }
  }

  async function toggleHistory(kind: DesignTemplateKind) {
    if (openHistory === kind) {
      setOpenHistory(null);
      return;
    }
    if (!history[kind]) await refreshHistory(kind);
    setOpenHistory(kind);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("settings.templateManagement.description")}</p>
      <p className="text-[11.5px] text-muted-2">{t("settings.templateManagement.dwgNote")}</p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: "180px" }}>{t("common.kind")}</th>
              <th>{t("settings.templateSection")}</th>
              <th style={{ width: "90px" }}>{t("settings.templateManagement.versionColumn")}</th>
              <th style={{ width: "230px" }} />
            </tr>
          </thead>
          <tbody>
            {DESIGN_TEMPLATE_KINDS.map((kind) => {
              const tpl = active[kind];
              return (
                <Fragment key={kind}>
                  <tr>
                    <td>{t(`settings.templateManagement.kinds.${kind}`)}</td>
                    <td className={tpl ? "text-foreground" : "text-muted-2"}>
                      {tpl ? tpl.fileName : t("settings.templateEmpty")}
                    </td>
                    <td>{tpl ? `v${tpl.version}` : "—"}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {tpl && (
                          <a
                            href={getPublicUrl(tpl.storagePath)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost btn-icon"
                            title={t("settings.templateManagement.downloadActive")}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => toggleHistory(kind)}
                          className="btn-ghost btn-icon"
                          title={t("settings.templateManagement.versionHistory")}
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => fileInputs.current[kind]?.click()}
                          disabled={uploadingKind === kind}
                          className="btn-secondary"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {t("settings.templateUpload")}
                        </button>
                        <input
                          ref={(el) => {
                            fileInputs.current[kind] = el;
                          }}
                          type="file"
                          accept={KIND_ACCEPT[kind]}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(kind, file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                  {openHistory === kind && (
                    <tr key={`${kind}-history`}>
                      <td colSpan={4} className="bg-surface-2">
                        {!history[kind] || history[kind].length === 0 ? (
                          <span className="text-[12px] text-muted-2">
                            {t("settings.templateManagement.noHistory")}
                          </span>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {history[kind].map((v) => (
                              <li key={v.id} className="flex items-center justify-between gap-2 text-[12px]">
                                <span className={v.active ? "text-foreground" : "text-muted"}>
                                  v{v.version} — {v.fileName} ({v.uploadedAt})
                                  {v.active && ` — ${t("settings.templateManagement.activeLabel")}`}
                                </span>
                                {!v.active && (
                                  <button
                                    onClick={() => handleActivate(kind, v.id)}
                                    className="btn-ghost text-[11.5px]"
                                  >
                                    {t("settings.templateManagement.activateButton")}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
