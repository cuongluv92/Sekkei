import type { Manufacturer } from "@/lib/types";

export const manufacturers: Manufacturer[] = [
  { id: "mitsubishi", name: "三菱電機", nameVi: "Mitsubishi Electric" },
  { id: "fuji", name: "富士電機", nameVi: "Fuji Electric" },
  { id: "panasonic", name: "パナソニック", nameVi: "Panasonic" },
  { id: "nito", name: "日東工業", nameVi: "Nitto Kogyo" },
  { id: "hitachi", name: "日立産機システム", nameVi: "Hitachi Industrial" },
  { id: "sanwa", name: "三和電機", nameVi: "Sanwa Electric" },
];

export function getManufacturerById(id: string): Manufacturer | undefined {
  return manufacturers.find((m) => m.id === id);
}

export function getManufacturerName(id: string, locale: "ja" | "vi" = "ja"): string {
  const m = getManufacturerById(id);
  if (!m) return id;
  return locale === "vi" && m.nameVi ? m.nameVi : m.name;
}
