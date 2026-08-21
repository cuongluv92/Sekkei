"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { selectionRuleService } from "@/lib/services/selectionRuleService";
import type { SelectionOutputKey, SelectionRule } from "@/lib/types";

const OUTPUT_KEYS: SelectionOutputKey[] = [
  "breaker",
  "am",
  "magneticContactor",
  "wireSize",
  "terminalBlock",
  "other",
];

type DraftRule = Omit<SelectionRule, "id" | "order">;

function emptyDraft(): DraftRule {
  return { outputKey: "breaker", unit: "kW", minValue: 0, maxValue: 0, resultValue: "", remarks: "", enabled: true };
}

/** RuleRepository CRUD UI — the only place 選定 rules are entered; the engine never invents a value outside this table. */
export function SelectionRuleSettings() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<SelectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftRule>(emptyDraft());

  function load() {
    selectionRuleService.list().then((list) => {
      setRules(list);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleAdd() {
    if (!draft.resultValue.trim() || !draft.unit.trim()) return;
    await selectionRuleService.create(draft);
    setDraft(emptyDraft());
    load();
  }

  async function handleToggle(id: string) {
    await selectionRuleService.toggleEnabled(id);
    load();
  }

  async function handleRemove(id: string) {
    await selectionRuleService.remove(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("selectionSettings.description")}</p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>{t("selectionSettings.columns.outputKey")}</th>
              <th style={{ width: "90px" }}>{t("selectionSettings.columns.unit")}</th>
              <th style={{ width: "90px" }}>{t("selectionSettings.columns.minValue")}</th>
              <th style={{ width: "90px" }}>{t("selectionSettings.columns.maxValue")}</th>
              <th style={{ width: "180px" }}>{t("selectionSettings.columns.resultValue")}</th>
              <th>{t("selectionSettings.columns.remarks")}</th>
              <th style={{ width: "160px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-2">
                  {t("selectionSettings.emptyList")}
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className={r.enabled ? "" : "text-muted-2"}>{t(`selection.outputs.${r.outputKey}`)}</td>
                  <td className={r.enabled ? "" : "text-muted-2"}>{r.unit}</td>
                  <td className={r.enabled ? "" : "text-muted-2"}>{r.minValue}</td>
                  <td className={r.enabled ? "" : "text-muted-2"}>{r.maxValue}</td>
                  <td className={r.enabled ? "font-mono" : "font-mono text-muted-2"}>{r.resultValue}</td>
                  <td className="text-muted">{r.remarks || "—"}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleToggle(r.id)} className="btn-ghost">
                        {r.enabled ? t("selectionSettings.disableButton") : t("selectionSettings.enableButton")}
                      </button>
                      <button
                        onClick={() => handleRemove(r.id)}
                        className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
        <div>
          <label className="field-label">{t("selectionSettings.columns.outputKey")}</label>
          <select
            value={draft.outputKey}
            onChange={(e) => setDraft({ ...draft, outputKey: e.target.value as SelectionOutputKey })}
            className="field-input"
          >
            {OUTPUT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`selection.outputs.${key}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("selectionSettings.columns.unit")}</label>
          <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">{t("selectionSettings.columns.minValue")}</label>
          <input
            type="number"
            value={draft.minValue}
            onChange={(e) => setDraft({ ...draft, minValue: Number(e.target.value) })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("selectionSettings.columns.maxValue")}</label>
          <input
            type="number"
            value={draft.maxValue}
            onChange={(e) => setDraft({ ...draft, maxValue: Number(e.target.value) })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("selectionSettings.columns.resultValue")}</label>
          <input
            value={draft.resultValue}
            onChange={(e) => setDraft({ ...draft, resultValue: e.target.value })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("selectionSettings.columns.remarks")}</label>
          <input
            value={draft.remarks}
            onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
            className="field-input"
          />
        </div>
        <button onClick={handleAdd} disabled={!draft.resultValue.trim() || !draft.unit.trim()} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("selectionSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
