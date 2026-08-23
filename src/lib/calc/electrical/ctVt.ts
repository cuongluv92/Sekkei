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
import { engineeringFundamentalSource, type TechnicalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import { firstValidationError, requirePositive } from "./validation";
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
export type InstrumentTransformerKind = "CT" | "VT";
export type InstrumentTransformerPurpose = "measurement" | "protection";

/**
 * 計測用CT（JIS C 1732-2:2025）・計測用VT（JIS C 1732-3:2025）は、両方とも
 * 規格名「計器用変成器（標準用及び一般計測用）」が示す通り標準用及び
 * 一般計測用に限定された規格であり、保護用（リレー動作用）の特性は
 * 対象外。保護用CT/VTにこの計測用の規格・表を流用すると、要求される
 * 過電流特性（5P/10P等）を満たさない機器を誤って選定する危険があるため、
 * 保護用は必ず別ソースとして扱い、計測用の規格番号を一切表示しない。
 */
export const CT_MEASUREMENT_SOURCE: TechnicalSource = {
  standard: "JIS C 1732-2",
  edition: "2025",
  reference: "計器用変成器（標準用及び一般計測用）－第2部：変流器",
  applicability: "標準用及び一般計測用の変流器（計測用CT）",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "規格番号・対象（標準用及び一般計測用の変流器）はWeb検索により複数資料で確認できたが、当システムは規格原文" +
    "（日本規格協会等の正規頒布物）そのものは未確認。精度階級（例: 0.5級、1.0級）・許容誤差等の数値は本計算機に" +
    "一切含まれていない（一次⇔二次の比の換算のみ）。本番運用前に規格原本（JSA等）を確認すること。",
};
export const VT_MEASUREMENT_SOURCE: TechnicalSource = {
  standard: "JIS C 1732-3",
  edition: "2025",
  reference: "計器用変成器（標準用及び一般計測用）－第3部：計器用変圧器",
  applicability: "標準用及び一般計測用の計器用変圧器（計測用VT）",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "規格番号・対象（標準用及び一般計測用の計器用変圧器）はWeb検索により複数資料で確認できたが、当システムは規格原文" +
    "（日本規格協会等の正規頒布物）そのものは未確認。精度階級・許容誤差等の数値は本計算機に一切含まれていない" +
    "（一次⇔二次の比の換算のみ）。本番運用前に規格原本（JSA等）を確認すること。",
};
export const CT_PROTECTION_SOURCE: TechnicalSource = {
  standard: "—",
  edition: "—",
  reference: "保護用変流器（過電流特性 5P/10P等）の該当規格番号は当システムで未特定",
  applicability: "保護用変流器（継電器動作用）",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "保護用CTはJIS C 1732-2（計測用CTの規格、標準用及び一般計測用限定）とは要求される過電流特性が異なり、" +
    "同規格の数値・表を保護用に流用することはできない。当システムでは保護用CTの該当規格番号を未特定・未確認のため、" +
    "精度階級・過電流定数等の数値は一切保持していない。必ず対象機器の銘板・試験成績書、および正式な規格原本で確認すること。",
};
export const VT_PROTECTION_SOURCE: TechnicalSource = {
  standard: "—",
  edition: "—",
  reference: "保護用計器用変圧器の該当規格番号は当システムで未特定",
  applicability: "保護用計器用変圧器（継電器動作用）",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "保護用VTはJIS C 1732-3（計測用VTの規格、標準用及び一般計測用限定）とは要求特性が異なる可能性があり、" +
    "同規格をそのまま保護用に流用することはできない。当システムでは保護用VTの該当規格番号を未特定・未確認のため、" +
    "数値は一切保持していない。必ず対象機器の銘板・試験成績書、および正式な規格原本で確認すること。",
};

function instrumentTransformerStandardSource(
  kind: InstrumentTransformerKind,
  purpose: InstrumentTransformerPurpose,
): TechnicalSource {
  if (purpose === "protection") {
    return kind === "CT" ? CT_PROTECTION_SOURCE : VT_PROTECTION_SOURCE;
  }
  return kind === "CT" ? CT_MEASUREMENT_SOURCE : VT_MEASUREMENT_SOURCE;
}

/**
 * `kind`/`purpose` never affect the ratio math itself (それは共通の
 * RATIO_SOURCE のまま) — they only select which規格ソースを追加提示するか。
 * 保護用は計測用JISの番号を一切流用せず、必ず別の「未特定」ソースになる。
 */
export function solveInstrumentTransformerRatio(
  known: KnownValues<InstrumentTransformerVar>,
  target: InstrumentTransformerVar,
  kind: InstrumentTransformerKind = "CT",
  purpose: InstrumentTransformerPurpose = "measurement",
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.primary, "一次側値"),
    requirePositive(known.secondary, "二次側値"),
    requirePositive(known.ratio, "比"),
  );
  if (invalid) return invalid;
  const result = solveByRules(instrumentTransformerRatioRules, known, target);
  if (!result.ok) return result;
  return {
    ...result,
    sources: [...result.sources, instrumentTransformerStandardSource(kind, purpose)],
  };
}

export const CT_PURPOSE_NOTE: Record<InstrumentTransformerPurpose, string> = {
  measurement:
    "計測用CTは電力量計・電流計など精密な測定を目的とし、定格負担時の精度階級（例: 0.5級、1.0級）で管理されます。" +
    "本計算機は比の換算のみを行い、精度階級の数値は保持していません。必要な精度階級は対象機器の銘板・仕様書で確認してください。",
  protection:
    "保護用CTはリレー動作のための過電流域での特性（例: 5P、10Pなど）で管理され、計測用CTとは要求される特性が異なります。" +
    "本計算機は比の換算のみを行い、保護特性（過電流定数・精度階級）の数値は保持していません。" +
    "計測用の精度階級を保護用に流用しないでください。必要な特性は対象機器の銘板・仕様書で確認してください。",
};

/**
 * CTの精度階級「呼称」の一覧 — 選択しても計算には一切使われない、参考表示
 * 専用のラベル集合。許容誤差・過電流定数などの数値は一切保持しない
 * （選んだからといって「この機器はこの階級に適合している」と判定する
 * ものではない）。
 *
 * 計測用の呼称（0.1級〜3.0級）はJIS C 1732-2の一般的な階級呼称として
 * 複数の実務資料で確認できたが、当システムは規格原文の該当表を直接
 * 確認していない。保護用の呼称（5P/10P）は電気技術の教科書等で広く
 * 使われる一般的な呼称だが、CT_PROTECTION_SOURCEの通り該当規格番号
 * 自体を当システムでは未特定・未確認としているため、保護用は特に
 * 「参考表示のみ・規格適合の保証なし」であることを明示する。
 */
export const CT_ACCURACY_CLASS_OPTIONS: Record<InstrumentTransformerPurpose, readonly string[]> = {
  measurement: ["0.1級", "0.2級", "0.5級", "1.0級", "3.0級"],
  protection: ["5P", "10P"],
};

export const CT_ACCURACY_CLASS_NOTE: Record<InstrumentTransformerPurpose, string> = {
  measurement:
    "計測用CTの精度階級呼称（参考表示）です。選択は表示のみで、計算には使用されません。許容誤差等の数値は一切保持していないため、" +
    "実際に採用する精度階級は対象機器の銘板・試験成績書、およびJIS C 1732-2原本で必ず確認してください。",
  protection:
    "保護用CTの過電流特性呼称（参考表示）です。選択は表示のみで、計算には使用されません。5P10のような過電流定数を含む数値は" +
    "一切保持していません。該当規格番号自体が当システムで未特定（要確認）のため、この呼称の選択をもって規格適合を保証するものでは" +
    "なく、実際の特性は対象機器の銘板・試験成績書で必ず確認してください。",
};
