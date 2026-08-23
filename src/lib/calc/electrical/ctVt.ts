/**
 * CT・VT — 変流器・計器用変圧器の一次⇔二次、比、メーター読み値⇔実際の
 * 一次側値。
 *
 * 数式はCT・VTで共通（X_primary = X_secondary × 比）— 「メーター読み値から
 * 実際の一次側値を求める」というのも、この同じ比の関係そのもの（メーター
 * 読み値＝二次側値）である。
 *
 * 計測用CTと保護用CTは比の計算式自体は同じだが、要求される精度階級
 * （例: 計測用0.5級、保護用5P/10P）やその許容誤差はまったく異なる規格
 * 概念であり、本モジュールは一切の精度階級の数値を保持・計算しない —
 * `purpose` は表示ラベル・注記の切り替えにのみ用い、実際の精度階級は
 * 必ず対象機器の銘板・試験成績書で確認すること。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import type { KnownValues, SolveResult } from "./types";

const RATIO_SOURCE = engineeringFundamentalSource(
  "計器用変成器（CT/VT）の比の関係 一次側値 = 二次側値（メーター読み値） × 比",
  "変流器（CT）・計器用変圧器（VT）の一次・二次間、および二次側計測値から一次側実際値への換算",
);

export type InstrumentTransformerVar = "primary" | "secondary" | "ratio";
export const instrumentTransformerRatioRules: readonly Rule<InstrumentTransformerVar>[] = [
  {
    output: "primary",
    inputs: ["secondary", "ratio"],
    compute: ({ secondary, ratio }) => secondary * ratio,
    describe: (v, r) => ({
      formula: "一次側値 = 二次側値 × 比",
      substituted: `一次側値 = ${v.secondary} × ${v.ratio}`,
      resultLine: `≈ ${r}`,
    }),
    source: RATIO_SOURCE,
  },
  {
    output: "secondary",
    inputs: ["primary", "ratio"],
    compute: ({ primary, ratio }) => primary / ratio,
    describe: (v, r) => ({
      formula: "二次側値 = 一次側値 / 比",
      substituted: `二次側値 = ${v.primary} / ${v.ratio}`,
      resultLine: `≈ ${r}`,
    }),
    source: RATIO_SOURCE,
  },
  {
    output: "ratio",
    inputs: ["primary", "secondary"],
    compute: ({ primary, secondary }) => primary / secondary,
    describe: (v, r) => ({
      formula: "比 = 一次側値 / 二次側値",
      substituted: `比 = ${v.primary} / ${v.secondary}`,
      resultLine: `≈ ${r}`,
    }),
    source: RATIO_SOURCE,
  },
];

/**
 * CT/VTどちらでも同じ数式 — `known`/`target`は primary（一次側電流・電圧、
 * または実際の一次側値）／secondary（二次側電流・電圧、またはメーター
 * 読み値）／ratio のいずれか。呼び出し側のUIラベルがCT用/VT用/メーター
 * 換算用に切り替わるだけで、この関数自体は共通。
 */
export function solveInstrumentTransformerRatio(
  known: KnownValues<InstrumentTransformerVar>,
  target: InstrumentTransformerVar,
): SolveResult {
  return solveByRules(instrumentTransformerRatioRules, known, target);
}

export type InstrumentTransformerPurpose = "measurement" | "protection";
export const CT_PURPOSE_NOTE: Record<InstrumentTransformerPurpose, string> = {
  measurement:
    "計測用CTは電力量計・電流計など精密な測定を目的とし、定格負担時の精度階級（例: 0.5級、1.0級）で管理されます。" +
    "本計算機は比の換算のみを行い、精度階級の数値は保持していません。必要な精度階級は対象機器の銘板・仕様書で確認してください。",
  protection:
    "保護用CTはリレー動作のための過電流域での特性（例: 5P、10Pなど）で管理され、計測用CTとは要求される特性が異なります。" +
    "本計算機は比の換算のみを行い、保護特性（過電流定数・精度階級）の数値は保持していません。" +
    "計測用の精度階級を保護用に流用しないでください。必要な特性は対象機器の銘板・仕様書で確認してください。",
};
