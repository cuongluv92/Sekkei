"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { partAssemblyService } from "@/lib/services/partAssemblyService";
import { useActiveProject } from "@/lib/store/ActiveProjectProvider";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyContextValue {
  projectId: string;
  setProjectId: (projectId: string) => void;
  /** True until the shared active-Project selection has been restored/verified — see `ActiveProjectProvider`. */
  projectLoading: boolean;
  rows: PartAssemblyRow[];
  loading: boolean;
  /** Resolves once the new row is persisted, rejects if `partAssemblyService.saveRows` fails — lets the caller show a success/error toast. The row is added to local state either way (no rollback on failure). Resolves with the new row's id. */
  addRow: (
    row: Omit<PartAssemblyRow, "id"> & { id?: string },
  ) => Promise<string>;
  /** Inserts at an exact position (clamped to [0, length]) instead of always appending — for 上に追加/下に追加 and "insert from master here". Same resolve/reject contract as `addRow`. */
  insertRowAt: (
    index: number,
    row: Omit<PartAssemblyRow, "id"> & { id?: string },
  ) => Promise<string>;
  removeRow: (id: string) => void;
  /** Project-side override of any editable field (記号/品名/メーカー/型式/定格・仕様/数量/備考) — never writes back to 部品データ master. */
  updateField: (id: string, patch: Partial<PartAssemblyRow>) => void;
  moveRow: (fromIndex: number, toIndex: number) => void;
  clear: () => void;
}

const PartAssemblyContext = createContext<PartAssemblyContextValue | null>(
  null,
);

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
  const {
    projectId,
    setProjectId,
    loading: projectLoading,
  } = useActiveProject();
  const [rows, setRows] = useState<PartAssemblyRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  const addRow = useCallback(
    (row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
      const id = row.id ?? nextId();
      let next: PartAssemblyRow[] = [];
      setRows((prev) => {
        next = [...prev, { ...row, id }];
        return next;
      });
      if (!projectId) return Promise.resolve(id);
      return partAssemblyService.saveRows(projectId, next).then(() => id);
    },
    [projectId],
  );

  const insertRowAt = useCallback(
    (index: number, row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
      const id = row.id ?? nextId();
      let next: PartAssemblyRow[] = [];
      setRows((prev) => {
        const clamped = Math.max(0, Math.min(index, prev.length));
        next = [...prev];
        next.splice(clamped, 0, { ...row, id });
        return next;
      });
      if (!projectId) return Promise.resolve(id);
      return partAssemblyService.saveRows(projectId, next).then(() => id);
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

  const updateField = useCallback(
    (id: string, patch: Partial<PartAssemblyRow>) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
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
      projectLoading,
      rows,
      loading,
      addRow,
      insertRowAt,
      removeRow,
      updateField,
      moveRow,
      clear,
    }),
    [
      projectId,
      setProjectId,
      projectLoading,
      rows,
      loading,
      addRow,
      insertRowAt,
      removeRow,
      updateField,
      moveRow,
      clear,
    ],
  );

  return (
    <PartAssemblyContext.Provider value={value}>
      {children}
    </PartAssemblyContext.Provider>
  );
}

export function usePartAssembly() {
  const ctx = useContext(PartAssemblyContext);
  if (!ctx) {
    throw new Error(
      "usePartAssembly must be used within a PartAssemblyProvider",
    );
  }
  return ctx;
}
