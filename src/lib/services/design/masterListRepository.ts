import type { MasterListItem } from "@/lib/types/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const STORAGE_KEY = "sekkei.design.masterList";

/**
 * Every dropdown/combobox candidate list in 設計管理 (設計依頼区分, 盤構造, the
 * 16 仕様 fields, electrical fields, ...) is backed by this, never hard-coded
 * in a component. Seeded with a few starter values per list so the UI isn't
 * empty on first load; all of it is editable from 設定 > 設計管理設定.
 */
const SEED: Record<string, string[]> = {
  requestType: ["新規", "変更", "追加"],
  panelStructure: ["自立盤", "壁掛盤", "キュービクル形"],
  location: ["屋内", "屋外"],
  installation: ["床置", "壁掛"],
  structure: ["自立", "壁掛"],
  material: ["鋼板", "ステンレス"],
  color: ["マンセル 5Y7/1", "指定なし"],
  gloss: ["半艶", "艶消し"],
  handleLocation: ["前面", "側面"],
  handleType: ["レバーハンドル", "ハンドル錠付"],
  keyNo: ["No.1", "No.2"],
  wireEntry: ["上入線", "下入線"],
  opening: ["あり", "なし"],
  blankPlate: ["あり", "なし"],
  electricalMethod: ["三相3線式", "単相2線式"],
  powerSource: ["自家発", "商用"],
  voltage: ["200V", "400V"],
  terminalBlock: ["あり", "なし"],
};

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `ml-${Date.now()}-${idCounter}`;
}

function loadAll(): MasterListItem[] {
  const existing = loadFromStorage<MasterListItem[] | null>(STORAGE_KEY, null);
  if (existing) return existing;

  const seeded: MasterListItem[] = [];
  for (const [listKey, values] of Object.entries(SEED)) {
    values.forEach((value, index) => {
      seeded.push({ id: nextId(), listKey, value, order: index, enabled: true });
    });
  }
  saveToStorage(STORAGE_KEY, seeded);
  return seeded;
}

function saveAll(items: MasterListItem[]) {
  saveToStorage(STORAGE_KEY, items);
}

export const masterListRepository = {
  listKeys(): string[] {
    return Array.from(new Set(loadAll().map((i) => i.listKey)));
  },

  listByKey(listKey: string, includeDisabled = false): MasterListItem[] {
    return loadAll()
      .filter((i) => i.listKey === listKey && (includeDisabled || i.enabled))
      .sort((a, b) => a.order - b.order);
  },

  add(listKey: string, value: string): MasterListItem {
    const all = loadAll();
    const existing = all.find(
      (i) => i.listKey === listKey && i.value.trim() === value.trim(),
    );
    if (existing) return existing;
    const maxOrder = all
      .filter((i) => i.listKey === listKey)
      .reduce((max, i) => Math.max(max, i.order), -1);
    const item: MasterListItem = {
      id: nextId(),
      listKey,
      value: value.trim(),
      order: maxOrder + 1,
      enabled: true,
    };
    all.push(item);
    saveAll(all);
    return item;
  },

  update(id: string, value: string): void {
    const all = loadAll();
    const item = all.find((i) => i.id === id);
    if (item) item.value = value.trim();
    saveAll(all);
  },

  remove(id: string): void {
    saveAll(loadAll().filter((i) => i.id !== id));
  },

  toggleEnabled(id: string): void {
    const all = loadAll();
    const item = all.find((i) => i.id === id);
    if (item) item.enabled = !item.enabled;
    saveAll(all);
  },

  move(id: string, direction: "up" | "down"): void {
    const all = loadAll();
    const item = all.find((i) => i.id === id);
    if (!item) return;
    const siblings = all
      .filter((i) => i.listKey === item.listKey)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((i) => i.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= siblings.length) return;
    const tmp = siblings[index].order;
    siblings[index].order = siblings[swapWith].order;
    siblings[swapWith].order = tmp;
    saveAll(all);
  },
};
