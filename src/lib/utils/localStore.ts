/**
 * Thin localStorage helpers used by the 設計管理 mock repositories. This
 * stands in for "the database" for now (per the architecture note: the
 * database is the real source of truth once a backend exists — this is not
 * meant to simulate the old Excel files as separate stores).
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
