"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { partAssemblyService } from "@/lib/services/partAssemblyService";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyContextValue {
  projectId: string;
  setProjectId: (projectId: string) => void;
  rows: PartAssemblyRow[];
  loading: boolean;
  addRow: (row: Omit<PartAssemblyRow, "id"> & { id?: string }) => void;
  removeRow: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateRemarks: (id: string, remarks: string) => void;
  moveRow: (fromIndex: number, toIndex: number) => void;
  clear: () => void;
}

const PartAssemblyContext = createContext<PartAssemblyContextValue | null>(null);

let rowCounter = 0;
function nextId() {
  rowCounter += 1;
  return `row-${Date.now()}-${rowCounter}`;
}

/**
 * Holds the 部品製作 assembly table, scoped per Project (never mixed between
 * Projects) and persisted so it survives reload/navigation — not just
 * session memory. Kept above the router in the layout so switching pages
 * doesn't lose the in-progress table, but every mutation is written through
 * to `partAssemblyService` immediately.
 */
export function PartAssemblyProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState("");
  const [rows, setRows] = useState<PartAssemblyRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const last = partAssemblyService.getLastActiveProjectId();
    if (last) setProjectIdState(last);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setRows([]);
      return;
    }
    let active = true;
    setLoading(true);
    partAssemblyService.listByProject(projectId).then((list) => {
      if (active) {
        setRows(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  const persist = useCallback(
    (next: PartAssemblyRow[]) => {
      setRows(next);
      if (projectId) partAssemblyService.saveRows(projectId, next);
    },
    [projectId],
  );

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    partAssemblyService.setLastActiveProjectId(id);
  }, []);

  const addRow = useCallback(
    (row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
      setRows((prev) => {
        const next = [...prev, { ...row, id: row.id ?? nextId() }];
        if (projectId) partAssemblyService.saveRows(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const removeRow = useCallback(
    (id: string) => {
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (projectId) partAssemblyService.saveRows(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, quantity } : r));
        if (projectId) partAssemblyService.saveRows(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const updateRemarks = useCallback(
    (id: string, remarks: string) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, remarks } : r));
        if (projectId) partAssemblyService.saveRows(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const moveRow = useCallback(
    (fromIndex: number, toIndex: number) => {
      setRows((prev) => {
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        if (projectId) partAssemblyService.saveRows(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo(
    () => ({
      projectId,
      setProjectId,
      rows,
      loading,
      addRow,
      removeRow,
      updateQuantity,
      updateRemarks,
      moveRow,
      clear,
    }),
    [projectId, setProjectId, rows, loading, addRow, removeRow, updateQuantity, updateRemarks, moveRow, clear],
  );

  return <PartAssemblyContext.Provider value={value}>{children}</PartAssemblyContext.Provider>;
}

export function usePartAssembly() {
  const ctx = useContext(PartAssemblyContext);
  if (!ctx) {
    throw new Error("usePartAssembly must be used within a PartAssemblyProvider");
  }
  return ctx;
}
