import raw from "@/data/fuji-sc-next.json";
import legacyRaw from "@/data/fuji-msscale.json";

type Voltage = "200V" | "400V";
type Method = "direct" | "starDelta";
type Breaker = [string, string, string];

function numberOf(value: string) { return Number(value.replace(/[^0-9.]/g, "")); }
function heatRange(value: string) {
  return value.replace(/\s*A\s*$/i, "").replace(/\s*-\s*/, "～") + " A";
}
function requiredKa(currentA: number) {
  if (currentA <= 50) return 7.5;
  if (currentA <= 125) return 30;
  if (currentA <= 250) return 36;
  return 50;
}
function pickBreaker(groups: Breaker[][], index: number, currentA: number): Breaker | null {
  return groups.map((group) => group[index]).filter((row): row is Breaker => Boolean(row?.[0]))
    .sort((a, b) => numberOf(a[2]) - numberOf(b[2]))
    .find((row) => numberOf(row[2]) >= requiredKa(currentA)) ?? null;
}
function contactorCurrent(model: string) {
  const match = model.match(/(?:SC|SW)(\d+)/);
  return match ? Number(match[1]) : null;
}

export interface FujiScNextResult {
  ratedCurrentA: number;
  startingCurrentA: number;
  motorModel: string;
  mccb: Breaker | null;
  elcb: Breaker | null;
  heatRange: string;
  wire: string;
  switchModel?: string;
  contactorCurrentA?: number | null;
  mainContactor?: string;
  starContactor?: string;
  deltaContactor?: string;
  olrModel?: string;
  loadWire?: string;
  catalog: "SC-NEXT" | "MSスケール";
}

export function findFujiScNext(method: Method, voltage: Voltage, kw: number): FujiScNextResult | null {
  const currentData = raw[method][voltage] as any;
  const currentIndex = currentData["電動機"]["出力"].findIndex((value: string) => numberOf(value) === kw);
  const legacyKey = `${method === "direct" ? "DI" : "SD"}${voltage}` as keyof typeof legacyRaw;
  const data = currentIndex >= 0 ? currentData : legacyRaw[legacyKey] as any;
  const index = data["電動機"]["出力"].findIndex((value: string) => numberOf(value) === kw);
  if (index < 0) return null;
  const catalog = currentIndex >= 0 ? "SC-NEXT" as const : "MSスケール" as const;
  const ratedCurrentA = numberOf(data["電動機"]["全負荷電流"][index]);
  const common = {
    ratedCurrentA,
    startingCurrentA: numberOf(data["電動機"]["始動電流"][index]),
    motorModel: data["電動機"]["形式"][index],
    mccb: pickBreaker(data["配線用遮断器_MCCB"]["形式"], index, ratedCurrentA),
    elcb: pickBreaker(data["漏電遮断器_ELCB"]["形式"], index, ratedCurrentA),
    catalog,
  };
  if (method === "direct") {
    const switchModel = [data["電磁開閉器_MS"]["形式"][0][index], data["電磁開閉器_MS"]["形式"][1]?.[index]].filter(Boolean).join(" / ");
    return { ...common, switchModel, contactorCurrentA: contactorCurrent(switchModel), heatRange: heatRange(data["電磁開閉器_MS"]["ヒートエレメント定格"][index]), wire: data["接続電線サイズ"][index] };
  }
  const option = (value: any) => Array.isArray(value) ? value.filter(Boolean).join(" / ") : value;
  return { ...common, mainContactor: option(data["電源用電磁接触器_MCm"][index]), starContactor: option(data["スター用電磁接触器_MCs"][0][index]), deltaContactor: option(data["デルタ用電磁接触器_MCd"][index]), olrModel: option(data["サーマルリレー_OLR"]["形式"][0][index]), heatRange: heatRange(data["サーマルリレー_OLR"]["ヒートエレメント定格"][index]), wire: data["接続電線サイズ"]["電源側_OLR"][index], loadWire: data["接続電線サイズ"]["負荷側_MCmMCd"][index] };
}
