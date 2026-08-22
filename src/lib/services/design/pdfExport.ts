import { SPEC_GROUPS, WIRING_SPEC_FIELDS, type SpecFieldKey } from "@/lib/types/design";
import { loadDesignRequestPrintFields, loadProductionRequestPrintFields } from "./printFields";
import { PdfCanvas, downloadPdf } from "./pdfCanvas";

/**
 * PDF export deliberately reads the exact same `loadDesignRequestPrintFields`
 * / `loadProductionRequestPrintFields` used by the Excel export (excelExport.ts)
 * — same case, same panels, same specs, so Excel and PDF can never diverge in
 * content.
 */

const EXTERIOR_SPEC_LABEL: Record<string, string> = {
  location: "場所",
  installation: "据付",
  structure: "構造",
  material: "材質",
  color: "色",
  gloss: "艶",
  handleLocation: "場所",
  handleType: "種類",
  keyNo: "鍵(No.)",
  wireEntry: "入線",
  opening: "開口",
  blankPlate: "塞ギ板",
};

const WIRING_SPEC_LABEL: Record<string, string> = {
  electricalMethod: "電気方式",
  powerSource: "電源",
  voltage: "電圧",
  terminalBlock: "端子台",
};

export async function exportDesignRequestPdf(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadDesignRequestPrintFields(caseId);
  const c = fields.case;
  const canvas = await PdfCanvas.create();

  canvas.title("設計依頼書");
  canvas.keyValueGrid(
    [
      ["件名", c.projectName],
      ["図面番号", c.drawingNumber],
      ["注文先", c.orderer],
      ["管理番号", c.managementNumber],
      ["工事番号", c.constructionNumber],
      ["担当", c.assignee],
    ],
    2,
  );

  canvas.sectionHeading("盤①〜⑦");
  canvas.table(
    ["盤", "盤名称", "盤構造", "面数", "設計納期", "見込時間", "実動時間"],
    [24, 130, 90, 40, 70, 60, 60],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.panelName,
      p.panelStructure,
      p.faceCount != null ? String(p.faceCount) : "",
      p.designDueDate ?? "",
      p.designEstimatedHours != null ? String(p.designEstimatedHours) : "",
      p.designActualHours != null ? String(p.designActualHours) : "",
    ]),
  );

  canvas.sectionHeading("外形仕様");
  canvas.table(
    ["項目", "仕様Ⅰ", "仕様Ⅱ", "仕様Ⅲ"],
    [110, 135, 135, 135],
    SPEC_GROUPS.flatMap((g) => g.fields as SpecFieldKey[]).map((fieldKey) => {
      const entry = c.specs[fieldKey];
      return [EXTERIOR_SPEC_LABEL[fieldKey], entry?.spec1 ?? "", entry?.spec2 ?? "", entry?.spec3 ?? ""];
    }),
  );

  canvas.sectionHeading("結線仕様");
  canvas.table(
    ["項目", "仕様Ⅰ", "仕様Ⅱ", "仕様Ⅲ"],
    [110, 135, 135, 135],
    WIRING_SPEC_FIELDS.map((fieldKey) => {
      const entry = c.specs[fieldKey];
      return [WIRING_SPEC_LABEL[fieldKey], entry?.spec1 ?? "", entry?.spec2 ?? "", entry?.spec3 ?? ""];
    }),
  );

  canvas.sectionHeading("設計備考欄");
  canvas.paragraph(c.designRemarks);

  const bytes = await canvas.save();
  const fileName = `設計依頼書_${c.drawingNumber}.pdf`;
  downloadPdf(bytes, fileName);
  return { fileName };
}

export async function exportProductionRequestPdf(caseId: string): Promise<{ fileName: string }> {
  const fields = await loadProductionRequestPrintFields(caseId);
  const c = fields.case;
  const canvas = await PdfCanvas.create();

  canvas.title("製作依頼書");
  canvas.keyValueGrid(
    [
      ["件名", c.projectName],
      ["図面番号", c.drawingNumber],
      ["注文先", c.orderer],
      ["管理番号", c.managementNumber],
      ["工事番号", c.constructionNumber],
    ],
    2,
  );

  canvas.sectionHeading("盤①〜⑦");
  canvas.table(
    ["盤", "盤名称", "盤構造", "面数", "見込時間", "実動時間"],
    [24, 150, 100, 50, 80, 80],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.panelName,
      p.panelStructure,
      p.faceCount != null ? String(p.faceCount) : "",
      p.productionEstimatedHours != null ? String(p.productionEstimatedHours) : "",
      p.productionActualHours != null ? String(p.productionActualHours) : "",
    ]),
  );

  canvas.sectionHeading("盤①〜⑦（製作仕様）");
  canvas.table(
    ["盤", "電気方式", "定格電圧", "定格電流", "定格短絡遮断容量", "周波数", "制御電圧", "保護等級"],
    [24, 65, 60, 55, 90, 50, 60, 60],
    fields.panels.map((p) => [
      String(p.panelNo),
      p.electricalMethod,
      p.ratedVoltage,
      p.ratedCurrent,
      p.ratedBreakingCapacity,
      p.frequency,
      p.controlVoltage,
      p.protectionRating,
    ]),
  );

  canvas.sectionHeading("検査項目");
  canvas.table(
    ["検査表", "膜厚", "漏電", "漏電アラーム", "耐圧"],
    [95, 95, 95, 95, 95],
    [
      [
        fields.request.inspectionSheet,
        fields.request.filmThickness,
        fields.request.earthLeakage,
        fields.request.earthLeakageAlarm,
        fields.request.withstandVoltage,
      ],
    ],
  );

  canvas.sectionHeading("製作注意事項");
  canvas.paragraph(fields.request.productionNotes);

  const bytes = await canvas.save();
  const fileName = `製作依頼書_${c.drawingNumber}.pdf`;
  downloadPdf(bytes, fileName);
  return { fileName };
}
