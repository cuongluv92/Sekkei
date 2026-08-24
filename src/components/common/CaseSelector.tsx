"use client";

import { Check, Loader2, Plus, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { useActiveCase, useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import {
  buildCaseOptionLabel,
  buildCaseOptions,
  matchesCaseOptionQuery,
  type CaseOption,
} from "@/lib/utils/caseSearch";
import { NewCaseModal } from "@/components/common/NewCaseModal";
import { SavedCasesModal } from "@/components/common/SavedCasesModal";
import { Modal } from "@/components/common/Modal";
import type { DesignCase } from "@/lib/types/design";

/**
 * THE one 案件 picker shared by every 案件-scoped area of the app (設計管理,
 * 部品製作, 重量/盤重量/母線銅帯/換気/耐震/他計算) — same `design_cases` table, same
 * list, same UX everywhere. Reads/writes `useActiveCase()` directly so every
 * mounted instance always reflects (and can change) the one app-wide
 * current 案件 — no props needed.
 *
 * Collapsed by default to a plain "現在の案件：…" line + 変更/保存済み案件/選択解除
 * buttons so it never crowds the page; expands into the searchable list only
 * when changing. "＋ 新規案件" opens a real form (`NewCaseModal`) instead of
 * an always-visible inline input.
 *
 * Every mount starts on the picker, never silently preselected — the 案件
 * left active from browsing elsewhere only reappears once the user
 * genuinely picks one on THIS screen (see `useEffectiveCaseId`). Opening
 * any 案件-scoped screen (設計管理, every 計算 module) always means choosing a
 * 案件 explicitly first, never resuming whatever was last open somewhere
 * else — except when the caller passes `suppress={false}` (currently only
 * 部品製作, whose edits save immediately with no unsaved-edit risk from
 * resuming the active 案件 without an extra pick).
 *
 * Switching away from a 案件 (変更/選択解除/開くfrom 保存済み案件) while the
 * current screen has unsaved local edits (`dirty`) prompts
 * 未保存の変更があります。案件を変更しますか？ with 保存して変更/保存せず変更/キャンセル.
 *
 * "＋新規案件" is available from every call site — 案件 creation itself is
 * never restricted. What IS restricted is 図面番号 auto-numbering: only
 * 設計依頼 (設計管理) passes `autoNumberDrawingNumber`, letting
 * `NewCaseModal` auto-suggest the next 図面番号. Every other call site
 * (部品製作, 計算 modules, ...) leaves it `false`, so the modal instead asks
 * the user to type 図面番号 by hand — creating a 案件 is still possible
 * anywhere, only the auto-suggested number is 設計依頼-only.
 */
export function CaseSelector({
  autoNumberDrawingNumber = false,
  suppress = true,
}: {
  autoNumberDrawingNumber?: boolean;
  /** Pass `false` to show the already-active 案件 immediately instead of forcing a fresh pick on every mount — see `useEffectiveCaseId`. Defaults to `true` (existing behavior) for every caller except 部品製作. */
  suppress?: boolean;
} = {}) {
  const { t } = useTranslation();
  const { setCaseId, dirty, runSaveHandler } = useActiveCase();
  const caseId = useEffectiveCaseId(suppress);
  const [options, setOptions] = useState<CaseOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Always starts collapsed — even with no 案件 selected yet — so this
  // widget stays a small corner control instead of permanently occupying
  // the page with a full search+list. Picking only opens on an explicit
  // click (案件を選ぶ/変更), same as switching away from an already-selected
  // 案件; the list itself is already scrollable (max-h-64) so this also
  // covers 100+ 案件 without ever growing the page.
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showSavedCasesModal, setShowSavedCasesModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [savingBeforeSwitch, setSavingBeforeSwitch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    designCaseService.listAll().then((all) => {
      setOptions(buildCaseOptions(all));
      setLoaded(true);
    });
  }, []);

  // Keep the displayed label in sync with `caseId` when it changes for a
  // reason other than a local click here — restored on mount, changed by
  // another mounted CaseSelector, or cleared.
  useEffect(() => {
    if (!caseId) {
      setSelectedLabel(null);
      return;
    }
    const match = options.find((o) => o.caseId === caseId);
    if (match) setSelectedLabel(buildCaseOptionLabel(match));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, options]);

  // Once a 案件 becomes active (restored, or picked just now), collapse back
  // to the compact "現在の案件" display.
  useEffect(() => {
    if (caseId) setPicking(false);
  }, [caseId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPicking(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => matchesCaseOptionQuery(o, q));
  }, [options, query]);

  /** Runs `action` immediately, unless the active screen has unsaved edits — then it's deferred behind the 未保存の変更 confirmation. */
  function guardedSwitch(action: () => void) {
    if (dirty) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  function handleSelect(option: CaseOption) {
    guardedSwitch(() => {
      setSelectedLabel(buildCaseOptionLabel(option));
      setCaseId(option.caseId);
      setQuery("");
      setPicking(false);
    });
  }

  function handleDeselect() {
    guardedSwitch(() => {
      setSelectedLabel(null);
      setCaseId("");
      setQuery("");
      setPicking(false);
    });
  }

  function handleOpenFromSaved(nextCaseId: string) {
    guardedSwitch(() => {
      setCaseId(nextCaseId);
      setShowSavedCasesModal(false);
      setPicking(false);
    });
  }

  function handleCreated(created: DesignCase) {
    const option: CaseOption = {
      caseId: created.id,
      case: created,
      panels: [],
    };
    setOptions((prev) =>
      [...prev, option].sort((a, b) =>
        a.case.drawingNumber.localeCompare(b.case.drawingNumber, "ja"),
      ),
    );
    setSelectedLabel(buildCaseOptionLabel(option));
    setCaseId(created.id);
    setShowNewCaseModal(false);
    setPicking(false);
  }

  async function handleSaveAndSwitch() {
    if (!pendingAction) return;
    setSavingBeforeSwitch(true);
    try {
      await runSaveHandler();
    } finally {
      setSavingBeforeSwitch(false);
    }
    const action = pendingAction;
    setPendingAction(null);
    action();
  }

  function handleSwitchWithoutSaving() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    action();
  }

  const currentLabel = caseId
    ? (selectedLabel ??
      (loaded ? t("caseSelector.caseNotFound") : t("common.loading")))
    : null;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
    >
      {!picking ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t("caseSelector.currentCaseLabel")}
              {caseId &&
                (dirty ? (
                  <span className="normal-case text-warning">
                    ● {t("caseSelector.unsavedBadge")}
                  </span>
                ) : (
                  <span className="normal-case text-success">
                    ✓ {t("caseSelector.savedBadge")}
                  </span>
                ))}
            </div>
            <div className="truncate text-[14px] font-bold text-foreground">
              {caseId ? currentLabel : t("caseSelector.noCaseSelected")}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {caseId ? (
              <>
                <button
                  onClick={() => guardedSwitch(() => setPicking(true))}
                  className="btn-secondary"
                >
                  {t("caseSelector.changeCase")}
                </button>
                <button
                  onClick={() => setShowSavedCasesModal(true)}
                  className="btn-secondary"
                >
                  {t("caseSelector.savedCasesButton")}
                </button>
                <button
                  onClick={handleDeselect}
                  className="btn-ghost"
                  title={t("caseSelector.deselectCase")}
                >
                  <X className="h-3.5 w-3.5" />
                  {t("caseSelector.deselectCase")}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setPicking(true)} className="btn-secondary">
                  {t("caseSelector.selectCaseButton")}
                </button>
                <button onClick={() => setShowNewCaseModal(true)} className="btn-ghost">
                  <Plus className="h-3.5 w-3.5" />
                  {t("caseSelector.newCaseButton")}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("caseSelector.searchPlaceholder")}
              className="field-input pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border-strong bg-surface-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12.5px] text-muted-2">
                {loaded ? t("caseSelector.noCases") : t("common.loading")}
              </div>
            ) : (
              filtered.map((option) => {
                const isCurrent = option.caseId === caseId;
                return (
                  <button
                    key={option.caseId}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
                  >
                    {isCurrent && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                    )}
                    <span className="truncate">
                      {buildCaseOptionLabel(option)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="btn-ghost"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("caseSelector.newCaseButton")}
            </button>
            <button onClick={() => setPicking(false)} className="btn-ghost">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onCreated={handleCreated}
          autoNumberDrawingNumber={autoNumberDrawingNumber}
        />
      )}

      {showSavedCasesModal && (
        <SavedCasesModal
          onClose={() => setShowSavedCasesModal(false)}
          onOpen={handleOpenFromSaved}
        />
      )}

      {pendingAction && (
        <Modal
          title={t("caseSelector.unsavedTitle")}
          onClose={() => setPendingAction(null)}
          widthClassName="max-w-md"
        >
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] text-foreground">
              {t("caseSelector.unsavedMessage")}
            </p>
            <div className="flex flex-col items-stretch gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setPendingAction(null)}
                className="btn-secondary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSwitchWithoutSaving}
                className="btn-secondary"
              >
                {t("caseSelector.switchWithoutSaving")}
              </button>
              <button
                onClick={handleSaveAndSwitch}
                disabled={savingBeforeSwitch}
                className="btn-primary"
              >
                {savingBeforeSwitch && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {t("caseSelector.saveAndSwitch")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
