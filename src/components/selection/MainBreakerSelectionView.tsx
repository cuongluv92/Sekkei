"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { calculationRecordService, mainBreakerSelectionService } from "@/lib/services";
import { matchMainBreakerSelection } from "@/lib/calc/motorSelection/matching";
import { branchItemCurrentA, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE } from "./MotorBranchSelectionView";
import type { MainBreakerSelection, MotorSelectionBranchItem, SelectionVoltageClass } from "@/lib/types";

const VOLTAGE_CLASSES: SelectionVoltageClass[] = ["100V", "200V", "400V"];

interface Props {
  caseId: string;
}

/**
 * 選定 > 幹線(一次側) — 分岐(電動機回路)タブで案件ごとに保存した回路の
 * 電流を自動集計し (または手入力の総電流で上書きし)、主幹選定マスタ
 * (mainBreakerSelectionService) から主幹ブレーカーを選定する。
 */
export function MainBreakerSelectionView({ caseId }: Props) {
  const { t, locale } = useTranslation();
  const [master, setMaster] = useState<MainBreakerSelection[]>([]);
  const [, forceRerender] = useState(0);
  const [branchTotal, setBranchTotal] = useState<number | null>(null);
  const [manufacturerId, setManufacturerId] = useState("");
  const [voltageClass, setVoltageClass] = useState<SelectionVoltageClass>("200V");
  const [totalCurrentRaw, setTotalCurrentRaw] = useState("");
  const [result, setResult] = useState<MainBreakerSelection | null | undefined>(undefined);

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    mainBreakerSelectionService.list().then(setMaster);
  }, []);

  useEffect(() => {
    setBranchTotal(null);
    if (!caseId) return;
    let cancelled = false;
    calculationRecordService.get(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const items = (record?.result.items as MotorSelectionBranchItem[] | undefined) ?? [];
      const sum = items.reduce((s, item) => {
        const current = branchItemCurrentA(item);
        return current != null ? s + current : s;
      }, 0);
      setBranchTotal(sum);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const manufacturers = listManufacturers();

  function handleCalculate() {
    const totalCurrent = Number(totalCurrentRaw);
    if (!manufacturerId || !Number.isFinite(totalCurrent) || totalCurrent <= 0) return;
    setResult(matchMainBreakerSelection({ manufacturerId, voltageClass, totalCurrent }, master));
  }

  const canCalculate = manufacturerId !== "" && totalCurrentRaw.trim() !== "" && Number(totalCurrentRaw) > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{t("motorSelection.main.description")}</p>

      {caseId && branchTotal !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/10 px-3 py-2 text-[12px]">
            <span className="text-muted">{t("motorSelection.main.autoSumLabel")}</span>
            <span className="font-mono font-semibold">{branchTotal.toFixed(1)} A</span>
            <button onClick={() => setTotalCurrentRaw(String(branchTotal))} className="btn-ghost ml-auto">
              {t("motorSelection.main.useAutoSumButton")}
            </button>
          </div>
          <p className="text-[11px] text-muted-2">{t("motorSelection.main.autoSumHint")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:items-end">
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
        <div>
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
        </div>
        <button onClick={handleCalculate} disabled={!canCalculate} className="btn-primary">
          {t("motorSelection.main.calculateButton")}
        </button>
      </div>

      <div>
        <span className="panel-title">{t("motorSelection.main.resultTitle")}</span>
        {result === undefined ? (
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
