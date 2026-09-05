"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectionDataEditor } from './SelectionDataEditor';
import { CORRECTION_PREFIX } from '@/lib/services/selectionCorrectionService';
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import {
  motorKwSelectionService,
  type MotorKwSelectionDraft,
  type MotorKwSelectionRow,
} from "@/lib/services";
import type { SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

const EMPTY: MotorKwSelectionDraft = {
  manufacturerId: "",
  phase: "three",
  voltageClass: "200V",
  startMethod: "direct",
  motorKw: 0,
  remarks: "",
};

const VOLTAGES: SelectionVoltageClass[] = ["100V", "200V", "400V"];
const METHODS: SelectionCircuitType[] = ["direct", "starDelta", "inverter"];

export function MotorKwSelectionSettings() {
  const { locale } = useTranslation();
  const [, forceRerender] = useState(0);
  const [rows, setRows] = useState<MotorKwSelectionRow[]>([]);
  const [draft, setDraft] = useState<MotorKwSelectionDraft>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const manufacturers = listManufacturers();

  const copy = locale === "vi"
    ? {
        title: "Tiêu chuẩn công ty theo kW",
        description: "Dữ liệu Mitsubishi/Fuji là dữ liệu tham khảo chỉ đọc. Ở đây chỉ thêm/sửa tiêu chuẩn công ty của bạn để có thể ưu tiên model thực tế đang dùng.",
        maker: "Hãng",
        phase: "Pha",
        voltage: "Điện áp",
        method: "Khởi động",
        kw: "kW",
        rated: "Dòng định mức A",
        starting: "Dòng khởi động A",
        breaker: "MCCB/NFB",
        breakerA: "MCCB A",
        breakerCondition: "Điều kiện ngắn mạch/Icu",
        contactor: "MS/MC",
        thermal: "THR/OLR",
        thermalA: "Heater A",
        inverter: "INV",
        wire: "Dây",
        ct: "CT",
        am: "AM",
        naisen: "Naisen/JEAC",
        jis: "JIS",
        association: "JSIA/JEMA",
        remarks: "Ghi chú",
        add: "Thêm tiêu chuẩn công ty",
        update: "Cập nhật",
        cancel: "Hủy sửa",
        empty: "Chưa có tiêu chuẩn công ty theo kW.",
      }
    : {
        title: "kW選定 社内基準",
        description: "三菱・富士の公開参考データは読み取り専用です。ここでは実際に社内採用する機器・CT・AM・電線などを自由に追加/修正できます。",
        maker: "メーカー",
        phase: "相数",
        voltage: "電圧",
        method: "始動方式",
        kw: "電動機 kW",
        rated: "定格電流 A",
        starting: "始動電流 A",
        breaker: "MCCB/NFB",
        breakerA: "MCCB定格 A",
        breakerCondition: "短絡容量/Icu条件",
        contactor: "MS/MC",
        thermal: "THR/OLR",
        thermalA: "ヒータ A",
        inverter: "INV",
        wire: "電線",
        ct: "CT",
        am: "AM",
        naisen: "内線規程/JEAC",
        jis: "JIS",
        association: "JSIA/JEMA",
        remarks: "備考",
        add: "社内基準を追加",
        update: "更新",
        cancel: "編集解除",
        empty: "kW社内基準は未登録です。",
      };

  function makerName(id?: string) {
    const m = manufacturers.find((item) => item.id === id);
    if (!m) return id || "—";
    return locale === "vi" && m.nameVi ? m.nameVi : m.name;
  }

  function methodLabel(method: SelectionCircuitType) {
    if (method === "direct") return locale === "vi" ? "Trực tiếp" : "直入れ";
    if (method === "starDelta") return locale === "vi" ? "Star-Delta" : "スター・デルタ";
    return locale === "vi" ? "Biến tần" : "インバータ";
  }

  async function reload() {
    const all = await motorKwSelectionService.list();
    setRows(all.filter((row) => row.basisKind === "company" && !row.remarks?.startsWith(CORRECTION_PREFIX)));
  }

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    void reload();
  }, []);

  function reset() {
    setEditingId(null);
    setDraft({ ...EMPTY });
  }

  async function save() {
    if (!draft.manufacturerId || !Number.isFinite(draft.motorKw) || draft.motorKw <= 0) return;
    if (editingId) await motorKwSelectionService.updateCompany(editingId, draft);
    else await motorKwSelectionService.createCompany(draft);
    reset();
    await reload();
  }

  function edit(row: MotorKwSelectionRow) {
    setEditingId(row.id);
    setDraft({
      manufacturerId: row.manufacturerId ?? "",
      phase: row.phase,
      voltageClass: row.voltageClass,
      startMethod: row.startMethod,
      motorKw: row.motorKw,
      ratedCurrentA: row.ratedCurrentA,
      startingCurrentA: row.startingCurrentA,
      breakerModel: row.breakerModel,
      breakerRatedA: row.breakerRatedA,
      breakerCondition: row.breakerCondition,
      contactorModel: row.contactorModel,
      thermalModel: row.thermalModel,
      thermalSettingA: row.thermalSettingA,
      inverterModel: row.inverterModel,
      wireSize: row.wireSize,
      ctModel: row.ctModel,
      amRange: row.amRange,
      naisenBasis: row.naisenBasis,
      jisBasis: row.jisBasis,
      associationBasis: row.associationBasis,
      remarks: row.remarks,
    });
  }

  async function remove(id: string) {
    await motorKwSelectionService.removeCompany(id);
    if (editingId === id) reset();
    await reload();
  }

  const numberField = (
    label: string,
    value: number | undefined,
    key: "ratedCurrentA" | "startingCurrentA" | "breakerRatedA" | "thermalSettingA",
  ) => (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        type="number"
        min={0}
        step="any"
        value={value ?? ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
      />
    </label>
  );

  const textField = (
    label: string,
    value: string | undefined,
    key:
      | "breakerModel" | "breakerCondition" | "contactorModel" | "thermalModel"
      | "inverterModel" | "wireSize" | "ctModel" | "amRange" | "naisenBasis"
      | "jisBasis" | "associationBasis" | "remarks",
  ) => (
    <label>
      <span className="field-label">{label}</span>
      <input className="field-input" value={value ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <SelectionDataEditor />
      <div>
        <div className="panel-title">{copy.title}</div>
        <p className="mt-1 text-[11px] text-muted">{copy.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <label>
          <span className="field-label">{copy.maker}</span>
          <select className="field-input" value={draft.manufacturerId} onChange={(e) => setDraft({ ...draft, manufacturerId: e.target.value })}>
            <option value="">—</option>
            {manufacturers.map((m) => <option key={m.id} value={m.id}>{makerName(m.id)}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">{copy.phase}</span>
          <select className="field-input" value={draft.phase} onChange={(e) => setDraft({ ...draft, phase: e.target.value as "single" | "three" })}>
            <option value="three">{locale === "vi" ? "3 pha" : "三相"}</option>
            <option value="single">{locale === "vi" ? "1 pha" : "単相"}</option>
          </select>
        </label>
        <label>
          <span className="field-label">{copy.voltage}</span>
          <select className="field-input" value={draft.voltageClass} onChange={(e) => setDraft({ ...draft, voltageClass: e.target.value as SelectionVoltageClass })}>
            {VOLTAGES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">{copy.method}</span>
          <select className="field-input" value={draft.startMethod} onChange={(e) => setDraft({ ...draft, startMethod: e.target.value as SelectionCircuitType })}>
            {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
          </select>
        </label>
        <label><span className="field-label">{copy.kw}</span><input className="field-input" type="number" min={0} step="any" value={draft.motorKw || ""} onChange={(e) => setDraft({ ...draft, motorKw: Number(e.target.value) })} /></label>
        {numberField(copy.rated, draft.ratedCurrentA, "ratedCurrentA")}
        {numberField(copy.starting, draft.startingCurrentA, "startingCurrentA")}
        {textField(copy.breaker, draft.breakerModel, "breakerModel")}
        {numberField(copy.breakerA, draft.breakerRatedA, "breakerRatedA")}
        {textField(copy.breakerCondition, draft.breakerCondition, "breakerCondition")}
        {textField(copy.contactor, draft.contactorModel, "contactorModel")}
        {textField(copy.thermal, draft.thermalModel, "thermalModel")}
        {numberField(copy.thermalA, draft.thermalSettingA, "thermalSettingA")}
        {textField(copy.inverter, draft.inverterModel, "inverterModel")}
        {textField(copy.wire, draft.wireSize, "wireSize")}
        {textField(copy.ct, draft.ctModel, "ctModel")}
        {textField(copy.am, draft.amRange, "amRange")}
        {textField(copy.naisen, draft.naisenBasis, "naisenBasis")}
        {textField(copy.jis, draft.jisBasis, "jisBasis")}
        {textField(copy.association, draft.associationBasis, "associationBasis")}
        {textField(copy.remarks, draft.remarks, "remarks")}
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={!draft.manufacturerId || draft.motorKw <= 0}>
          {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editingId ? copy.update : copy.add}
        </button>
        {editingId && <button type="button" className="btn-secondary" onClick={reset}>{copy.cancel}</button>}
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-2">{copy.empty}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 1600 }}>
            <thead><tr><th>{copy.maker}</th><th>{copy.phase}</th><th>{copy.voltage}</th><th>{copy.method}</th><th>{copy.kw}</th><th>{copy.rated}</th><th>{copy.breaker}</th><th>{copy.contactor}</th><th>{copy.inverter}</th><th>{copy.wire}</th><th>{copy.ct}</th><th>{copy.am}</th><th>{copy.remarks}</th><th /></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td>{makerName(row.manufacturerId)}</td><td>{row.phase === "three" ? (locale === "vi" ? "3 pha" : "三相") : (locale === "vi" ? "1 pha" : "単相")}</td><td>{row.voltageClass}</td><td>{methodLabel(row.startMethod)}</td><td className="font-mono">{row.motorKw}</td><td className="font-mono">{row.ratedCurrentA ?? "—"}</td><td>{row.breakerModel ?? "—"}</td><td>{row.contactorModel ?? "—"}</td><td>{row.inverterModel ?? "—"}</td><td>{row.wireSize ?? "—"}</td><td>{row.ctModel ?? "—"}</td><td>{row.amRange ?? "—"}</td><td className="text-[10.5px]">{row.remarks ?? "—"}</td>
                <td><div className="flex justify-end gap-1"><button type="button" className="btn-ghost btn-icon" onClick={() => edit(row)}><Pencil className="h-3.5 w-3.5" /></button><button type="button" className="btn-ghost btn-icon text-danger" onClick={() => void remove(row.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
