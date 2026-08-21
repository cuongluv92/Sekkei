"use client";

import { ArrowLeft, Plus, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService, designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import { PageHeader } from "@/components/common/PageHeader";
import type { DesignCaseWithPanels, Project } from "@/lib/types/design";

export default function ProjectCasesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([projectService.getById(projectId), designCaseService.listByProject(projectId)]).then(
      ([proj, caseList]) => {
        if (!active) return;
        setProject(proj);
        setCases(caseList);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/design" className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("design.cases.backToProjects")}
        </Link>
        <PageHeader
          title={project ? project.name : "..."}
          description={t("design.cases.title")}
          actions={
            <>
              <Link href={`/design/search?projectId=${projectId}`} className="btn-secondary">
                <SearchIcon className="h-3.5 w-3.5" />
                {t("design.cases.searchButton")}
              </Link>
              <Link href={`/design/${projectId}/new`} className="btn-primary">
                <Plus className="h-3.5 w-3.5" />
                {t("design.cases.newCase")}
              </Link>
            </>
          }
        />
      </div>

      <div className="panel">
        {loading ? (
          <p className="p-6 text-center text-[12px] text-muted">{t("common.loading")}</p>
        ) : cases.length === 0 ? (
          <p className="p-8 text-center text-[12px] text-muted-2">{t("design.cases.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {cases.map(({ case: c, panels }) => (
              <li key={c.id}>
                <Link
                  href={`/design/${projectId}/case/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-foreground transition-colors hover:bg-surface-2"
                >
                  <span className="truncate font-mono">{buildCaseDisplayLabel(c, panels)}</span>
                  <span className="shrink-0 text-[11px] text-muted-2">{c.updatedAt}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
