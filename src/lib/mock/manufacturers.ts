import type { Manufacturer } from "@/lib/types";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const BASE_MANUFACTURERS: Manufacturer[] = [
  { id: "mitsubishi", name: "三菱電機", nameVi: "Mitsubishi Electric" },
  { id: "fuji", name: "富士電機", nameVi: "Fuji Electric" },
  { id: "panasonic", name: "パナソニック", nameVi: "Panasonic" },
  { id: "nito", name: "日東工業", nameVi: "Nitto Kogyo" },
  { id: "hitachi", name: "日立産機システム", nameVi: "Hitachi Industrial" },
  { id: "sanwa", name: "三和電機", nameVi: "Sanwa Electric" },
];

const EXTRA_KEY = "sekkei.manufacturers.extra";

function loadExtra(): Manufacturer[] {
  return loadFromStorage<Manufacturer[]>(EXTRA_KEY, []);
}

/** Base manufacturers + any added later via 設定 > 部品設定 or インポート. */
export function listManufacturers(): Manufacturer[] {
  return [...BASE_MANUFACTURERS, ...loadExtra()];
}

export function getManufacturerById(id: string): Manufacturer | undefined {
  return listManufacturers().find((m) => m.id === id);
}

export function getManufacturerName(id: string, locale: "ja" | "vi" = "ja"): string {
  const m = getManufacturerById(id);
  if (!m) return id;
  return locale === "vi" && m.nameVi ? m.nameVi : m.name;
}

export function findManufacturerByName(name: string): Manufacturer | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return listManufacturers().find((m) => m.name.toLowerCase() === q || m.nameVi?.toLowerCase() === q);
}

export function addManufacturer(name: string): Manufacturer {
  const existing = findManufacturerByName(name);
  if (existing) return existing;
  const extra = loadExtra();
  const created: Manufacturer = { id: `mfr-${Date.now()}`, name: name.trim() };
  extra.push(created);
  saveToStorage(EXTRA_KEY, extra);
  return created;
}
