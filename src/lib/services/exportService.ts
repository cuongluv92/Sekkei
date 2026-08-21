import { delay } from "@/lib/utils/async";
import type { ExportFormat, ExportRepository } from "./types";

const EXTENSIONS: Record<ExportFormat, string> = {
  excel: "xlsx",
  pdf: "pdf",
  dwg: "dwg",
  image: "png",
};

/**
 * Mock export trigger. Real exports will call a backend job that renders
 * the Excel template registered in 設定 (for calculations) or streams the
 * original DWG/PDF file (for parts/drawings/catalog). For now this only
 * simulates the round trip so buttons have real loading/success feedback.
 */
class MockExportRepository implements ExportRepository {
  async export(format: ExportFormat, context: string) {
    const fileName = `${context}.${EXTENSIONS[format]}`;
    return delay({ fileName }, 500);
  }
}

export const exportService: ExportRepository = new MockExportRepository();
