import ExcelJS from "exceljs";
import { designTemplateService } from "./designTemplateService";
import type { DesignTemplateKind } from "@/lib/types/design";

/** Loads the currently active Excel template for `kind` from Supabase Storage — never a bundled file, per 設定 > テンプレート管理. Throws `no-active-template:<kind>` if nothing has been uploaded yet. */
export async function loadActiveTemplate(kind: DesignTemplateKind): Promise<ExcelJS.Workbook> {
  const buffer = await designTemplateService.fetchActiveBytes(kind);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
