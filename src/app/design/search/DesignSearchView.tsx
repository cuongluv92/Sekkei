"use client";

import { Loader2, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService, designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import { PageHeader } from "@/components/common/PageHeader";
import type { DesignCaseSearchQuery, DesignCaseWithPanels, Project } from "@/lib/types/design";

export function DesignSearchView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [year, setYear] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [constructionNumber, setConstructionNumber] = useState("");
  const [orderer, setOrderer] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [projectName, setProjectName] = useState("");
  const [panelName, setPanelName] = useState("");

  const [results, setResults] = useState<DesignCaseWithPanels[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectService.list().then(setProjects);
  }, []);

  function buildQuery(): DesignCaseSearchQuery {
    return {
      projectId: projectId || undefined,
      year: year ? Number(year) : undefined,
      drawingNumber: drawingNumber || undefined,
      managementNumber: managementNumber || undefined,
      constructionNumber: constructionNumber || undefined,
      orderer: orderer || undefined,
      customerContact: customerContact || undefined,
      projectName: projectName || undefined,
      panelName: panelName || undefined,
    };
  }

  async function handleSearch() {
    setLoading(true);
    const found = await designCaseService.search(buildQuery());
    setLoading(false);
    if (found.length === 1) {
      const c = found[0].case;
      router.push(`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`);
      return;
    }
    setResults(found);
  }

  function handleClear() {
    setProjectId("");
    setYear("");
    setDrawingNumber("");
    setManagementNumber("");
    setConstructionNumber("");
    setOrderer("");
    setCustomerContact("");
    setProjectName("");
    setPanelName("");
    setResults(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("design.search.title")} description={t("design.search.description")} />

      <div className="panel">
        <div className="panel-body flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="field-label">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="field-input"
              >
                <option value="">{t("design.search.allProjects")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{t("design.fields.year")}</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.drawingNumber")}</label>
              <input
                value={drawingNumber}
                onChange={(e) => setDrawingNumber(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.managementNumber")}</label>
              <input
                value={managementNumber}
                onChange={(e) => setManagementNumber(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.constructionNumber")}</label>
              <input
                value={constructionNumber}
                onChange={(e) => setConstructionNumber(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.orderer")}</label>
              <input
                value={orderer}
                onChange={(e) => setOrderer(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.customerContact")}</label>
              <input
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.fields.projectName")}</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">{t("design.search.panelNameLabel")}</label>
              <input
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-2">{t("design.search.andHint")}</p>
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <button onClick={handleSearch} disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchIcon className="h-3.5 w-3.5" />}
              {t("design.search.button")}
            </button>
            <button onClick={handleClear} className="btn-secondary">
              {t("design.search.clearButton")}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t("design.search.resultTitle")}</span>
          </div>
          {results.length === 0 ? (
            <p className="p-8 text-center text-[12px] text-muted-2">{t("design.search.noResults")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map(({ case: c, panels }) => (
                <li key={c.id}>
                  <Link
                    href={`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[14px] text-foreground transition-colors hover:bg-surface-2"
                  >
                    <span className="truncate font-mono">{buildCaseDisplayLabel(c, panels)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
