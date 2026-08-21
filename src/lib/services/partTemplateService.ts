import { delay } from "@/lib/utils/async";
import type { PartTemplate, PartTemplateKind } from "@/lib/types";
import type { PartTemplateRepository } from "./types";

/** In-memory store standing in for a future template file storage backend. */
const templates: PartTemplate[] = [];

class MockPartTemplateRepository implements PartTemplateRepository {
  async list() {
    return delay([...templates]);
  }

  async getByKind(kind: PartTemplateKind) {
    return delay(templates.find((t) => t.kind === kind) ?? null);
  }

  async upload(kind: PartTemplateKind, fileName: string) {
    const existingIndex = templates.findIndex((t) => t.kind === kind);
    const template: PartTemplate = {
      id: `part-tpl-${kind}`,
      kind,
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

export const partTemplateService: PartTemplateRepository = new MockPartTemplateRepository();
