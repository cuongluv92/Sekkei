import { delay } from "@/lib/utils/async";
import type { CalculationTemplate } from "@/lib/types";
import type { CalculationTemplateRepository } from "./types";

/** In-memory store standing in for a future template file storage backend. */
const templates: CalculationTemplate[] = [];

class MockCalculationTemplateRepository implements CalculationTemplateRepository {
  async list() {
    return delay([...templates]);
  }

  async getByCalculationKey(calculationKey: string) {
    return delay(templates.find((t) => t.calculationKey === calculationKey) ?? null);
  }

  async upload(calculationKey: string, fileName: string) {
    const existingIndex = templates.findIndex((t) => t.calculationKey === calculationKey);
    const template: CalculationTemplate = {
      id: `tpl-${calculationKey}`,
      calculationKey,
      fileName,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }
    return delay(template, 300);
  }
}

export const calculationTemplateService: CalculationTemplateRepository =
  new MockCalculationTemplateRepository();
