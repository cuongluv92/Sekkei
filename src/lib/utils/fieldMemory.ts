import { loadFromStorage, saveToStorage } from "./localStore";

/**
 * Remembers text values a user has typed into a given free-text field
 * (記号/品名/型式/仕様/備考 etc. in 部品製作), across sessions, so the field
 * can offer them back as autocomplete suggestions next time — "chỉ cần gõ
 * chữ cái đầu nó tự biết" (type the first letter and it already knows).
 * Backed by localStorage (per-browser), the same mechanism already used for
 * other lightweight app state — no server round-trip needed for this.
 */
const STORAGE_PREFIX = "sekkei.fieldMemory.";
const MAX_ENTRIES_PER_FIELD = 60;

function storageKey(field: string): string {
  return `${STORAGE_PREFIX}${field}`;
}

export function getFieldSuggestions(field: string): string[] {
  return loadFromStorage<string[]>(storageKey(field), []);
}

export function rememberFieldValue(field: string, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = getFieldSuggestions(field);
  const next = [trimmed, ...existing.filter((v) => v !== trimmed)].slice(0, MAX_ENTRIES_PER_FIELD);
  saveToStorage(storageKey(field), next);
}
