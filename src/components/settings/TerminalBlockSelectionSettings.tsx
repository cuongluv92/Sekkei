"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  terminalBlockSelectionService,
  type TerminalBlockSelectionDraft,
  type TerminalBlockSelectionRow,
} from "@/lib/services";

const EMPTY: TerminalBlockSelectionDraft = {
  manufacturer: "東洋技研",
  series: "AT",
  model: "",
  ratedCurrentA: 0,
  maxWireMm2: 0,
  screwSize: "",
  voltageLabel: "600V",
  remarks: "",
};

export function TerminalBlockSelectionSettings() {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<TerminalBlockSelectionRow[]>([]);
  const [draft, setDraft] = useState<TerminalBlockSelectionDraft>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);

  const copy = locale === "vi"
    ? {
        title: "Cài đặt TB",
        description: "Dữ liệu Toyogiken AT bên trái là dữ liệu tham khảo chính thức. Bảng dưới đây chỉ quản lý tiêu chuẩn công ty, có thể thêm/sửa/xóa tự do.",
        maker: "Hãng",
        series: "Series",
        model: "Model",
        current: "Dòng định mức A",
        wire: "Dây tối đa mm²",
        screw: "Cỡ vít",
        voltage: "Điện áp",
        remarks: "Ghi chú",
        add: "Thêm",
        update: "Cập nhật",
        cancel: "Hủy sửa",
        empty: "Chưa có tiêu chuẩn TB nội bộ.",
      }
    : {
        title: "TB選定設定",
        description: "東洋技研 ATシリーズの公式参考値は固定保持し、ここでは会社が実際に採用する社内基準だけを追加・編集・削除します。",
        maker: "メーカー",
        series: "シリーズ",
        model: "型式",
        current: "定格電流 A",
        wire: "適合電線 MAX mm²",
        screw: "端子ねじ",
        voltage: "定格電圧",
        remarks: "備考",
        add: "追加",
        update: "更新",
        cancel: "編集解除",
        empty: "社内TB基準は未登録です。",
      };

  async function reload() {
    const all = await terminalBlockSelectionService.list();
    setRows(all.filter((row) => row.basisKind === "company"));
  }

  useEffect(() => {
    void reload();
  }, []);

  function reset() {
    setEditingId(null);
    setDraft({ ...EMPTY });
  }

  async function save() {
    if (!draft.model.trim() || !draft.screwSize.trim() || draft.ratedCurrentA <= 0 || draft.maxWireMm2 <= 0) return;
    if (editingId) await terminalBlockSelectionService.updateCompany(editingId, draft);
    else await terminalBlockSelectionService.createCompany(draft);
    reset();
    await reload();
  }

  function edit(row: TerminalBlockSelectionRow) {
    setEditingId(row.id);
    setDraft({
      manufacturer: row.manufacturer,
      series: row.series,
      model: row.model,
      ratedCurrentA: row.ratedCurrentA,
      maxWireMm2: row.maxWireMm2,
      screwSize: row.screwSize,
      voltageLabel: row.voltageLabel,
      remarks: row.remarks,
    });
  }

  async function remove(id: string) {
    await terminalBlockSelectionService.removeCompany(id);
    if (editingId === id) reset();
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="panel-title">{copy.title}</div>
        <p className="mt-1 text-[11px] text-muted">{copy.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <label><span className="field-label">{copy.maker}</span><input className="field-input" value={draft.manufacturer ?? ""} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} /></label>
        <label><span className="field-label">{copy.series}</span><input className="field-input" value={draft.series ?? ""} onChange={(e) => setDraft({ ...draft, series: e.target.value })} /></label>
        <label><span className="field-label">{copy.model}</span><input className="field-input" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></label>
        <label><span className="field-label">{copy.voltage}</span><input className="field-input" value={draft.voltageLabel ?? ""} onChange={(e) => setDraft({ ...draft, voltageLabel: e.target.value })} /></label>
        <label><span className="field-label">{copy.current}</span><input className="field-input" type="number" min={0} step="any" value={draft.ratedCurrentA || ""} onChange={(e) => setDraft({ ...draft, ratedCurrentA: Number(e.target.value) })} /></label>
        <label><span className="field-label">{copy.wire}</span><input className="field-input" type="number" min={0} step="any" value={draft.maxWireMm2 || ""} onChange={(e) => setDraft({ ...draft, maxWireMm2: Number(e.target.value) })} /></label>
        <label><span className="field-label">{copy.screw}</span><input className="field-input" value={draft.screwSize} onChange={(e) => setDraft({ ...draft, screwSize: e.target.value })} /></label>
        <label><span className="field-label">{copy.remarks}</span><input className="field-input" value={draft.remarks ?? ""} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} /></label>
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => void save()}>
          {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editingId ? copy.update : copy.add}
        </button>
        {editingId && <button type="button" className="btn-secondary" onClick={reset}>{copy.cancel}</button>}
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-2">{copy.empty}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead><tr><th>{copy.maker}</th><th>{copy.series}</th><th>{copy.model}</th><th>{copy.current}</th><th>{copy.wire}</th><th>{copy.screw}</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.manufacturer}</td><td>{row.series}</td><td className="font-mono font-semibold">{row.model}</td><td>{row.ratedCurrentA} A</td><td>{row.maxWireMm2} mm²</td><td>{row.screwSize}</td>
                  <td><div className="flex justify-end gap-1"><button type="button" className="btn-ghost" onClick={() => edit(row)}><Pencil className="h-3.5 w-3.5" /></button><button type="button" className="btn-ghost text-danger" onClick={() => void remove(row.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
