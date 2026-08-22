"use client";

import { Check, Plus, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService, projectService } from "@/lib/services/design";
import {
  buildProjectOptionLabel,
  buildProjectOptions,
  matchesProjectOptionQuery,
  type ProjectOption,
} from "@/lib/utils/projectSearch";
import { NewProjectModal } from "@/components/common/NewProjectModal";
import type { Project } from "@/lib/types/design";

interface ProjectSelectorProps {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}

/** What's currently shown as "現在のProject" — kept separate from `projectId` so the label can reflect exactly which 案件 the user clicked, even though several 案件 can share one `projectId`. */
interface SelectedDisplay {
  projectId: string;
  caseId: string | null;
  label: string;
}

/**
 * THE one Project picker shared by every Project-scoped area of the app
 * (設計管理, 部品製作, 重量/盤重量/風量/風圧/耐震/他計算) — same `projects` table,
 * same list, same UX everywhere. Every 案件 (図面番号) under every Project is
 * its own searchable/selectable row — a Project with several 案件 (e.g.
 * 26-001/26-002/26-003 all under one Project) is never collapsed down to a
 * single arbitrary row, which is what previously made it look like only the
 * newest 案件 existed. Picking any row resolves to that 案件's `projectId`.
 *
 * Collapsed by default to a plain "現在のProject：…" line + 変更/選択解除
 * buttons so it never crowds the page; expands into the searchable list
 * only when changing. "＋ 新規Project" opens a real form (`NewProjectModal`)
 * instead of an always-visible inline input. Never auto-picks on the user's
 * behalf — leaving nothing selected is a normal, expected state.
 */
export function ProjectSelector({ projectId, onProjectChange }: ProjectSelectorProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState(!projectId);
  const [query, setQuery] = useState("");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [selected, setSelected] = useState<SelectedDisplay | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([projectService.list(), designCaseService.listAll()]).then(([projects, allCases]) => {
      setOptions(buildProjectOptions(projects, allCases));
      setLoaded(true);
    });
  }, []);

  // Keep the displayed label in sync with `projectId` when it changes for a
  // reason other than a local click here — restored on mount, changed by
  // another mounted ProjectSelector, or cleared. Falls back to this
  // Project's first 案件 (now sorted ascending, so "first" means 26-001, not
  // whichever 案件 happened to load last) since we don't know which exact
  // 案件 was originally picked once the component remounts fresh.
  useEffect(() => {
    if (!projectId) {
      setSelected(null);
      return;
    }
    if (selected?.projectId === projectId) return;
    const fallback = options.find((o) => o.projectId === projectId);
    if (fallback) {
      setSelected({ projectId, caseId: fallback.case?.id ?? null, label: buildProjectOptionLabel(fallback) });
    }
    // Only re-derive when the id or the loaded option list changes — not on every `selected` update (that would fight the precise label set by handleSelect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, options]);

  // Once a Project becomes active (restored, or picked just now), collapse
  // back to the compact "現在のProject" display.
  useEffect(() => {
    if (projectId) setPicking(false);
  }, [projectId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && projectId) {
        setPicking(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => matchesProjectOptionQuery(o, q));
  }, [options, query]);

  function handleSelect(option: ProjectOption) {
    setSelected({
      projectId: option.projectId,
      caseId: option.case?.id ?? null,
      label: buildProjectOptionLabel(option),
    });
    onProjectChange(option.projectId);
    setQuery("");
    setPicking(false);
  }

  function handleDeselect() {
    setSelected(null);
    onProjectChange("");
    setQuery("");
    setPicking(true);
  }

  function handleCreated(created: Project) {
    const option: ProjectOption = { projectId: created.id, projectName: created.name, case: null, panels: [] };
    setOptions((prev) => [...prev, option]);
    setSelected({ projectId: created.id, caseId: null, label: created.name });
    onProjectChange(created.id);
    setShowNewProjectModal(false);
    setPicking(false);
  }

  const currentLabel = selected?.projectId === projectId ? selected.label : null;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
    >
      {!picking ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t("design.workspaceBar.currentProjectLabel")}
            </div>
            <div className="truncate text-[14px] font-bold text-foreground">
              {currentLabel ?? (loaded ? t("design.workspaceBar.projectNotFound") : t("common.loading"))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setPicking(true)} className="btn-secondary">
              {t("design.workspaceBar.changeProject")}
            </button>
            <button onClick={handleDeselect} className="btn-ghost" title={t("design.workspaceBar.deselectProject")}>
              <X className="h-3.5 w-3.5" />
              {t("design.workspaceBar.deselectProject")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("design.workspaceBar.projectSearchPlaceholder")}
              className="field-input pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border-strong bg-surface-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12.5px] text-muted-2">
                {loaded ? t("design.workspaceBar.noProjects") : t("common.loading")}
              </div>
            ) : (
              filtered.map((option) => {
                const isCurrent =
                  option.projectId === projectId && (option.case?.id ?? null) === (selected?.caseId ?? null);
                return (
                  <button
                    key={option.case?.id ?? option.projectId}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
                  >
                    {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                    <span className="truncate">{buildProjectOptionLabel(option)}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setShowNewProjectModal(true)} className="btn-ghost">
              <Plus className="h-3.5 w-3.5" />
              {t("design.workspaceBar.newProjectButton")}
            </button>
            {projectId && (
              <button onClick={() => setPicking(false)} className="btn-ghost">
                {t("common.cancel")}
              </button>
            )}
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
