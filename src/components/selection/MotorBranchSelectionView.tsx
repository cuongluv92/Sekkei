"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { calculationRecordService, motorStarterSelectionService } from "@/lib/services";
import { matchMotorStarterSelection } from "@/lib/calc/motorSelection/matching";
import type { MotorSelectionBranchItem, MotorStarterSelection, SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

/** Shared with MainBreakerSelectionView so 幹線 can read the same 案件's saved 分岐 list. */
export const MOTOR_SELECTION_BRANCH_CALCULATION_TYPE = "motor-selection-branch";

const VOLTAGE_CLASSES: SelectionVoltageClass[] = ["100V", "200V", "400V"];
const CIRCUIT_TYPES: SelectionCircuitType[] = ["direct", "starDelta", "inverter"];

/** A branch's contribution to 幹線 total current — its matched master row's rated current, or the raw input when the user entered A directly and nothing matched. null when neither is available (kW input with no match: nothing to sum safely). */
export function branchItemCurrentA(item: MotorSelectionBranchItem): number | null {
  if (item.matchedRow) return item.matchedRow.ratedCurrent;
  if (item.inputUnit === "A") return item.inputValue;
  return null;
}

interface Props {
  caseId: string;
}

/**
 * 選定 > 分岐(電動機回路) — kW/A + メーカー・電圧クラス・回路方式を入力すると
 * 電動機回路選定マスタ (motorStarterSelectionService) から一致する行を検索し、
 * ブレーカー→CT→AM→電磁開閉器・電磁接触器(またはインバーター)→電線サイズを
 * まとめて表示する。案件ごとに calculationRecordService へ保存する
 * (専用テーブルは持たない — 部品製作のような独立管理は不要なシンプルな
 * リストのため)。一致しない場合は値を捏造せず「未登録」の警告を出す。
 */
export function MotorBranchSelectionView({ caseId }: Props) {
  const { t, locale } = useTranslation();
  const [master, setMaster] = useState<MotorStarterSelection[]>([]);
  const [items, setItems] = useState<MotorSelectionBranchItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, forceRerender] = useState(0);

  const [label, setLabel] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [voltageClass, setVoltageClass] = useState<SelectionVoltageClass>("200V");
  const [circuitType, setCircuitType] = useState<SelectionCircuitType>("direct");
  const [inputUnit, setInputUnit] = useState<"kW" | "A">("kW");
  const [inputValueRaw, setInputValueRaw] = useState("");

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    motorStarterSelectionService.list().then(setMaster);
  }, []);

  useEffect(() => {
    setItemsLoaded(false);
    if (!caseId) {
      setItems([]);
      setItemsLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const saved = (record?.result.items as MotorSelectionBranchItem[] | undefined) ?? [];
      setItems(saved);
      setItemsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const manufacturers = listManufacturers();

  function manufacturerName(id: string): string {
    const m = manufacturers.find((mm) => mm.id === id);
    if (!m) return id;
    return locale === "vi" && m.nameVi ? m.nameVi : m.name;
  }

  async function persist(nextItems: MotorSelectionBranchItem[]) {
    setItems(nextItems);
    if (!caseId) return;
    setSaving(true);
    try {
      await calculationRecordService.save(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE, {}, { items: nextItems });
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    const inputValue = Number(inputValueRaw);
    if (!manufacturerId || !Number.isFinite(inputValue) || inputValue <= 0) return;
    const matchedRow = matchMotorStarterSelection({ manufacturerId, voltageClass, circuitType, inputUnit, inputValue }, master);
    const item: MotorSelectionBranchItem = {
      id: crypto.randomUUID(),
      label: label.trim(),
      manufacturerId,
      voltageClass,
      circuitType,
      inputUnit,
      inputValue,
      matched: matchedRow !== null,
      matchedRow: matchedRow ?? undefined,
    };
    void persist([...items, item]);
    setLabel("");
    setInputValueRaw("");
  }

  function handleRemove(id: string) {
    void persist(items.filter((i) => i.id !== id));
  }

  const totalCurrent = useMemo(() => {
    return items.reduce((sum, item) => {
      const current = branchItemCurrentA(item);
      return current != null ? sum + current : sum;
    }, 0);
  }, [items]);

  const canAdd = manufacturerId !== "" && inputValueRaw.trim() !== "" && Number(inputValueRaw) > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{t("motorSelection.branch.description")}</p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <div>
          <label className="field-label">{t("motorSelection.branch.labelLabel")}</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("motorSelection.branch.labelPlaceholder")}
            className="field-input"
          />
        </div>
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
          <label className="field-label">{t("motorSelection.circuitTypeLabel")}</label>
          <select value={circuitType} onChange={(e) => setCircuitType(e.target.value as SelectionCircuitType)} className="field-input">
            {CIRCUIT_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`motorSelection.circuitTypes.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("motorSelection.branch.inputLabel")}</label>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              step="any"
              value={inputValueRaw}
              onChange={(e) => setInputValueRaw(e.target.value)}
              placeholder={t("motorSelection.branch.inputPlaceholder")}
              className="field-input"
            />
            <select value={inputUnit} onChange={(e) => setInputUnit(e.target.value as "kW" | "A")} className="field-input w-20">
              <option value="kW">{t("motorSelection.branch.inputUnitKw")}</option>
              <option value="A">{t("motorSelection.branch.inputUnitA")}</option>
            </select>
          </div>
        </div>
        <button onClick={handleAdd} disabled={!canAdd} className="btn-primary">
          <Plus className="h-3.5 w-3.5" />
          {t("motorSelection.branch.addButton")}
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="panel-title">{t("motorSelection.branch.resultTitle")}</span>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}
        </div>
        <div className="data-table-wrap mt-2">
          <table className="data-table" style={{ minWidth: 1240 }}>
            <thead>
              <tr>
                <th style={{ width: "120px" }}>{t("motorSelection.branch.columns.label")}</th>
                <th style={{ width: "110px" }}>{t("motorSelection.branch.columns.maker")}</th>
                <th style={{ width: "70px" }}>{t("motorSelection.branch.columns.voltage")}</th>
                <th style={{ width: "90px" }}>{t("motorSelection.branch.columns.circuit")}</th>
                <th style={{ width: "90px" }} className="text-right">
                  {t("motorSelection.branch.columns.input")}
                </th>
                <th style={{ width: "140px" }}>{t("motorSelection.branch.columns.breaker")}</th>
                <th style={{ width: "110px" }}>{t("motorSelection.branch.columns.ct")}</th>
                <th style={{ width: "90px" }}>{t("motorSelection.branch.columns.am")}</th>
                <th style={{ width: "150px" }}>{t("motorSelection.branch.columns.contactor")}</th>
                <th style={{ width: "110px" }}>{t("motorSelection.branch.columns.wireSize")}</th>
                <th style={{ width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {!itemsLoaded ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-2">
                    {t("motorSelection.branch.resultEmpty")}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.label || "—"}</td>
                      <td>{manufacturerName(item.manufacturerId)}</td>
                      <td>{item.voltageClass}</td>
                      <td>{t(`motorSelection.circuitTypes.${item.circuitType}`)}</td>
                      <td className="text-right font-mono">
                        {item.inputValue}
                        {item.inputUnit}
                      </td>
                      <td className="font-mono text-[12px]">{item.matchedRow?.breakerModel || "—"}</td>
                      <td className="font-mono text-[12px]">{item.matchedRow?.ctModel || item.matchedRow?.ctRatio || "—"}</td>
                      <td className="font-mono text-[12px]">{item.matchedRow?.amRange || "—"}</td>
                      <td className="font-mono text-[12px]">
                        {item.matchedRow?.inverterModel || item.matchedRow?.contactorModel || "—"}
                      </td>
                      <td className="font-mono text-[12px]">{item.matchedRow?.wireSize || "—"}</td>
                      <td>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {!item.matched && (
                      <tr>
                        <td colSpan={11} className="bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                          {t("motorSelection.branch.notMatched")}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {t("motorSelection.branch.totalCurrentLabel")}: <span className="font-mono font-semibold">{totalCurrent.toFixed(1)} A</span>
        </p>
      </div>
    </div>
  );
}
