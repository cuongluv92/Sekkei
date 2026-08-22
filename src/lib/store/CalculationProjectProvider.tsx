"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const STORAGE_KEY = "sekkei.calculation.activeProject";

interface CalculationProjectContextValue {
  projectId: string;
  setProjectId: (projectId: string) => void;
}

const CalculationProjectContext = createContext<CalculationProjectContextValue | null>(null);

/**
 * The one active Project shared across every calculation module
 * (基本重量計算/盤重量計算/換気計算/耐震計算/他計算) so switching
 * 重量計算 → 換気計算 → 耐震計算 keeps the same Project selected instead of
 * asking again each time. Deliberately separate from 部品製作's own active-
 * Project state (PartAssemblyProvider) — that feature is being built
 * independently and isn't touched here, even though both ultimately point
 * at the same `projects` table/entity.
 */
export function CalculationProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState("");

  useEffect(() => {
    const last = loadFromStorage<string>(STORAGE_KEY, "");
    if (last) setProjectIdState(last);
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    saveToStorage(STORAGE_KEY, id);
  }, []);

  return (
    <CalculationProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </CalculationProjectContext.Provider>
  );
}

export function useCalculationProject() {
  const ctx = useContext(CalculationProjectContext);
  if (!ctx) {
    throw new Error("useCalculationProject must be used within a CalculationProjectProvider");
  }
  return ctx;
}
