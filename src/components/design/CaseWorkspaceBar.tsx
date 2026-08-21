"use client";

import { Check, Plus, Search as SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService, designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import { NewCaseModal } from "@/components/design/NewCaseModal";
import type { DesignCaseWithPanels, Project } from "@/lib/types/design";

interface CaseWorkspaceBarProps {
  projectId: string;
  caseId: string;
  onProjectChange: (projectId: string) => void;
  onCaseChange: (caseId: string) => void;
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
}: CaseWorkspaceBarProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const autoSelected = useRef(false);

  useEffect(() => {
    projectService.list().then((list) => {
      setProjects(list);
      if (!autoSelected.current && !projectId && list.length > 0) {
        autoSelected.current = true;
        onProjectChange(list[0].id);
      }
    });
    // Only run once on mount — reload after creating a Project happens explicitly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (addingProject) projectInputRef.current?.focus();
  }, [addingProject]);

  async function handleAddProject() {
    const name = newProjectName.trim();
    if (!name) {
      setAddingProject(false);
      return;
    }
    const created = await projectService.create(name);
    setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ja")));
    setNewProjectName("");
    setAddingProject(false);
    onProjectChange(created.id);
  }

  function handleCaseCreated(created: { id: string; projectId: string }) {
    setShowNewCaseModal(false);
    designCaseService.listByProject(created.projectId).then(setCases);
    onCaseChange(created.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <label className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-muted">
          {t("design.workspaceBar.projectLabel")}
        </label>
        <select
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="field-input w-full py-1.5 sm:w-auto sm:min-w-[150px]"
        >
          <option value="">
            {projects.length === 0
              ? t("design.workspaceBar.noProjects")
              : t("design.workspaceBar.projectPlaceholder")}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {addingProject ? (
        <div className="flex items-center gap-1">
          <input
            ref={projectInputRef}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddProject();
              if (e.key === "Escape") {
                setNewProjectName("");
                setAddingProject(false);
              }
            }}
            placeholder={t("design.workspaceBar.projectNamePlaceholder")}
            className="field-input w-auto min-w-[140px] py-1.5"
          />
          <button onClick={handleAddProject} className="btn-ghost btn-icon">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setNewProjectName("");
              setAddingProject(false);
            }}
            className="btn-ghost btn-icon"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => setAddingProject(true)} className="btn-ghost">
          <Plus className="h-3.5 w-3.5" />
          {t("design.workspaceBar.addProject")}
        </button>
      )}

      <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

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

      <button
        onClick={() => setShowNewCaseModal(true)}
        disabled={!projectId}
        className="btn-primary w-full sm:w-auto"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("design.workspaceBar.newCase")}
      </button>

      <Link
        href={projectId ? `/design/search?projectId=${projectId}` : "/design/search"}
        className="btn-secondary w-full sm:w-auto"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        {t("design.workspaceBar.searchButton")}
      </Link>

      {showNewCaseModal && projectId && (
        <NewCaseModal
          projectId={projectId}
          onClose={() => setShowNewCaseModal(false)}
          onCreated={handleCaseCreated}
        />
      )}
    </div>
  );
}
