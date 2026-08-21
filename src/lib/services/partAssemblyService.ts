import { delay } from "@/lib/utils/async";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import type { PartAssemblyRow } from "@/lib/types";

const KEY_PREFIX = "sekkei.partAssembly.";
const ACTIVE_PROJECT_KEY = "sekkei.partAssembly.activeProject";

function rowsKey(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

/**
 * 部品製作 rows, scoped per Project (never mixed between Projects). Reuses
 * the same `Project` entity as 設計管理 — one shared Project concept, not a
 * second parallel one.
 */
export const partAssemblyService = {
  async listByProject(projectId: string): Promise<PartAssemblyRow[]> {
    return delay(loadFromStorage<PartAssemblyRow[]>(rowsKey(projectId), []), 150);
  },

  async saveRows(projectId: string, rows: PartAssemblyRow[]): Promise<void> {
    saveToStorage(rowsKey(projectId), rows);
  },

  getLastActiveProjectId(): string {
    return loadFromStorage<string>(ACTIVE_PROJECT_KEY, "");
  },

  setLastActiveProjectId(projectId: string): void {
    saveToStorage(ACTIVE_PROJECT_KEY, projectId);
  },
};
