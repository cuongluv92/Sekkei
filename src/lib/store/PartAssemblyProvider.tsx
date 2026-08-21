"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyContextValue {
  rows: PartAssemblyRow[];
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
 * Holds the 部品製作 assembly table for the lifetime of the session (client
 * memory only for now). Keeping this above the router in the layout means
 * the list survives navigation between pages, which will matter once users
 * jump between 検索・部品データ・部品図 and 部品製作 to build one list.
 */
export function PartAssemblyProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<PartAssemblyRow[]>([]);

  const addRow = useCallback((row: Omit<PartAssemblyRow, "id"> & { id?: string }) => {
    setRows((prev) => [...prev, { ...row, id: row.id ?? nextId() }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity } : r)));
  }, []);

  const updateRemarks = useCallback((id: string, remarks: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, remarks } : r)));
  }, []);

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
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
      return next;
    });
  }, []);

  const clear = useCallback(() => setRows([]), []);

  const value = useMemo(
    () => ({ rows, addRow, removeRow, updateQuantity, updateRemarks, moveRow, clear }),
    [rows, addRow, removeRow, updateQuantity, updateRemarks, moveRow, clear],
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
