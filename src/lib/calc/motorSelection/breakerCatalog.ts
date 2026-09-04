const RATINGS = [3, 5, 10, 15, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 800] as const;

export function nextBreakerRating(currentA: number): number | null {
  return RATINGS.find((rating) => rating >= currentA) ?? null;
}

export function breakerCandidate(ratedA: number, maker: "mitsubishi" | "fuji", kind: "mccb" | "elcb") {
  const e = kind === "elcb";
  if (maker === "fuji") {
    if (ratedA <= 50) return { model: `${e ? "EW" : "BW"}50SAG`, icu: 10 };
    if (ratedA <= 125) return { model: `${e ? "EW" : "BW"}125JAG`, icu: 36 };
    if (ratedA <= 250) return { model: `${e ? "EW" : "BW"}250JAG`, icu: 36 };
    if (ratedA <= 400) return { model: `${e ? "EW" : "BW"}400RAG`, icu: 50 };
    return { model: `${e ? "EW" : "BW"} G-TWIN`, icu: null };
  }
  if (ratedA <= 60) return { model: `${e ? "NV" : "NF"}63-CV`, icu: 7.5 };
  if (ratedA <= 125) return { model: `${e ? "NV" : "NF"}125-CV`, icu: 30 };
  if (ratedA <= 250) return { model: `${e ? "NV" : "NF"}250-CV`, icu: 36 };
  if (ratedA <= 400) return { model: `${e ? "NV" : "NF"}400-CW`, icu: 50 };
  return { model: `${e ? "NV" : "NF"}-CW`, icu: null };
}

const MOTOR_KW = [0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55] as const;

const MITSU_BRANCH_200: Record<number, number> = { 0.75: 10, 1.5: 15, 2.2: 20, 3.7: 30, 5.5: 50, 7.5: 60, 11: 75, 15: 100, 18.5: 100, 22: 150, 30: 175, 37: 225, 45: 400, 55: 500 };
const MITSU_BRANCH_400: Record<number, number> = { 0.75: 5, 1.5: 10, 2.2: 10, 3.7: 20, 5.5: 30, 7.5: 30, 11: 50, 15: 60, 18.5: 60, 22: 75, 30: 100, 37: 100, 45: 125, 55: 175 };

export function mitsubishiMotorBranchRating(voltage: "200V" | "400V", motorKw: number): number | null {
  return (voltage === "200V" ? MITSU_BRANCH_200 : MITSU_BRANCH_400)[motorKw] ?? null;
}

const MAIN_200 = [
  [3, [20,20,30]], [4.5,[30,30,30,40]], [6.3,[40,40,40,50,60]], [8.2,[50,50,50,50,75,75]],
  [12,[60,60,60,60,75,75]], [15.7,[100,100,100,100,100,100,125,125]],
  [19.5,[100,100,100,100,100,100,125,125,125]], [23.2,[125,125,125,125,125,125,125,125,125,150]],
  [30,[150,150,150,150,150,150,150,150,150,150]], [37.5,[175,175,175,175,175,175,175,175,175,175,200]],
  [45,[200,200,200,200,200,200,200,200,200,200,200,350]], [52.5,[225,225,225,225,225,225,225,225,225,225,225,350,500]],
  [63.7,[300,300,300,300,300,300,300,300,300,300,300,350,500,500]],
] as const;
const MAIN_400 = [
  [3,[15,15,15]], [4.5,[15,15,15,20]], [6.3,[20,20,20,30,30]], [8.2,[30,30,30,30,40,40]],
  [12,[30,30,30,30,40,40]], [15.7,[50,50,50,50,50,50,60,75]], [19.5,[50,50,50,50,50,50,60,75,100]],
  [23.2,[60,60,60,60,60,60,60,75,100,100]], [30,[75,75,75,75,75,75,75,75,100,100]],
  [37.5,[100,100,100,100,100,100,100,100,100,100,125,125]], [45,[100,100,100,100,100,100,100,100,100,100,125,125,125]],
  [52.5,[125,125,125,125,125,125,125,125,125,125,125,125,125,150]],
  [63.7,[150,150,150,150,150,150,150,150,150,150,150,150,150,150]],
] as const;

export function mitsubishiMainMotorRating(voltage: "200V" | "400V", totalKw: number, largestKw: number): number | null {
  const column = MOTOR_KW.findIndex((kw) => kw >= largestKw);
  if (column < 0) return null;
  const row = (voltage === "200V" ? MAIN_200 : MAIN_400).find(([maxKw]) => totalKw <= maxKw);
  return row?.[1][column] ?? null;
}
