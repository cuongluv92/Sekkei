"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { designCaseService } from "@/lib/services/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const STORAGE_KEY = "sekkei.activeCase";

interface ActiveCaseContextValue {
  /** The active 案件's id (design_cases.id) — 案件 IS the root record shared by the whole app, there is no separate "Project" layer above it. */
  caseId: string;
  setCaseId: (caseId: string) => void;
  /** True until a persisted caseId (if any) has been verified against the database. Consumers should hold off rendering "no 案件 selected" while this is true, to avoid a flash before restore completes. */
  loading: boolean;
  /** True whenever at least one mounted section has unsaved local edits — drives the 保存済み✓/未保存● indicator and the "switch while unsaved" confirmation. Derived automatically from the save-handler registry below, never set directly (so it can never drift out of sync with what's actually unsaved). */
  dirty: boolean;
  /**
   * A section with local edits not yet persisted for the active 案件
   * registers its own save function under a stable `id` (e.g. its shape
   * key) — this both marks the page dirty AND gives the case-switch
   * confirmation's "保存して変更" something real to call. The section
   * unregisters itself (passing `null`) once its edits are saved, which is
   * what clears `dirty` again — several independent sections can be dirty
   * at once (e.g. 基本重量計算's 4 shape sub-forms each save separately) and
   * the page stays dirty until every one of them has cleared itself.
   */
  registerSaveHandler: (
    id: string,
    handler: (() => Promise<void>) | null,
  ) => void;
  /** Invokes every currently registered save handler in parallel. Resolves immediately if none are registered. */
  runSaveHandler: () => Promise<void>;
}

const ActiveCaseContext = createContext<ActiveCaseContextValue | null>(null);

/**
 * THE one active-案件 selection shared across the whole app — 設計管理,
 * 部品製作, and every calculation module (重量/盤重量/母線銅帯/換気/耐震/他計算) all
 * read and write this same context instead of keeping their own separate
 * "current 案件" state, so picking a 案件 in one place keeps it active
 * everywhere else. Backed directly by `design_cases`/`designCaseService` —
 * 案件 is the root record, there is no separate Project grouping table
 * above it and no per-module Project system.
 *
 * Persists the selection to localStorage, but on mount re-verifies the
 * stored id against the database (`designCaseService.getDetail`) before
 * restoring it — a 案件 archived/deleted elsewhere must never be silently
 * "restored" into a fresh session.
 */
export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const saveHandlersRef = useRef<Map<string, () => Promise<void>>>(new Map());

  useEffect(() => {
    const last = loadFromStorage<string>(STORAGE_KEY, "");
    if (!last) {
      setLoading(false);
      return;
    }
    let active = true;
    designCaseService
      .getDetail(last)
      .then((detail) => {
        if (!active) return;
        if (detail) {
          setCaseIdState(detail.case.id);
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

  const setCaseId = useCallback((id: string) => {
    setCaseIdState(id);
    saveHandlersRef.current.clear();
    setDirty(false);
    saveToStorage(STORAGE_KEY, id);
  }, []);

  const registerSaveHandler = useCallback(
    (id: string, handler: (() => Promise<void>) | null) => {
      if (handler) saveHandlersRef.current.set(id, handler);
      else saveHandlersRef.current.delete(id);
      setDirty(saveHandlersRef.current.size > 0);
    },
    [],
  );

  const runSaveHandler = useCallback(async () => {
    await Promise.all(
      Array.from(saveHandlersRef.current.values()).map((fn) => fn()),
    );
  }, []);

  return (
    <ActiveCaseContext.Provider
      value={{
        caseId,
        setCaseId,
        loading,
        dirty,
        registerSaveHandler,
        runSaveHandler,
      }}
    >
      {children}
    </ActiveCaseContext.Provider>
  );
}

export function useActiveCase() {
  const ctx = useContext(ActiveCaseContext);
  if (!ctx) {
    throw new Error("useActiveCase must be used within an ActiveCaseProvider");
  }
  return ctx;
}

/**
 * `useActiveCase().caseId`, except when `suppress` is true: the one 案件
 * this hook instance first sees once the async localStorage restore
 * settles is treated as unselected — it was left active by browsing
 * elsewhere, not something the user just picked in the screen calling this
 * — until it genuinely changes (a real pick, here or elsewhere), after
 * which this behaves exactly like the raw `caseId` for the rest of this
 * mount. `suppress=false` is a complete no-op (always returns the raw
 * `caseId`), so passing it selectively (e.g. only 設計依頼書/製作依頼書) never
 * touches the app-wide "stays active across modules" behavior everywhere
 * else. Two instances called with the same `suppress` value in the same
 * render pass (e.g. a page and the CaseSelector it renders) converge on the
 * same result independently — both watch the same context value with the
 * same rule, no coordination needed.
 */
export function useEffectiveCaseId(suppress: boolean): string {
  const { caseId, loading } = useActiveCase();
  const [suppressing, setSuppressing] = useState(suppress);
  const capturedRef = useRef(false);
  const staleValueRef = useRef("");

  useEffect(() => {
    if (!suppress) {
      setSuppressing(false);
      return;
    }
    if (capturedRef.current || loading) return;
    capturedRef.current = true;
    staleValueRef.current = caseId;
    setSuppressing(!!caseId);
  }, [suppress, loading, caseId]);

  useEffect(() => {
    if (suppressing && caseId !== staleValueRef.current) setSuppressing(false);
  }, [suppressing, caseId]);

  return suppressing ? "" : caseId;
}
