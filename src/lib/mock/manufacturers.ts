import { requireSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Manufacturer } from "@/lib/types";

interface ManufacturerRow {
  id: string;
  name: string;
  name_vi: string | null;
}

function fromRow(row: ManufacturerRow): Manufacturer {
  return { id: row.id, name: row.name, nameVi: row.name_vi ?? undefined };
}

/**
 * `getManufacturerName`/`getManufacturerById` are called synchronously
 * inline in table cell renders across 部品データ/部品図/カタログ/部品製作 — that
 * can't change to an async DB call without touching every one of those
 * render paths. Instead this module keeps a small in-memory cache backed by
 * Supabase: each page's data-loading effect calls `preloadManufacturers()`
 * once (alongside its own fetch), after which the synchronous getters below
 * read the already-warm cache.
 */
let cache: Manufacturer[] = [];
let loadingPromise: Promise<Manufacturer[]> | null = null;

async function fetchAll(): Promise<Manufacturer[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await requireSupabase().from("manufacturers").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function preloadManufacturers(): Promise<Manufacturer[]> {
  if (!loadingPromise) {
    loadingPromise = fetchAll().then((list) => {
      cache = list;
      return list;
    });
  }
  return loadingPromise;
}

export function listManufacturers(): Manufacturer[] {
  return cache;
}

export function getManufacturerById(id: string): Manufacturer | undefined {
  return cache.find((m) => m.id === id);
}

export function getManufacturerName(id: string, locale: "ja" | "vi" = "ja"): string {
  const m = getManufacturerById(id);
  if (!m) return id;
  return locale === "vi" && m.nameVi ? m.nameVi : m.name;
}

export function findManufacturerByName(name: string): Manufacturer | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return cache.find((m) => m.name.toLowerCase() === q || m.nameVi?.toLowerCase() === q);
}

export async function addManufacturer(name: string): Promise<Manufacturer> {
  const existing = findManufacturerByName(name);
  if (existing) return existing;
  const { data, error } = await requireSupabase()
    .from("manufacturers")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  const created = fromRow(data as ManufacturerRow);
  cache = [...cache, created];
  return created;
}
