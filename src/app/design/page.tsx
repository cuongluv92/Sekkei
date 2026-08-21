"use client";

import { FolderOpen, Plus, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService } from "@/lib/services/design";
import { PageHeader } from "@/components/common/PageHeader";
import type { Project } from "@/lib/types/design";

export default function DesignProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    projectService.list().then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const project = await projectService.create(newName.trim());
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name, "ja")));
    setNewName("");
    setCreating(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("design.title")}
        actions={
          <Link href="/design/search" className="btn-secondary">
            <SearchIcon className="h-3.5 w-3.5" />
            {t("design.cases.searchButton")}
          </Link>
        }
      />

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("design.projects.title")}</span>
        </div>
        <div className="panel-body flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder={t("design.projects.namePlaceholder")}
              className="field-input max-w-xs"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("design.projects.createButton")}
            </button>
          </div>

          {loading ? (
            <p className="text-[12px] text-muted">{t("common.loading")}</p>
          ) : projects.length === 0 ? (
            <p className="text-[12px] text-muted-2">{t("design.projects.empty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {projects.map((project) => (
                <li key={project.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[12.5px] text-foreground">
                    <FolderOpen className="h-4 w-4 text-muted" />
                    {project.name}
                  </span>
                  <Link href={`/design/${project.id}`} className="btn-secondary">
                    {t("design.projects.openButton")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
