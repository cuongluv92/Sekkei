"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService } from "@/lib/services/design";
import type { Project } from "@/lib/types/design";

interface ProjectSelectorProps {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}

/**
 * Compact "現在のProject" bar shared by every calculation module
 * (基本重量計算/盤重量計算/換気計算/耐震計算/他計算) — select an existing Project
 * (the same `projects` entity 設計管理/部品製作 use, not a separate one) or
 * create one inline with just a name. Deliberately minimal — not the full
 * 設計依頼書 creation form, per spec.
 */
export function ProjectSelector({ projectId, onProjectChange }: ProjectSelectorProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    projectService.list().then((list) => {
      setProjects(list);
      if (!projectId && list.length > 0) onProjectChange(list[0].id);
    });
    // Only run once on mount — projectId changes afterwards come from the user or persisted state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (addingProject) inputRef.current?.focus();
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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <label className="whitespace-nowrap text-[12.5px] font-semibold text-muted">
        {t("design.workspaceBar.currentProjectLabel")}
      </label>
      <select
        value={projectId}
        onChange={(e) => onProjectChange(e.target.value)}
        className="field-input w-auto min-w-[180px] py-1.5"
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

      {addingProject ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
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
    </div>
  );
}
