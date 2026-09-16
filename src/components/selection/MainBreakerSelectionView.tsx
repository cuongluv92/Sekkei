"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { calculationRecordService, mainBreakerSelectionService } from "@/lib/services";
import { matchMainBreakerSelection } from "@/lib/calc/motorSelection/matching";
import { branchItemCurrentA, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE } from "./MotorBranchSelectionView";
import { mitsubishiMainMotorRating } from "@/lib/calc/motorSelection/breakerCatalog";
import type { MainBreakerSelection, MotorSelectionBranchItem, SelectionVoltageClass } from "@/lib/types";

const VOLTAGE_CLASSES: SelectionVoltageClass[] = ["100V", "200V", "400V"];
function breakerCandidate(ratedA: number, isFuji: boolean, elcb: boolean) {
  if (isFuji) {
    if (ratedA <= 50) return { model: `${elcb ? "EW" : "BW"}50SAG`, icu: 10 };
    if (ratedA <= 125) return { model: `${elcb ? "EW" : "BW"}125JAG`, icu: 36 };
    if (ratedA <= 250) return { model: `${elcb ? "EW" : "BW"}250JAG`, icu: 36 };
    if (ratedA <= 400) return { model: `${elcb ? "EW" : "BW"}400RAG`, icu: 50 };
    return { model: `${elcb ? "EW" : "BW"} G-TWIN`, icu: null };
  }
  if (ratedA <= 60) return { model: `${elcb ? "NV" : "NF"}63-CV`, icu: 7.5 };
  if (ratedA <= 125) return { model: `${elcb ? "NV" : "NF"}125-CV`, icu: 30 };
  if (ratedA <= 250) return { model: `${elcb ? "NV" : "NF"}250-CV`, icu: 36 };
  if (ratedA <= 400) return { model: `${elcb ? "NV" : "NF"}400-CW`, icu: 50 };
  return { model: `${elcb ? "NV" : "NF"}-CW`, icu: null };
}

interface Props {
  caseId: string;
  compact?: boolean;
}

/**
 * 選定 > 幹線(一次側) — 分岐(電動機回路)タブで案件ごとに保存した回路の
 * 電流を自動集計し (または手入力の総電流で上書きし)、主幹選定マスタ
 * (mainBreakerSelectionService) から主幹ブレーカーを選定する。
 */
export function MainBreakerSelectionView({ caseId, compact = false }: Props) {
  const { t, locale } = useTranslation();
  const [master, setMaster] = useState<MainBreakerSelection[]>([]);
  const [, forceRerender] = useState(0);
  const [branchTotal, setBranchTotal] = useState<number | null>(null);
  const [branchItems, setBranchItems] = useState<MotorSelectionBranchItem[]>([]);
  const [manufacturerId, setManufacturerId] = useState("");
  const [voltageClass, setVoltageClass] = useState<SelectionVoltageClass>("200V");
  const [totalCurrentRaw, setTotalCurrentRaw] = useState("");
  const [additionalCurrentRaw, setAdditionalCurrentRaw] = useState("");
  const [result, setResult] = useState<MainBreakerSelection | null | undefined>(undefined);

  useEffect(() => {
    preloadManufacturers().then(() => {
      forceRerender((v) => v + 1);
      const preferred = listManufacturers().find((maker) => maker.name === "三菱電機");
      if (preferred) setManufacturerId((current) => current || preferred.id);
    });
    mainBreakerSelectionService.list().then(setMaster);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBranchTotal = () => {
      setBranchTotal(null);
      if (!caseId) { setBranchTotal(0); setBranchItems([]); return; }
      calculationRecordService.get(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE).then((record) => {
        if (cancelled) return;
        const items = (record?.result.items as MotorSelectionBranchItem[] | undefined) ?? [];
        setBranchItems(items);
        const sum = items.reduce((s, item) => {
          const current = branchItemCurrentA(item);
          return current != null ? s + current : s;
        }, 0);
        setBranchTotal(sum);
      });
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ caseId?: string; items?: MotorSelectionBranchItem[] }>).detail;
      if (detail?.items && (detail.caseId ?? "") === caseId) {
        setBranchItems(detail.items);
        setBranchTotal(detail.items.reduce((sum, item) => sum + (branchItemCurrentA(item) ?? 0), 0));
      } else if (!detail?.caseId || detail.caseId === caseId) loadBranchTotal();
    };
    loadBranchTotal();
    window.addEventListener("motor-branches-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("motor-branches-updated", handleUpdate);
    };
  }, [caseId]);

  const additionalCurrent = Number(additionalCurrentRaw);
  const compactTotal = branchTotal ?? 0;
  const motorKwItems = branchItems.filter((item) => item.inputUnit === "kW" && item.inputValue > 0);
  const mixedLoadCurrent = branchItems.filter((item) => item.inputUnit === "A").reduce((sum, item) => sum + item.inputValue, 0);
  const totalMotorKw = motorKwItems.reduce((sum, item) => sum + item.inputValue, 0);
  const largestMotorKw = motorKwItems.reduce((max, item) => Math.max(max, item.inputValue), 0);
  const catalogMainRating = (voltageClass === "200V" || voltageClass === "400V") && totalMotorKw > 0
    ? mitsubishiMainMotorRating(voltageClass, totalMotorKw, largestMotorKw, compactTotal) : null;
  const fallbackRating = catalogMainRating;

  useEffect(() => {
    if (!compact || !manufacturerId || compactTotal <= 0) {
      if (compact) setResult(undefined);
      return;
    }
    setResult(matchMainBreakerSelection({ manufacturerId, voltageClass, totalCurrent: compactTotal }, master));
  }, [compact, manufacturerId, voltageClass, compactTotal, master]);

  const manufacturers = listManufacturers();
  const selectedMaker = manufacturers.find((maker) => maker.id === manufacturerId);
  const isFuji = selectedMaker?.name === "富士電機";
  const mccbCandidate = fallbackRating ? breakerCandidate(fallbackRating, isFuji, false) : null;
  const elcbCandidate = fallbackRating ? breakerCandidate(fallbackRating, isFuji, true) : null;

  function handleCalculate() {
    const totalCurrent = Number(totalCurrentRaw);
    if (!manufacturerId || !Number.isFinite(totalCurrent) || totalCurrent <= 0) return;
    setResult(matchMainBreakerSelection({ manufacturerId, voltageClass, totalCurrent }, master));
  }

  const canCalculate = manufacturerId !== "" && totalCurrentRaw.trim() !== "" && Number(totalCurrentRaw) > 0;

  if (compact) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <div><label className="field-label">{t("motorSelection.manufacturerLabel")}</label><select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className="field-input"><option value="">{t("common.unsetManufacturer")}</option>{manufacturers.map((m) => <option key={m.id} value={m.id}>{locale === "vi" && m.nameVi ? m.nameVi : m.name}</option>)}</select></div>
          <div><label className="field-label">{t("motorSelection.voltageClassLabel")}</label><select value={voltageClass} onChange={(e) => setVoltageClass(e.target.value as SelectionVoltageClass)} className="field-input">{VOLTAGE_CLASSES.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px]"><span className="text-muted">全分岐電流合計：</span><span className="font-mono font-bold">{compactTotal.toFixed(1)} A</span>{mixedLoadCurrent > 0 && <div className="mt-1 text-warning">うち制御・その他 {mixedLoadCurrent.toFixed(1)} A</div>}</div>
        </div>
        <div className="flex min-h-36 items-center justify-center rounded-xl border-2 border-accent bg-accent/10 px-6 py-5 text-center">
          <div><div className="text-[15px] font-extrabold text-muted">主幹選定電流</div><div className="mt-2 font-mono text-[38px] font-black text-accent">{fallbackRating ? `${fallbackRating} A` : "—"}</div>{fallbackRating ? <div className="mt-2 text-[11px] text-muted">三菱 表4-9/4-10：合計 {totalMotorKw} kW・最大 {largestMotorKw} kW・最大使用電流 {compactTotal.toFixed(1)} A</div> : <div className="mt-2 text-[11px] text-warning">表4-9/4-10の登録範囲外です</div>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4"}>
      {!compact && <p className="text-[12px] text-muted">{t("motorSelection.main.description")}</p>}

      {caseId && branchTotal !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/10 px-3 py-2 text-[12px]">
            <span className="text-muted">{t("motorSelection.main.autoSumLabel")}</span>
            <span className="font-mono font-semibold">{branchTotal.toFixed(1)} A</span>
            {!compact && <button onClick={() => setTotalCurrentRaw(String(branchTotal))} className="btn-ghost ml-auto">{t("motorSelection.main.useAutoSumButton")}</button>}
          </div>
          <p className="text-[11px] text-muted-2">{t("motorSelection.main.autoSumHint")}</p>
        </div>
      )}

      {compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(170px,240px)_1fr] sm:items-end">
          <label>
            <span className="field-label">追加回路・制御回路 合計 (A)</span>
            <input className="field-input font-mono" type="number" min={0} step="any" value={additionalCurrentRaw} onChange={(e) => setAdditionalCurrentRaw(e.target.value)} placeholder="例）12.5" />
          </label>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px]">
            <span className="text-muted">分岐合計：</span>
            <span className="font-mono font-bold">{(branchTotal ?? 0).toFixed(1)} + {(Number.isFinite(additionalCurrent) && additionalCurrent > 0 ? additionalCurrent : 0).toFixed(1)} = {compactTotal.toFixed(1)} A</span>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2.5 lg:items-end ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        <div>
          <label className="field-label">{t("motorSelection.manufacturerLabel")}</label>
          <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className="field-input">
            <option value="">{t("common.unsetManufacturer")}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {locale === "vi" && m.nameVi ? m.nameVi : m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("motorSelection.voltageClassLabel")}</label>
          <select
            value={voltageClass}
            onChange={(e) => setVoltageClass(e.target.value as SelectionVoltageClass)}
            className="field-input"
          >
            {VOLTAGE_CLASSES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {!compact && <div>
          <label className="field-label">{t("motorSelection.main.totalCurrentLabel")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={totalCurrentRaw}
            onChange={(e) => setTotalCurrentRaw(e.target.value)}
            placeholder={t("motorSelection.main.totalCurrentPlaceholder")}
            className="field-input"
          />
        </div>}
        {!compact && <button onClick={handleCalculate} disabled={!canCalculate} className="btn-primary">
          {t("motorSelection.main.calculateButton")}
        </button>}
      </div>

      <div>
        {!compact && <span className="panel-title">{t("motorSelection.main.resultTitle")}</span>}
        {compact && compactTotal > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border-2 border-accent bg-accent/10 px-5 py-4 text-center">
              <span className="text-[12px] font-bold text-muted">主幹選定電流</span>
              <div className="mt-1 font-mono text-[28px] font-black text-accent">{fallbackRating ? `${fallbackRating} A` : "800 A超"}</div>
              <div className="mt-1 text-[10px] text-muted">三菱 表4-9/4-10：合計 {totalMotorKw} kW・最大 {largestMotorKw} kW</div>
              {additionalCurrent > 0 && <div className="mt-1 text-[10px] text-warning">追加負荷 {additionalCurrent} A は混在負荷条件の確認が必要</div>}
            </div>
            <div className="rounded-lg border-2 border-accent/40 bg-background px-5 py-4">
              <span className="text-[12px] font-bold text-muted">主幹 MCCB</span>
              <div className="mt-1 font-mono text-[20px] font-extrabold text-accent">{result?.breakerModel || mccbCandidate?.model || (isFuji ? "BW G-TWIN" : "NF-CV")} / {result ? `${result.ratedCurrent} A` : fallbackRating ? `${fallbackRating} A` : "800 A超・個別選定"}</div>
              {!result && mccbCandidate?.icu && <div className="mt-1 text-[10px] text-muted">Icu {mccbCandidate.icu} kA（AC200/230V）</div>}
            </div>
            <div className="rounded-lg border-2 border-accent/40 bg-background px-5 py-4">
              <span className="text-[12px] font-bold text-muted">主幹 ELCB</span>
              <div className="mt-1 font-mono text-[20px] font-extrabold text-accent">{elcbCandidate?.model || (isFuji ? "EW G-TWIN" : "NV-CV")} / {result ? `${result.ratedCurrent} A` : fallbackRating ? `${fallbackRating} A` : "800 A超・個別選定"}</div>
              {!result && elcbCandidate?.icu && <div className="mt-1 text-[10px] text-muted">Icu {elcbCandidate.icu} kA（AC200/230V）・感度電流は別選択</div>}
            </div>
          </div>
        ) : result === undefined ? (
          <p className="mt-2 text-[12px] text-muted-2">{t("motorSelection.main.resultEmpty")}</p>
        ) : result === null ? (
          <p className="mt-2 text-[12px] text-warning">{t("motorSelection.main.notMatched")}</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <span className="text-muted">{t("motorSelection.main.resultBreaker")}</span>
              <div className="font-mono font-semibold">{result.breakerModel}</div>
            </div>
            <div>
              <span className="text-muted">{t("motorSelection.main.resultPoles")}</span>
              <div className="font-mono font-semibold">{result.poles || "—"}</div>
            </div>
            <div>
              <span className="text-muted">{t("motorSelection.main.resultWireSize")}</span>
              <div className="font-mono font-semibold">{result.wireSize || "—"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
