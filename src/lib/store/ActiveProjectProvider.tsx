"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { projectService } from "@/lib/services/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const STORAGE_KEY = "sekkei.activeProject";

interface ActiveProjectContextValue {
  projectId: string;
  setProjectId: (projectId: string) => void;
  /** True until a persisted projectId (if any) has been verified against the database. Consumers should hold off rendering "no Project selected" while this is true, to avoid a flash before restore completes. */
  loading: boolean;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(
  null,
);

/**
 * THE one active-Project selection shared across the whole app — 設計管理,
 * 部品製作, and every calculation module (重量/盤重量/風量/風圧/耐震/他計算) all
 * read and write this same context instead of keeping their own separate
 * "current Project" state, so picking a Project in one place keeps it active
 * everywhere else. Backed by the same `projects` table/`projectService`
 * 設計管理 already used — there is no separate Project system per module.
 *
 * Persists the selection to localStorage, but on mount re-verifies the
 * stored id against the database (`projectService.getById`) before
 * restoring it — a Project deleted elsewhere must never be silently
 * "restored" into a fresh session.
 */
export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const last = loadFromStorage<string>(STORAGE_KEY, "");
    if (!last) {
      setLoading(false);
      return;
    }
    let active = true;
    projectService
      .getById(last)
      .then((project) => {
        if (!active) return;
        if (project) {
          setProjectIdState(project.id);
        } else {
          saveToStorage(STORAGE_KEY, "");
        }
      })
      .catch(() => {
        // Offline / not configured yet — leave the stored id alone (don't
        // wipe it over a transient failure) but don't restore it into this
        // session either; the user can just pick again.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    saveToStorage(STORAGE_KEY, id);
  }, []);

  return (
    <ActiveProjectContext.Provider value={{ projectId, setProjectId, loading }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error(
      "useActiveProject must be used within an ActiveProjectProvider",
    );
  }
  return ctx;
}
