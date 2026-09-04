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
