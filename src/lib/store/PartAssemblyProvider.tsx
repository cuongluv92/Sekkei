"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { partAssemblyService } from "@/lib/services/partAssemblyService";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyContextValue {
  caseId: string;
  setCaseId: (caseId: string) => void;
  /** True until the shared active-案件 selection has been restored/verified — see `ActiveCaseProvider`. */
  caseLoading: boolean;
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
  /** 案件側 override of any editable field (記号/品名/メーカー/型式/定格・仕様/数量/備考) — never writes back to 部品データ master. */
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
 * Holds the 部品製作 assembly table, scoped per 案件 (never mixed between
 * 案件 — see `partAssemblyService`'s `design_case_id` scoping) and persisted
 * so it survives reload/navigation — not just session memory. Kept above
 * the router in the layout so switching pages doesn't lose the in-progress
 * table, but every mutation is written through to `partAssemblyService`
 * immediately (so this module never has an "unsaved" state to track).
 */
export function PartAssemblyProvider({ children }: { children: ReactNode }) {
  const { caseId, setCaseId, loading: caseLoading } = useActiveCase();
  const [rows, setRows] = useState<PartAssemblyRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Mirrors `rows` synchronously, kept up to date by every mutator itself
  // (not just the effect below) — `addRow`/`insertRowAt` need the actual
  // next array to pass to `saveRows` in the same synchronous call, and
  // React does not guarantee a `setState(prev => ...)` updater has already
  // run by the time the next line executes, so reading from state (or from
  // a value only an updater assigns) here would risk persisting a stale
  // array — silently dropping the row that was just "added".
  const rowsRef = useRef<PartAssemblyRow[]>([]);

  useEffect(() => {
    if (!caseId) {
      rowsRef.current = [];
      setRows([]);
      return;
    }
    let active = true;
    setLoading(true);
    partAssemblyService.listByCase(caseId).then((list) => {
      if (active) {
        rowsRef.current = list;
        setRows(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [caseId]);

  const persist = useCallback(
    (next: PartAssemblyRow[]) => {
      rowsRef.current = next;
      setRows(next);
      if (caseId) partAssemblyService.saveRows(caseId, next);
    },
    [caseId],
  );

  const addRow = useCallback(
    (row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
      const id = row.id ?? nextId();
      const next = [...rowsRef.current, { ...row, id }];
      rowsRef.current = next;
      setRows(next);
      if (!caseId) return Promise.resolve(id);
      return partAssemblyService.saveRows(caseId, next).then(() => id);
    },
    [caseId],
  );

  const insertRowAt = useCallback(
    (index: number, row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
      const id = row.id ?? nextId();
      const clamped = Math.max(0, Math.min(index, rowsRef.current.length));
      const next = [...rowsRef.current];
      next.splice(clamped, 0, { ...row, id });
      rowsRef.current = next;
      setRows(next);
      if (!caseId) return Promise.resolve(id);
      return partAssemblyService.saveRows(caseId, next).then(() => id);
    },
    [caseId],
  );

  const removeRow = useCallback(
    (id: string) => {
      const next = rowsRef.current.filter((r) => r.id !== id);
      rowsRef.current = next;
      setRows(next);
      if (caseId) partAssemblyService.saveRows(caseId, next);
    },
    [caseId],
  );

  const updateField = useCallback(
    (id: string, patch: Partial<PartAssemblyRow>) => {
      const next = rowsRef.current.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      );
      rowsRef.current = next;
      setRows(next);
      if (caseId) partAssemblyService.saveRows(caseId, next);
    },
    [caseId],
  );

  const moveRow = useCallback(
    (fromIndex: number, toIndex: number) => {
      const prev = rowsRef.current;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      rowsRef.current = next;
      setRows(next);
      if (caseId) partAssemblyService.saveRows(caseId, next);
    },
    [caseId],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo(
    () => ({
      caseId,
      setCaseId,
      caseLoading,
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
      caseId,
      setCaseId,
      caseLoading,
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
