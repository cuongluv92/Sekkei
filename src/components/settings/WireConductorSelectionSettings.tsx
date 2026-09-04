"use client";

import { ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  wireConductorSelectionService,
  type WireConductorItemKind,
  type WireConductorSelectionDraft,
  type WireConductorSelectionRow,
  type WireConductorWireType,
} from "@/lib/services";

type TargetKey = "IV" | "WL1" | "busbar";

function targetToDraft(target: TargetKey): Pick<WireConductorSelectionDraft, "itemKind" | "wireType"> {
  if (target === "busbar") return { itemKind: "busbar", wireType: undefined };
  return { itemKind: "wire", wireType: target as WireConductorWireType };
}

function rowTarget(row: WireConductorSelectionRow): TargetKey {
  return row.itemKind === "busbar" ? "busbar" : row.wireType ?? "IV";
}

function emptyDraft(target: TargetKey = "IV"): WireConductorSelectionDraft {
  return {
    basisKind: "company",
    ...targetToDraft(target),
    currentA: 0,
    resultValue: "",
    conditionLabel: "",
    remarks: "",
  };
}

export function WireConductorSelectionSettings() {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<WireConductorSelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetKey>("IV");
  const [draft, setDraft] = useState<WireConductorSelectionDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);

  const copy = locale === "vi"
    ? {
        description:
          "Dữ liệu tham khảo được khóa kèm nguồn. Phần tiêu chuẩn công ty có thể tự thêm/sửa theo ngưỡng A cho IV, WL1 và thanh đồng.",
        referenceTitle: "Dữ liệu tham khảo có nguồn",
        companyTitle: "Tiêu chuẩn công ty",
        target: "Loại",
        current: "Dòng tối đa (A)",
        value: "Kích thước / giá trị chọn",
        condition: "Điều kiện / ghi chú",
        source: "Nguồn",
        add: "Thêm",
        update: "Cập nhật",
        cancelEdit: "Hủy sửa",
        empty: "Chưa có dữ liệu công ty.",
        valuePlaceholder: "Ví dụ: 14 mm² / 3×30",
        conditionPlaceholder: "Ví dụ: dùng mặc định trong tủ điện",
        referenceHint:
          "Cột tham khảo chỉ là giá trị theo đúng điều kiện của nguồn. Khi điều kiện thực tế khác, cần đối chiếu lại tài liệu gốc.",
      }
    : {
        description:
          "公開参考値は根拠ソース付きで固定表示し、社内基準は IV・WL1・銅帯ごとにAしきい値と採用サイズを自由に追加・編集できます。",
        referenceTitle: "根拠付き参考データ",
        companyTitle: "社内基準",
        target: "種類",
        current: "上限電流 (A)",
        value: "採用サイズ / 値",
        condition: "条件・備考",
        source: "根拠",
        add: "追加",
        update: "更新",
        cancelEdit: "編集解除",
        empty: "社内基準はまだ登録されていません。",
        valuePlaceholder: "例）14 mm² / 3×30",
        conditionPlaceholder: "例）盤内標準として採用",
        referenceHint:
          "参考列は記載された条件にだけ適用されます。実際の布設条件・温度・メーカーが異なる場合は元資料で再確認してください。",
      };

  function load() {
    setLoading(true);
    wireConductorSelectionService
      .list()
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const referenceRows = useMemo(
    () => rows.filter((row) => row.basisKind === "reference"),
    [rows],
  );
  const companyRows = useMemo(
    () => rows.filter((row) => row.basisKind === "company"),
    [rows],
  );

  function changeTarget(next: TargetKey) {
    setTarget(next);
    setEditingId(null);
    setDraft(emptyDraft(next));
  }

  function startEdit(row: WireConductorSelectionRow) {
    const nextTarget = rowTarget(row);
    setTarget(nextTarget);
    setEditingId(row.id);
    setDraft({
      basisKind: "company",
      itemKind: row.itemKind,
      wireType: row.wireType,
      currentA: row.currentA,
      resultValue: row.resultValue,
      conditionLabel: row.conditionLabel ?? "",
      remarks: row.remarks ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft(target));
  }

  async function save() {
    if (draft.currentA <= 0 || !draft.resultValue.trim()) return;
    if (editingId) await wireConductorSelectionService.updateCompany(editingId, draft);
    else await wireConductorSelectionService.createCompany(draft);
    setEditingId(null);
    setDraft(emptyDraft(target));
    load();
  }

  async function remove(id: string) {
    await wireConductorSelectionService.removeCompany(id);
    if (editingId === id) cancelEdit();
    load();
  }

  const canSave = draft.currentA > 0 && draft.resultValue.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="panel-title">{copy.referenceTitle}</span>
          <span className="text-[10.5px] text-muted-2">{copy.referenceHint}</span>
        </div>
        <div className="data-table-wrap max-h-[26vh]">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>{copy.target}</th>
                <th style={{ width: 120 }} className="text-right">{copy.current}</th>
                <th style={{ width: 150 }}>{copy.value}</th>
                <th>{copy.condition}</th>
                <th style={{ width: 260 }}>{copy.source}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-5 text-center text-muted">...</td></tr>
              ) : referenceRows.length === 0 ? (
                <tr><td colSpan={5} className="py-5 text-center text-muted-2">—</td></tr>
              ) : (
                referenceRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.itemKind === "busbar" ? "銅帯" : row.wireType}</td>
                    <td className="text-right font-mono">{row.currentA}</td>
                    <td className="font-mono font-semibold">{row.resultValue}</td>
                    <td className="text-[11px] text-muted">{row.conditionLabel || "—"}</td>
                    <td className="text-[11px]">
                      {row.source?.url ? (
                        <a href={row.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          {row.source.title}<ExternalLink className="h-3 w-3" />
                        </a>
                      ) : row.source?.title ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="panel-title">{copy.companyTitle}</span>
        <div className="flex flex-wrap gap-1.5">
          {(["IV", "WL1", "busbar"] as TargetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => changeTarget(key)}
              className={target === key ? "btn-primary" : "btn-secondary"}
            >
              {key === "busbar" ? "銅帯" : key}
            </button>
          ))}
        </div>

        <div className="data-table-wrap max-h-[24vh]">
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>{copy.target}</th>
                <th style={{ width: 120 }} className="text-right">{copy.current}</th>
                <th style={{ width: 180 }}>{copy.value}</th>
                <th>{copy.condition}</th>
                <th style={{ width: 82 }} />
              </tr>
            </thead>
            <tbody>
              {companyRows.length === 0 ? (
                <tr><td colSpan={5} className="py-5 text-center text-muted-2">{copy.empty}</td></tr>
              ) : (
                companyRows.map((row) => (
                  <tr key={row.id} className={editingId === row.id ? "bg-accent/5" : undefined}>
                    <td className="font-semibold">{row.itemKind === "busbar" ? "銅帯" : row.wireType}</td>
                    <td className="text-right font-mono">{row.currentA}</td>
                    <td className="font-mono font-semibold">{row.resultValue}</td>
                    <td className="text-[11px] text-muted">{row.conditionLabel || row.remarks || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(row)} className="btn-ghost btn-icon">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => remove(row.id)} className="btn-ghost btn-icon text-danger hover:bg-danger/10">
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

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[110px_150px_1fr_auto_auto] lg:items-end">
          <div>
            <label className="field-label">{copy.current}</label>
            <input
              type="number"
              min={0}
              step="any"
              value={draft.currentA || ""}
              onChange={(e) => setDraft({ ...draft, currentA: Number(e.target.value) })}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{copy.value}</label>
            <input
              value={draft.resultValue}
              onChange={(e) => setDraft({ ...draft, resultValue: e.target.value })}
              placeholder={copy.valuePlaceholder}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{copy.condition}</label>
            <input
              value={draft.conditionLabel ?? ""}
              onChange={(e) => setDraft({ ...draft, conditionLabel: e.target.value })}
              placeholder={copy.conditionPlaceholder}
              className="field-input"
            />
          </div>
          <button type="button" onClick={save} disabled={!canSave} className="btn-secondary">
            <Plus className="h-3.5 w-3.5" />
            {editingId ? copy.update : copy.add}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn-ghost">
              <RotateCcw className="h-3.5 w-3.5" />
              {copy.cancelEdit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
