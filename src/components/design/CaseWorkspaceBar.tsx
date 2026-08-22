"use client";

import { Plus, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import { NewCaseModal } from "@/components/design/NewCaseModal";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import type { DesignCaseWithPanels } from "@/lib/types/design";

const QUICK_SEARCH_LIMIT = 15;

interface CaseWorkspaceBarProps {
  projectId: string;
  caseId: string;
  onProjectChange: (projectId: string) => void;
  onCaseChange: (caseId: string) => void;
  /** 設計依頼書 only — 製作依頼書 always works from an existing case (its 設計依頼書 must already exist), so it never creates a brand new one here. */
  allowCreate?: boolean;
}

/**
 * Compact selector bar shared by 設計依頼書 and 製作依頼書 — replaces the old
 * standalone Project list / 案件一覧 pages. Project and 案件 selection is
 * lifted to the parent (URL query params) so it survives switching between
 * those two tabs.
 */
export function CaseWorkspaceBar({
  projectId,
  caseId,
  onProjectChange,
  onCaseChange,
  allowCreate = true,
}: CaseWorkspaceBarProps) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [allCases, setAllCases] = useState<DesignCaseWithPanels[]>([]);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) {
      setCases([]);
      return;
    }
    let active = true;
    designCaseService.listByProject(projectId).then((list) => {
      if (active) setCases(list);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    designCaseService.listAll().then(setAllCases);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        quickSearchRef.current &&
        !quickSearchRef.current.contains(e.target as Node)
      ) {
        setQuickOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const quickMatches = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return [];
    return allCases
      .filter(({ case: c, panels }) => {
        const haystack = [
          c.drawingNumber,
          c.managementNumber,
          c.constructionNumber,
          c.projectName,
          ...panels.map((p) => p.panelName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, QUICK_SEARCH_LIMIT);
  }, [allCases, quickQuery]);

  function handleQuickSelect(match: DesignCaseWithPanels) {
    onProjectChange(match.case.projectId);
    onCaseChange(match.case.id);
    setQuickQuery("");
    setQuickOpen(false);
  }

  function handleCaseCreated(created: { id: string; projectId: string }) {
    setShowNewCaseModal(false);
    designCaseService.listByProject(created.projectId).then(setCases);
    designCaseService.listAll().then(setAllCases);
    onCaseChange(created.id);
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={quickSearchRef} className="relative">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={quickQuery}
            onChange={(e) => {
              setQuickQuery(e.target.value);
              setQuickOpen(true);
            }}
            onFocus={() => setQuickOpen(true)}
            placeholder={t("design.workspaceBar.quickSearchPlaceholder")}
            className="field-input w-full py-2 pl-8"
          />
        </div>
        {quickOpen && quickQuery.trim() && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border-strong bg-surface-2 shadow-lg">
            {quickMatches.length === 0 ? (
              <li className="px-3 py-2.5 text-[12.5px] text-muted-2">
                {t("design.workspaceBar.quickSearchNoResults")}
              </li>
            ) : (
              quickMatches.map((match) => (
                <li key={match.case.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleQuickSelect(match)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate text-[13.5px] text-foreground">
                      {buildCaseDisplayLabel(match.case, match.panels)}
                    </span>
                    <span className="truncate text-[11.5px] text-muted-2">
                      {match.case.projectName}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <ProjectSelector
        projectId={projectId}
        onProjectChange={onProjectChange}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <label className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-muted">
            {t("design.workspaceBar.caseLabel")}
          </label>
          <select
            value={caseId}
            onChange={(e) => onCaseChange(e.target.value)}
            disabled={!projectId}
            className="field-input w-full py-1.5 sm:w-auto sm:min-w-[220px]"
          >
            <option value="">
              {!projectId
                ? t("design.workspaceBar.selectProjectFirst")
                : cases.length === 0
                  ? t("design.workspaceBar.noCases")
                  : t("design.workspaceBar.casePlaceholder")}
            </option>
            {cases.map(({ case: c, panels }) => (
              <option key={c.id} value={c.id}>
                {buildCaseDisplayLabel(c, panels)}
              </option>
            ))}
          </select>
        </div>

        {allowCreate && (
          <button
            onClick={() => setShowNewCaseModal(true)}
            disabled={!projectId}
            className="btn-primary w-full sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("design.workspaceBar.newCase")}
          </button>
        )}

        <Link
          href={
            projectId
              ? `/design/search?projectId=${projectId}`
              : "/design/search"
          }
          className="btn-secondary w-full sm:w-auto"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          {t("design.workspaceBar.advancedSearchButton")}
        </Link>

        {allowCreate && showNewCaseModal && projectId && (
          <NewCaseModal
            projectId={projectId}
            onClose={() => setShowNewCaseModal(false)}
            onCreated={handleCaseCreated}
          />
        )}
      </div>
    </div>
  );
}
