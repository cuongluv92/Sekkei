import { delay } from "@/lib/utils/async";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import type { SelectionRule, SelectionOutputKey } from "@/lib/types";

const KEY = "sekkei.selectionRules";

function loadAll(): SelectionRule[] {
  return loadFromStorage<SelectionRule[]>(KEY, []);
}
function saveAll(rules: SelectionRule[]) {
  saveToStorage(KEY, rules);
}

/** RuleRepository — starts empty on purpose; every row is entered via 設定 > 選定設定 (or a future rule import), never seeded with invented breaker/wire values. */
export const selectionRuleService = {
  async list(): Promise<SelectionRule[]> {
    return delay([...loadAll()].sort((a, b) => a.order - b.order), 150);
  },

  async create(input: Omit<SelectionRule, "id" | "order">): Promise<SelectionRule> {
    const all = loadAll();
    const maxOrder = all.reduce((max, r) => Math.max(max, r.order), -1);
    const created: SelectionRule = { ...input, id: `rule-${Date.now()}`, order: maxOrder + 1 };
    all.push(created);
    saveAll(all);
    return delay(created, 150);
  },

  async update(id: string, patch: Partial<SelectionRule>): Promise<SelectionRule> {
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`SelectionRule not found: ${id}`);
    const updated = { ...all[idx], ...patch, id };
    all[idx] = updated;
    saveAll(all);
    return delay(updated, 150);
  },

  async remove(id: string): Promise<void> {
    saveAll(loadAll().filter((r) => r.id !== id));
  },

  async toggleEnabled(id: string): Promise<void> {
    const all = loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], enabled: !all[idx].enabled };
    saveAll(all);
  },

  async listByOutput(outputKey: SelectionOutputKey): Promise<SelectionRule[]> {
    return loadAll()
      .filter((r) => r.outputKey === outputKey)
      .sort((a, b) => a.order - b.order);
  },
};
