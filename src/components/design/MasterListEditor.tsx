"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { masterListService } from "@/lib/services/design";
import type { MasterListItem } from "@/lib/types/design";

const MASTER_LIST_KEYS = [
  "requestType",
  "orderer",
  "customerContact",
  "panelStructure",
  "faceCount",
  "location",
  "installation",
  "structure",
  "material",
  "color",
  "gloss",
  "handleLocation",
  "handleType",
  "keyNo",
  "wireEntry",
  "opening",
  "blankPlate",
  "electricalMethod",
  "powerSource",
  "voltage",
  "terminalBlock",
  "current",
  "breakingCapacity",
  "frequency",
  "controlVoltage",
  "protectionRating",
] as const;

/**
 * Generic editor for every 設計管理 master list (dropdown/combobox candidate
 * values). Nothing here is specific to one field — pick a list, then
 * add/rename/reorder/enable-disable its values. Used by every SpecCombobox
 * and select in 設計管理 via `masterListService`.
 */
export function MasterListEditor() {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string>(MASTER_LIST_KEYS[0]);
  const [items, setItems] = useState<MasterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    load(selectedKey);
  }, [selectedKey]);

  async function load(key: string) {
    setLoading(true);
    const list = await masterListService.listByKey(key, true);
    setItems(list);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newValue.trim()) return;
    await masterListService.add(selectedKey, newValue.trim());
    setNewValue("");
    load(selectedKey);
  }

  async function handleSaveEdit() {
    if (editingId && draft.trim()) {
      await masterListService.update(editingId, draft.trim());
    }
    setEditingId(null);
    load(selectedKey);
  }

  async function handleToggle(id: string) {
    await masterListService.toggleEnabled(id);
    load(selectedKey);
  }

  async function handleRemove(id: string) {
    await masterListService.remove(id);
    load(selectedKey);
  }

  async function handleMove(id: string, direction: "up" | "down") {
    await masterListService.move(id, direction);
    load(selectedKey);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("designSettings.description")}</p>

      <div className="max-w-xs">
        <label className="field-label">{t("designSettings.selectListLabel")}</label>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="field-input"
        >
          {MASTER_LIST_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`designSettings.lists.${key}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ width: "70px" }} />
              <th>{t("common.name")}</th>
              <th style={{ width: "190px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted-2">
                  {t("designSettings.emptyList")}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMove(item.id, "up")}
                        disabled={index === 0}
                        className="btn-ghost btn-icon"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(item.id, "down")}
                        disabled={index === items.length - 1}
                        className="btn-ghost btn-icon"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td>
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={handleSaveEdit}
                        className="field-input py-1"
                      />
                    ) : (
                      <span className={item.enabled ? "text-foreground" : "text-muted-2"}>
                        {item.value}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === item.id ? (
                        <button onClick={handleSaveEdit} className="btn-ghost btn-icon">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setDraft(item.value);
                          }}
                          className="btn-ghost btn-icon"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleToggle(item.id)} className="btn-ghost">
                        {item.enabled
                          ? t("designSettings.disableButton")
                          : t("designSettings.enableButton")}
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={t("designSettings.addValuePlaceholder")}
          className="field-input max-w-xs"
        />
        <button onClick={handleAdd} disabled={!newValue.trim()} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("designSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
