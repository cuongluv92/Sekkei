type Voltage = "200V" | "400V";
type Method = "direct" | "starDelta";

interface MotorRow {
  ratedCurrentA: number;
  heaterA: number;
  contactorFrame?: string;
}

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
}

export function findMitsubishiWsv(method: Method, voltage: Voltage, kw: number): MitsubishiWsvResult | null {
  const row = ROWS[voltage][kw];
  if (!row || (method === "starDelta" && kw < 5.5)) return null;
  const startingMultiplier = method === "direct" ? 12 : kw <= 7.5 ? 16 : kw <= 45 ? 17 : 18;
  return { ...row, contactorFrame: method === "direct" ? row.contactorFrame : undefined, startingMultiplier, startingConditionA: Number((row.ratedCurrentA * startingMultiplier).toFixed(1)) };
}
