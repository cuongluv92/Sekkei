type Voltage = "200V" | "400V";
type Method = "direct" | "starDelta";

interface MotorRow {
  ratedCurrentA: number;
  heaterA: number;
  contactorFrame?: string;
}

const HEATER_RANGE: Record<number, string> = {
  1.7: "1.4～2", 3.6: "2.8～4.4", 5: "4～6", 6.6: "5.2～8", 9: "7～11", 11: "9～13",
  15: "12～18", 22: "18～26", 29: "24～34", 35: "30～40", 42: "34～50", 54: "43～65",
  67: "54～80", 82: "65～100", 105: "85～125", 125: "100～150", 150: "120～180", 180: "140～220",
};

const STAR_MODELS: Record<Voltage, Record<number, { main: string; star: string; delta: string; thermal: string }>> = {
  "200V": {
    5.5: { main: "S-T20", star: "S-T10", delta: "S-T20", thermal: "TH-T25" },
    7.5: { main: "S-T21", star: "S-T12", delta: "S-T21", thermal: "TH-T65" },
    11: { main: "S-T35", star: "S-T20", delta: "S-T35", thermal: "TH-T65" },
    15: { main: "S-T50", star: "S-T25", delta: "S-T50", thermal: "TH-T65" },
    18.5: { main: "S-T50", star: "S-T35", delta: "S-T50", thermal: "TH-N120" },
    22: { main: "S-T65", star: "S-T35", delta: "S-T65", thermal: "TH-N120" },
    30: { main: "S-T80", star: "S-T50", delta: "S-T80", thermal: "TH-N120TAHZ" },
    37: { main: "S-T100", star: "S-T65", delta: "S-T100", thermal: "TH-N120TAHZ" },
    45: { main: "S-N125", star: "S-T65", delta: "S-N125", thermal: "TH-N220HZ" },
    55: { main: "S-N150", star: "S-T80", delta: "S-N150", thermal: "TH-N220HZ" },
  },
  "400V": {
    5.5: { main: "S-T12", star: "S-T10", delta: "S-T12", thermal: "TH-T25" },
    7.5: { main: "S-T20", star: "S-T10", delta: "S-T20", thermal: "TH-T25" },
    11: { main: "S-T20", star: "S-T12", delta: "S-T20", thermal: "TH-T25" },
    15: { main: "S-T21", star: "S-T20", delta: "S-T21", thermal: "TH-T65" },
    18.5: { main: "S-T25", star: "S-T20", delta: "S-T25", thermal: "TH-T65" },
    22: { main: "S-T35", star: "S-T20", delta: "S-T35", thermal: "TH-T65" },
    30: { main: "S-T50", star: "S-T25", delta: "S-T50", thermal: "TH-T65" },
    37: { main: "S-T50", star: "S-T35", delta: "S-T50", thermal: "TH-N120" },
    45: { main: "S-T65", star: "S-T35", delta: "S-T65", thermal: "TH-N120" },
    55: { main: "S-T65", star: "S-T50", delta: "S-T65", thermal: "TH-N120TAHZ" },
  },
};

const ROWS: Record<Voltage, Record<number, MotorRow>> = {
  "200V": {
    0.75: { ratedCurrentA: 3.6, heaterA: 3.6, contactorFrame: "T10～T21" },
    1.5: { ratedCurrentA: 6.4, heaterA: 6.6, contactorFrame: "T10～T25" },
    2.2: { ratedCurrentA: 9.4, heaterA: 9, contactorFrame: "T10～T35" },
    3.7: { ratedCurrentA: 15, heaterA: 15, contactorFrame: "T20～T35" },
    5.5: { ratedCurrentA: 22.3, heaterA: 22, contactorFrame: "T25～T65" },
    7.5: { ratedCurrentA: 29.1, heaterA: 29, contactorFrame: "T35～T80" },
    11: { ratedCurrentA: 41.6, heaterA: 42, contactorFrame: "T50～T100" },
    15: { ratedCurrentA: 57.1, heaterA: 54, contactorFrame: "T65～T100・N125" },
    18.5: { ratedCurrentA: 68.2, heaterA: 67, contactorFrame: "T80・T100・N125" },
    22: { ratedCurrentA: 81.4, heaterA: 82, contactorFrame: "T100・N125・N150" },
    30: { ratedCurrentA: 110, heaterA: 105, contactorFrame: "N125～N220" },
    37: { ratedCurrentA: 136, heaterA: 125, contactorFrame: "N150～N220" },
    45: { ratedCurrentA: 167, heaterA: 150, contactorFrame: "N180～N400" },
    55: { ratedCurrentA: 202, heaterA: 180, contactorFrame: "N220～N400" },
  },
  "400V": {
    0.75: { ratedCurrentA: 1.8, heaterA: 1.7, contactorFrame: "T10～T21" },
    1.5: { ratedCurrentA: 3.2, heaterA: 3.6, contactorFrame: "T10～T21" },
    2.2: { ratedCurrentA: 4.7, heaterA: 5, contactorFrame: "T10～T21" },
    3.7: { ratedCurrentA: 7.5, heaterA: 6.6, contactorFrame: "T12～T35" },
    5.5: { ratedCurrentA: 11.2, heaterA: 11, contactorFrame: "T20～T35" },
    7.5: { ratedCurrentA: 14.6, heaterA: 15, contactorFrame: "T20～T35" },
    11: { ratedCurrentA: 20.8, heaterA: 22, contactorFrame: "T25～T65" },
    15: { ratedCurrentA: 28.6, heaterA: 29, contactorFrame: "T35～T80" },
    18.5: { ratedCurrentA: 34.1, heaterA: 35, contactorFrame: "T50～T100" },
    22: { ratedCurrentA: 40.7, heaterA: 42, contactorFrame: "T50～T100" },
    30: { ratedCurrentA: 55, heaterA: 54, contactorFrame: "T65～T100・N125" },
    37: { ratedCurrentA: 68, heaterA: 67, contactorFrame: "T80・T100・N125・N150" },
    45: { ratedCurrentA: 83.5, heaterA: 82, contactorFrame: "T100・N125・N150" },
    55: { ratedCurrentA: 101, heaterA: 105, contactorFrame: "N125～N220" },
  },
};

export interface MitsubishiWsvResult extends MotorRow {
  startingConditionA: number;
  startingMultiplier: number;
  heaterRange: string;
  starterModel?: string;
  contactorModel?: string;
  thermalModel: string;
  mainContactor?: string;
  starContactor?: string;
  deltaContactor?: string;
}

export function findMitsubishiWsv(method: Method, voltage: Voltage, kw: number): MitsubishiWsvResult | null {
  const row = ROWS[voltage][kw];
  if (!row || (method === "starDelta" && kw < 5.5)) return null;
  const startingMultiplier = method === "direct" ? 12 : kw <= 7.5 ? 16 : kw <= 45 ? 17 : 18;
  const firstFrame = row.contactorFrame?.split(/[～・]/)[0];
  const star = method === "starDelta" ? STAR_MODELS[voltage][kw] : undefined;
  const thermalModel = star?.thermal ?? (row.heaterA <= 15 ? "TH-T18" : row.heaterA <= 22 ? "TH-T25" : row.heaterA <= 42 ? "TH-T50" : row.heaterA <= 54 ? "TH-T65" : row.heaterA <= 82 ? "TH-T100" : row.heaterA <= 125 ? "TH-N120TA" : "TH-N220RH");
  return {
    ...row,
    contactorFrame: method === "direct" ? row.contactorFrame : undefined,
    startingMultiplier,
    startingConditionA: Number((row.ratedCurrentA * startingMultiplier).toFixed(1)),
    heaterRange: HEATER_RANGE[row.heaterA],
    starterModel: firstFrame ? `MSO-${firstFrame}` : undefined,
    contactorModel: firstFrame ? `S-${firstFrame}` : undefined,
    thermalModel,
    mainContactor: star?.main,
    starContactor: star?.star,
    deltaContactor: star?.delta,
  };
}
