"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { CUSTOM_ICONS, useNavSettings, type CustomNavItem } from "@/lib/store/NavSettingsProvider";

const ICON_KEYS = Object.keys(CUSTOM_ICONS) as (keyof typeof CUSTOM_ICONS)[];

export function MenuManagement() {
  const { t } = useTranslation();
  const { allEntries, renameItem, toggleHidden, addCustomItem, removeCustomItem, moveItem } =
    useNavSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState<CustomNavItem["icon"]>(ICON_KEYS[0]);

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setDraftLabel(current);
  }

  function saveEdit() {
    if (editingId && draftLabel.trim()) {
      renameItem(editingId, draftLabel.trim());
    }
    setEditingId(null);
  }

  function handleAdd() {
    if (!newLabel.trim()) return;
    addCustomItem(newLabel.trim(), newIcon);
    setNewLabel("");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("settings.menuDescription")}</p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ width: "70px" }} />
              <th>{t("common.name")}</th>
              <th style={{ width: "100px" }}>{t("settings.itemType")}</th>
              <th style={{ width: "220px" }} />
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry, index) => {
              const Icon = entry.Icon;
              return (
                <tr key={entry.id}>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveItem(entry.id, "up")}
                        disabled={index === 0}
                        className="btn-ghost btn-icon"
                        aria-label="move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveItem(entry.id, "down")}
                        disabled={index === allEntries.length - 1}
                        className="btn-ghost btn-icon"
                        aria-label="move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      {editingId === entry.id ? (
                        <input
                          autoFocus
                          value={draftLabel}
                          onChange={(e) => setDraftLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={saveEdit}
                          className="field-input py-1"
                        />
                      ) : (
                        <span className={entry.hidden ? "text-muted-2" : "text-foreground"}>
                          {entry.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={entry.isCustom ? "badge-info" : "badge-neutral"}>
                      {entry.isCustom ? t("settings.typeCustom") : t("settings.typeBuiltIn")}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === entry.id ? (
                        <button onClick={saveEdit} className="btn-ghost btn-icon">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(entry.id, entry.label)}
                          className="btn-ghost btn-icon"
                          title={t("settings.rename")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!entry.isCustom && (
                        <button
                          onClick={() => toggleHidden(entry.id)}
                          className="btn-ghost btn-icon"
                          title={entry.hidden ? t("settings.show") : t("settings.hide")}
                        >
                          {entry.hidden ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {entry.isCustom && (
                        <button
                          onClick={() => removeCustomItem(entry.id)}
                          className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                          title={t("settings.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <select
          value={newIcon}
          onChange={(e) => setNewIcon(e.target.value as CustomNavItem["icon"])}
          className="field-input w-auto"
        >
          {ICON_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={t("settings.itemNamePlaceholder")}
          className="field-input max-w-xs"
        />
        <button onClick={handleAdd} disabled={!newLabel.trim()} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("settings.addMenuItem")}
        </button>
      </div>
    </div>
  );
}
