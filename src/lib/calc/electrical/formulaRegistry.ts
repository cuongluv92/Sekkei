import type { SourceType } from "@/lib/calc/technicalSource";

/**
 * 電気技術計算 全体の「公式台帳」— 各エンジン（`src/lib/calc/electrical/*`）
 * が実際に実装している公式を、単位・適用条件・出典まで含めて一元的に
 * 記録する。目的は二つ:
 *
 *   1. 監査の一覧性 — 「どの公式が√3を使うか」「どの公式がまだ要確認か」
 *      をこのファイル1つで俯瞰できるようにする（エンジン10ファイルを
 *      個別に読まないと分からない、という状態を避ける）。
 *   2. 実装との乖離防止 — `formulaRegistry.test.ts` がここに書かれた
 *      係数・単位・√3の有無を、実際のエンジン関数の計算結果と突き合わせ、
 *      台帳とコードが食い違っていないかを機械的に検証する。
 *
 * ここに新しい公式を追加するときは、必ず対応するエンジンのRuleの
 * 係数・単位・適用条件（1φ/3φ・Y/Δ・遅れ/進み等）と一字一句一致させること
 * — 台帳とコードが食い違うくらいなら、台帳を持たない方がまだ安全である。
 */

/**
 * "both" = the engine takes a phase parameter and actually solves both 1φ
 * and 3φ with the correct √3 factor for each — never write "single" or
 * "three" for a formula the calculator itself lets the user switch between.
 */
export type Phase = "dc" | "single" | "three" | "both" | "n/a";
export type Connection = "Y" | "Delta" | "n/a";
/** Only meaningful for the 3φ side of a formula — describes that side's assumption, even when `phase` is "both". */
export type Balance = "balanced" | "unbalanced" | "n/a";
export type LoadType = "lagging" | "leading" | "both" | "n/a";
export type Direction = "forward" | "reverse" | "bidirectional";

export interface FormulaVariable {
  /** 式中の記号（例: "V", "cosφ"）。 */
  symbol: string;
  /** 単位。無次元量は空文字列。 */
  unit: string;
  descriptionJa: string;
}

export interface FormulaRegistryEntry {
  id: string;
  nameJa: string;
  /** 正規化された式（例: "S = √3 × V × I / 1000"）。 */
  expression: string;
  variables: readonly FormulaVariable[];
  /** 式が計算する結果の単位（`variables`のいずれかと重複することが多い）。 */
  resultUnit: string;
  /**
   * bidirectional = 対応するエンジンが順方向・逆方向どちらも実装している。
   * forward = 意図的に一方向のみ（例: 複素並列合成の逆算は不定問題）。
   * reverse は現状未使用（forwardのみを逆に呼ぶ形は登場しない）。
   */
  direction: Direction;
  applicability: string;
  /** 定義域・制約（例: "cosφ ∈ (0, 1]"）。任意。 */
  domain?: string;
  phase: Phase;
  connection?: Connection;
  balance?: Balance;
  loadType?: LoadType;
  sourceType: SourceType;
  standard: string;
  edition: string;
  reference: string;
  verified: boolean;
  verificationNote?: string;
  /** この公式を実装しているファイル（複数エンジンで同一の識見を使う場合は複数）。 */
  engineFiles: readonly string[];
}

export const FORMULA_REGISTRY: readonly FormulaRegistryEntry[] = [
  // ---- ohmsLaw.ts: DC ----
  {
    id: "dc_ohms_law",
    nameJa: "オームの法則",
    expression: "V = I × R",
    variables: [
      { symbol: "V", unit: "V", descriptionJa: "電圧" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "R", unit: "Ω", descriptionJa: "抵抗" },
    ],
    resultUnit: "V",
    direction: "bidirectional",
    applicability: "線形・定常状態の直流回路",
    domain: "R ≥ 0",
    phase: "dc",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "オームの法則 V = IR",
    verified: true,
    engineFiles: ["ohmsLaw.ts"],
  },
  {
    id: "dc_joule_power",
    nameJa: "直流電力の定義（ジュールの法則）",
    expression: "P = V × I（＝ I²R ＝ V²/R）",
    variables: [
      { symbol: "P", unit: "W", descriptionJa: "電力" },
      { symbol: "V", unit: "V", descriptionJa: "電圧" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "R", unit: "Ω", descriptionJa: "抵抗" },
    ],
    resultUnit: "W",
    direction: "bidirectional",
    applicability: "線形・定常状態の直流回路",
    domain: "R ≥ 0",
    phase: "dc",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "電力の定義 P = V × I（＝I²R＝V²/R）",
    verified: true,
    engineFiles: ["ohmsLaw.ts"],
  },

  // ---- ohmsLaw.ts: AC power triangle ----
  {
    id: "ac_apparent_power",
    nameJa: "皮相電力（1φ/3φ）",
    expression: "S = V × I / 1000（1φ）／ S = √3 × V × I / 1000（3φ）",
    variables: [
      { symbol: "S", unit: "kVA", descriptionJa: "皮相電力" },
      { symbol: "V", unit: "V", descriptionJa: "電圧（1φ: 相電圧または線間電圧、3φ: 線間電圧）" },
      { symbol: "I", unit: "A", descriptionJa: "電流（線電流）" },
    ],
    resultUnit: "kVA",
    direction: "bidirectional",
    applicability: "交流回路（正弦波・定常状態）。1φ・3φ両方をsolveAcPowerのphase引数で切り替える。3φは対称三相（平衡三相）を前提とする。",
    phase: "both",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "皮相電力・有効電力・力率の関係 S = V × I、P = S × cosφ",
    verified: true,
    engineFiles: ["ohmsLaw.ts"],
  },
  {
    id: "ac_active_power_direct",
    nameJa: "有効電力の直接式（1φ/3φ）",
    expression: "P = V × I × cosφ / 1000（1φ）／ P = √3 × V × I × cosφ / 1000（3φ）",
    variables: [
      { symbol: "P", unit: "kW", descriptionJa: "有効電力（電気入力側）" },
      { symbol: "V", unit: "V", descriptionJa: "電圧" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "cosφ", unit: "", descriptionJa: "力率" },
    ],
    resultUnit: "kW",
    direction: "bidirectional",
    applicability:
      "交流回路（正弦波・定常状態）。3φは対称三相（平衡三相）を前提とする。" +
      "ここでのPは電気入力側の有効電力であり、電動機の軸出力（銘板kW）ではない — " +
      "軸出力を扱う場合は電動機・周波数モジュール（η付き）を使用すること。",
    domain: "cosφ ∈ (0, 1]",
    phase: "both",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "皮相電力・有効電力・力率の関係 S = V × I、P = S × cosφ",
    verified: true,
    engineFiles: ["ohmsLaw.ts"],
  },
  {
    id: "ac_power_triangle",
    nameJa: "電力三角形",
    expression: "S² = P² + |Q|²",
    variables: [
      { symbol: "S", unit: "kVA", descriptionJa: "皮相電力" },
      { symbol: "P", unit: "kW", descriptionJa: "有効電力" },
      { symbol: "|Q|", unit: "kvar", descriptionJa: "無効電力の大きさ（√(S²−P²)の主値・非負のみ。遅れ/進みの符号は持たない）" },
    ],
    resultUnit: "kvar",
    direction: "bidirectional",
    applicability: "交流回路（正弦波・定常状態）。|Q|は√(S²−P²)の主値（非負）のみを返し、遅れ/進みの判定は行わない。",
    domain: "P ≤ S, |Q| ≤ S",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "電力三角形 S² = P² + Q²",
    verified: true,
    engineFiles: ["ohmsLaw.ts", "powerFactor.ts"],
  },
  {
    id: "ac_power_factor_def",
    nameJa: "力率の定義",
    expression: "cosφ = P / S",
    variables: [
      { symbol: "cosφ", unit: "", descriptionJa: "力率" },
      { symbol: "P", unit: "kW", descriptionJa: "有効電力" },
      { symbol: "S", unit: "kVA", descriptionJa: "皮相電力" },
    ],
    resultUnit: "",
    direction: "bidirectional",
    applicability: "交流回路（正弦波・定常状態）",
    domain: "cosφ ∈ (0, 1]",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "皮相電力・有効電力・力率の関係 S = V × I、P = S × cosφ",
    verified: true,
    engineFiles: ["ohmsLaw.ts", "powerFactor.ts"],
  },
  {
    id: "efficiency_def",
    nameJa: "効率の定義",
    expression: "η = 出力 / 入力",
    variables: [
      { symbol: "η", unit: "", descriptionJa: "効率" },
      { symbol: "出力", unit: "kW", descriptionJa: "出力電力" },
      { symbol: "入力", unit: "kW", descriptionJa: "入力電力" },
    ],
    resultUnit: "",
    direction: "bidirectional",
    applicability: "エネルギー変換機器全般（電動機・変圧器等）",
    domain: "η ∈ (0, 1]、出力 ≤ 入力",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "効率の定義 η = 出力 / 入力",
    verified: true,
    engineFiles: ["ohmsLaw.ts", "motorFrequency.ts"],
  },

  // ---- threePhase.ts ----
  {
    id: "three_phase_y_voltage",
    nameJa: "Y結線の線間電圧・相電圧",
    expression: "V_line = √3 × V_phase",
    variables: [
      { symbol: "V_line", unit: "V", descriptionJa: "線間電圧" },
      { symbol: "V_phase", unit: "V", descriptionJa: "相電圧" },
    ],
    resultUnit: "V",
    direction: "bidirectional",
    applicability: "対称三相交流・Y（スター）結線",
    phase: "three",
    connection: "Y",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "Y結線の線間電圧と相電圧の関係 V_line = √3 × V_phase",
    verified: true,
    engineFiles: ["threePhase.ts"],
  },
  {
    id: "three_phase_y_current",
    nameJa: "Y結線の線電流・相電流",
    expression: "I_line = I_phase",
    variables: [
      { symbol: "I_line", unit: "A", descriptionJa: "線電流" },
      { symbol: "I_phase", unit: "A", descriptionJa: "相電流" },
    ],
    resultUnit: "A",
    direction: "bidirectional",
    applicability: "対称三相交流・Y（スター）結線",
    phase: "three",
    connection: "Y",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "Y結線の線電流と相電流の関係 I_line = I_phase",
    verified: true,
    engineFiles: ["threePhase.ts"],
  },
  {
    id: "three_phase_delta_voltage",
    nameJa: "Δ結線の線間電圧・相電圧",
    expression: "V_line = V_phase",
    variables: [
      { symbol: "V_line", unit: "V", descriptionJa: "線間電圧" },
      { symbol: "V_phase", unit: "V", descriptionJa: "相電圧" },
    ],
    resultUnit: "V",
    direction: "bidirectional",
    applicability: "対称三相交流・Δ（デルタ）結線",
    phase: "three",
    connection: "Delta",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "Δ結線の線間電圧と相電圧の関係 V_line = V_phase",
    verified: true,
    engineFiles: ["threePhase.ts"],
  },
  {
    id: "three_phase_delta_current",
    nameJa: "Δ結線の線電流・相電流",
    expression: "I_line = √3 × I_phase",
    variables: [
      { symbol: "I_line", unit: "A", descriptionJa: "線電流" },
      { symbol: "I_phase", unit: "A", descriptionJa: "相電流" },
    ],
    resultUnit: "A",
    direction: "bidirectional",
    applicability: "対称三相交流・Δ（デルタ）結線",
    phase: "three",
    connection: "Delta",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "Δ結線の線電流と相電流の関係 I_line = √3 × I_phase",
    verified: true,
    engineFiles: ["threePhase.ts"],
  },

  // ---- transformer.ts ----
  {
    id: "transformer_capacity_conservation",
    nameJa: "理想変圧器の皮相電力保存",
    expression: "S1 = S2（S = V×I/1000〈1φ〉、S = √3×V×I/1000〈3φ〉）",
    variables: [
      { symbol: "S", unit: "kVA", descriptionJa: "皮相電力（容量）" },
      { symbol: "V1/V2", unit: "V", descriptionJa: "一次/二次電圧" },
      { symbol: "I1/I2", unit: "A", descriptionJa: "一次/二次電流" },
    ],
    resultUnit: "kVA",
    direction: "bidirectional",
    applicability:
      "変圧器の一次・二次間（結線方式を問わない、線間電圧×線電流ベース）。solveTransformerのphase引数で1φ/3φ両方に対応。" +
      "無損失・励磁電流無視の理想変圧器を前提とする。",
    phase: "both",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "理想変圧器の皮相電力保存 S1 = S2（無損失、励磁電流を無視）",
    verified: true,
    engineFiles: ["transformer.ts"],
  },
  {
    id: "transformer_turns_ratio_single_phase",
    nameJa: "単相変圧器の巻数比",
    expression: "a = N1/N2 = V1/V2 = I2/I1",
    variables: [
      { symbol: "a", unit: "", descriptionJa: "巻数比" },
      { symbol: "V1/V2", unit: "V", descriptionJa: "一次/二次電圧" },
    ],
    resultUnit: "",
    direction: "bidirectional",
    applicability:
      "単相変圧器のみ（結線の曖昧さがないため、電圧比がそのまま巻数比と一致する）。" +
      "三相変圧器の線間電圧比は、一次・二次が異なる結線の場合、巻数比と一致しないため対象外" +
      "（`computeLineVoltageRatio`は別関数として区別）。",
    phase: "single",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "単相変圧器の巻数比 a = N1/N2 = V1/V2 = I2/I1",
    verified: true,
    engineFiles: ["transformer.ts"],
  },

  // ---- motorFrequency.ts ----
  {
    id: "motor_sync_speed",
    nameJa: "同期速度の定義",
    expression: "ns = 120 × f / p",
    variables: [
      { symbol: "ns", unit: "min⁻¹", descriptionJa: "同期速度" },
      { symbol: "f", unit: "Hz", descriptionJa: "周波数" },
      { symbol: "p", unit: "", descriptionJa: "極数（正の偶数）" },
    ],
    resultUnit: "min⁻¹",
    direction: "bidirectional",
    applicability: "誘導電動機・同期電動機の回転磁界",
    domain: "f > 0、pは正の偶数",
    phase: "three",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "同期速度の定義 ns = 120 × f / p",
    verified: true,
    engineFiles: ["motorFrequency.ts"],
  },
  {
    id: "motor_slip",
    nameJa: "すべり率の定義",
    expression: "s = (ns − nr) / ns",
    variables: [
      { symbol: "s", unit: "（0〜1の比）", descriptionJa: "すべり率" },
      { symbol: "ns", unit: "min⁻¹", descriptionJa: "同期速度" },
      { symbol: "nr", unit: "min⁻¹", descriptionJa: "実回転数" },
    ],
    resultUnit: "",
    direction: "bidirectional",
    applicability: "誘導電動機。UIは常に0〜1の比として扱い、%表示との取り違えを防ぐ。",
    domain: "s ∈ [0, 1]、nr ≤ ns",
    phase: "three",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "すべり率の定義 s = (ns − nr) / ns",
    verified: true,
    engineFiles: ["motorFrequency.ts"],
  },
  {
    id: "motor_input_power",
    nameJa: "電動機の入力電力（1φ/3φ）",
    expression: "Pin = V × I × cosφ / 1000（1φ）／ Pin = √3 × V × I × cosφ / 1000（3φ）",
    variables: [
      { symbol: "Pin", unit: "kW", descriptionJa: "入力電力" },
      { symbol: "V", unit: "V", descriptionJa: "電圧" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "cosφ", unit: "", descriptionJa: "力率" },
    ],
    resultUnit: "kW",
    direction: "bidirectional",
    applicability:
      "交流電動機（正弦波・定常状態）。solveMotorPowerのphase引数で1φ/3φ両方に対応。" +
      "Pinは入力電力であり、Pout（軸出力）とはηを介してのみ関係する。",
    domain: "cosφ ∈ (0, 1]",
    phase: "both",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "電動機の入力電力 Pin = √3 × V × I × cosφ（三相）／ Pin = V × I × cosφ（単相）",
    verified: true,
    engineFiles: ["motorFrequency.ts"],
  },

  // ---- voltageDrop.ts ----
  {
    id: "voltage_drop_rx",
    nameJa: "R/X法（線路定数による近似計算）",
    expression: "ΔV = k × I × (r·cosφ ± x·sinφ) × L / 1000（k: DC/1φ=2、3φ=√3。遅れ=+、進み=−）",
    variables: [
      { symbol: "ΔV", unit: "V", descriptionJa: "電圧降下" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "r", unit: "Ω/km", descriptionJa: "こう長あたりの抵抗" },
      { symbol: "x", unit: "Ω/km", descriptionJa: "こう長あたりのリアクタンス" },
      { symbol: "cosφ", unit: "", descriptionJa: "力率" },
      { symbol: "L", unit: "m", descriptionJa: "こう長（片道）" },
    ],
    resultUnit: "V",
    direction: "bidirectional",
    applicability:
      "電線路のこう長・線路定数（R・X）が既知の回路（キルヒホッフの電圧則に基づく一般式）。" +
      "solveVoltageDropのmode引数でDC/1φ/3φすべてに対応。Lは片道こう長。負荷が遅れ（誘導性）か" +
      "進み（容量性）かで符号が変わるため、呼び出し側はloadTypeを明示的に選ばせ、遅れを暗黙の" +
      "デフォルトとして決め打ちしない。ΔVは符号付き — 負の値は電圧降下ではなく電圧上昇を意味し、" +
      "非負に丸めたり別途ブロックしたりしない。ΔV/I/r/L/xはすべて相互に解ける（xも含む）が、" +
      "cosφだけは入力専用 — ΔVからcosφを逆算するには非線形方程式（2次式）を解く必要があり、" +
      "誤った推定を避けるため本システムは未対応。UIでもcosφは求める値として選べない。",
    domain: "cosφ ∈ (0, 1]、x ≥ 0（DCではxを使用しない）。ΔVは符号付き（負＝電圧上昇）。",
    phase: "both",
    loadType: "both",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "電線こう長あたりのR・Xによる電圧降下 ΔV = k × I × (r·cosφ ± x·sinφ) × L / 1000",
    verified: true,
    engineFiles: ["voltageDrop.ts"],
  },
  {
    id: "voltage_drop_relations",
    nameJa: "電圧降下率・末端電圧の定義",
    expression: "ΔV% = ΔV / V0 × 100、末端電圧 = V0 − ΔV",
    variables: [
      { symbol: "ΔV%", unit: "%", descriptionJa: "電圧降下率" },
      { symbol: "ΔV", unit: "V", descriptionJa: "電圧降下" },
      { symbol: "V0", unit: "V", descriptionJa: "始端電圧" },
      { symbol: "末端電圧", unit: "V", descriptionJa: "末端電圧" },
    ],
    resultUnit: "%",
    direction: "bidirectional",
    applicability:
      "配電線路全般。ΔVは符号付き（負＝電圧上昇）を許容するため、末端電圧が始端電圧を上回るケースも" +
      "有効な結果として扱う — 末端電圧 ≤ 始端電圧という制約は課さない。",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "電圧降下率・末端電圧の定義 ΔV% = ΔV / V0 × 100、末端電圧 = V0 − ΔV",
    verified: true,
    engineFiles: ["voltageDrop.ts"],
  },
  {
    id: "voltage_drop_simplified_coefficient",
    nameJa: "簡易係数法による電圧降下",
    expression: "ΔV = k × L × I / (1000 × A)（単相2線式 k=35.6、三相3線式 k=30.8）",
    variables: [
      { symbol: "ΔV", unit: "V", descriptionJa: "電圧降下" },
      { symbol: "L", unit: "m", descriptionJa: "こう長" },
      { symbol: "I", unit: "A", descriptionJa: "電流" },
      { symbol: "A", unit: "mm²", descriptionJa: "断面積" },
    ],
    resultUnit: "V",
    direction: "bidirectional",
    applicability:
      "低圧配電線路・軟銅線を用いた簡易概算（正確な計算にはR/X法を推奨）。solveSimplifiedVoltageDropの" +
      "wiring引数で単相2線式・三相3線式両方に対応。",
    phase: "both",
    sourceType: "association_technical_document",
    standard: "JEAC 8001",
    edition: "2022",
    reference:
      "電圧降下の簡易計算式 ΔV = k × L × I / (1000 × A)（単相2線式 k=35.6、三相3線式 k=30.8、軟銅線・標準温度を想定）",
    verified: false,
    verificationNote:
      "この係数（35.6 / 30.8）は複数の実務資料・教科書でJEAC 8001内線規程の早見式として一致して引用されているが、" +
      "当システムはJEAC 8001:2022原本で該当条項・数値・適用条件（電線種別・温度条件等）を直接確認していない。" +
      "本番運用前に原本を確認すること。",
    engineFiles: ["voltageDrop.ts"],
  },

  // ---- powerFactor.ts ----
  {
    id: "capacitor_correction",
    nameJa: "力率改善に必要な進相コンデンサ容量",
    expression: "Qc = P × (tanφ1 − tanφ2)",
    variables: [
      { symbol: "Qc", unit: "kvar", descriptionJa: "必要コンデンサ容量" },
      { symbol: "P", unit: "kW", descriptionJa: "有効電力（改善前後で一定）" },
      { symbol: "cosφ1", unit: "", descriptionJa: "改善前の力率" },
      { symbol: "cosφ2", unit: "", descriptionJa: "目標力率" },
    ],
    resultUnit: "kvar",
    direction: "bidirectional",
    applicability:
      "有効電力Pが一定のまま力率をcosφ1からcosφ2へ改善する場合の基本式のみ。" +
      "実機コンデンサの規格容量選定・保護協調はこの式の対象外。過補償（進み力率化）は扱わない。",
    domain: "cosφ1, cosφ2 ∈ (0, 1]、cosφ1 ≤ cosφ2（改善方向のみ）",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "力率改善に必要な進相コンデンサ容量 Qc = P × (tanφ1 − tanφ2)",
    verified: true,
    engineFiles: ["powerFactor.ts"],
  },

  // ---- impedanceRLC.ts ----
  {
    id: "impedance_magnitude",
    nameJa: "インピーダンスの大きさ",
    expression: "|Z| = √(R² + |X|²)",
    variables: [
      { symbol: "|Z|", unit: "Ω", descriptionJa: "インピーダンスの大きさ（Z=R+jXの絶対値。Zそのもの＝複素数と混同しない）" },
      { symbol: "R", unit: "Ω", descriptionJa: "抵抗成分" },
      { symbol: "|X|", unit: "Ω", descriptionJa: "リアクタンス成分の大きさのみを扱う（符号付きXはparallelComplexImpedanceのみ）" },
    ],
    resultUnit: "Ω",
    direction: "bidirectional",
    applicability: "R・Xの直列回路（RとXが直交成分であることを前提とする一般式）",
    domain: "R, |X| ≥ 0、R ≤ |Z|、|X| ≤ |Z|",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "インピーダンスの大きさ Z = √(R² + X²)",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "inductive_reactance",
    nameJa: "誘導性リアクタンス",
    expression: "XL = 2π × f × L",
    variables: [
      { symbol: "XL", unit: "Ω", descriptionJa: "誘導性リアクタンス" },
      { symbol: "f", unit: "Hz", descriptionJa: "周波数" },
      { symbol: "L", unit: "H", descriptionJa: "インダクタンス" },
    ],
    resultUnit: "Ω",
    direction: "bidirectional",
    applicability: "インダクタンスLを持つ素子の交流回路",
    domain: "f > 0, L > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "誘導性リアクタンス XL = 2π × f × L",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "capacitive_reactance",
    nameJa: "容量性リアクタンス",
    expression: "XC = 1 / (2π × f × C)",
    variables: [
      { symbol: "XC", unit: "Ω", descriptionJa: "容量性リアクタンス" },
      { symbol: "f", unit: "Hz", descriptionJa: "周波数" },
      { symbol: "C", unit: "F", descriptionJa: "静電容量" },
    ],
    resultUnit: "Ω",
    direction: "bidirectional",
    applicability: "静電容量Cを持つ素子の交流回路",
    domain: "f > 0, C > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "容量性リアクタンス XC = 1 / (2π × f × C)",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "lc_resonance",
    nameJa: "LC共振周波数",
    expression: "f0 = 1 / (2π√(LC))",
    variables: [
      { symbol: "f0", unit: "Hz", descriptionJa: "共振周波数" },
      { symbol: "L", unit: "H", descriptionJa: "インダクタンス" },
      { symbol: "C", unit: "F", descriptionJa: "静電容量" },
    ],
    resultUnit: "Hz",
    direction: "bidirectional",
    applicability:
      "理想的な単純LC回路（直列/並列共振、XL=XCとなる周波数）における一般式。" +
      "実際の回路網（複数のR/L/C素子、相互インダクタンス等を含む複雑なトポロジー）の共振特性を" +
      "厳密に表すものではなく、単純なLC回路の近似としてのみ用いること。",
    domain: "L > 0, C > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "直列/並列共振周波数 f0 = 1 / (2π√(LC))（XL = XCとなる周波数）",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "series_rx_combination",
    nameJa: "R・|X|の直列合成（大きさのみ）",
    expression: "R_total = R1 + R2、|X_total| = |X1| + |X2|",
    variables: [
      { symbol: "R_total", unit: "Ω", descriptionJa: "合成抵抗" },
      { symbol: "|X_total|", unit: "Ω", descriptionJa: "合成リアクタンスの大きさ（大きさのみの単純加算。符号付き複素数の一般的な直列合成ではない）" },
    ],
    resultUnit: "Ω",
    direction: "bidirectional",
    applicability:
      "2素子の直列接続で、R成分・|X|成分（大きさのみ）をそれぞれ独立に加算する場合。符号付き（+誘導性/−容量性）の" +
      "直列合成には対応していない — その場合は並列合成（複素R+jX、並列のみ対応）を参照。",
    domain: "R1, R2, |X1|, |X2| ≥ 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "直列合成 R_total = R1 + R2、|X_total| = |X1| + |X2|",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "parallel_resistance_pure",
    nameJa: "純抵抗2つの並列合成",
    expression: "R_total = R1 × R2 / (R1 + R2)",
    variables: [
      { symbol: "R_total", unit: "Ω", descriptionJa: "合成抵抗" },
      { symbol: "R1", unit: "Ω", descriptionJa: "抵抗1" },
      { symbol: "R2", unit: "Ω", descriptionJa: "抵抗2" },
    ],
    resultUnit: "Ω",
    direction: "bidirectional",
    applicability: "リアクタンス成分を含まない、純抵抗どうしの並列接続のみ",
    domain: "R1, R2 > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "純抵抗2つの並列合成 R_total = R1 × R2 / (R1 + R2)",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },
  {
    id: "parallel_complex_impedance",
    nameJa: "複素インピーダンスの並列合成",
    expression: "Ztotal = Z1×Z2 / (Z1+Z2)（Z1=R1+jX1, Z2=R2+jX2）",
    variables: [
      { symbol: "Rtotal", unit: "Ω", descriptionJa: "合成インピーダンス実部" },
      { symbol: "Xtotal", unit: "Ω", descriptionJa: "合成インピーダンス虚部" },
      { symbol: "|Ztotal|", unit: "Ω", descriptionJa: "合成インピーダンスの大きさ" },
      { symbol: "R1,X1,R2,X2", unit: "Ω", descriptionJa: "各枝のR・X（Xは符号付き：+誘導性/−容量性）" },
    ],
    resultUnit: "Ω",
    direction: "forward",
    applicability:
      "R成分・X成分をそれぞれ持つ2つのインピーダンスの並列接続。前方向（R1,X1,R2,X2→Rtotal/Xtotal/Ztotal）" +
      "のみ — 逆算は4未知数に対し実質2つの独立した式しかない不定問題のため意図的に非対応。",
    domain: "R1, R2 ≥ 0（Xは符号付き、制約なし）",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "複素インピーダンスの並列合成 Ztotal = Z1×Z2 / (Z1+Z2)",
    verified: true,
    engineFiles: ["impedanceRLC.ts"],
  },

  // ---- shortCircuit.ts ----
  {
    id: "transformer_rated_current",
    nameJa: "変圧器の定格電流",
    expression: "In = kVA × 1000 / V（1φ）／ In = kVA × 1000 / (√3 × V)（3φ）",
    variables: [
      { symbol: "In", unit: "A", descriptionJa: "定格電流" },
      { symbol: "kVA", unit: "kVA", descriptionJa: "容量" },
      { symbol: "V", unit: "V", descriptionJa: "定格電圧" },
    ],
    resultUnit: "A",
    direction: "bidirectional",
    applicability:
      "変圧器の一次または二次側、定格電圧V・定格容量kVAが既知の場合。solveTransformerRatedCurrentの" +
      "phase引数で1φ/3φ両方に対応。",
    phase: "both",
    balance: "balanced",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "変圧器の定格電流 In = kVA × 1000 / V（単相）、In = kVA × 1000 / (√3 × V)（三相）",
    verified: true,
    engineFiles: ["shortCircuit.ts"],
  },
  {
    id: "simplified_short_circuit_current",
    nameJa: "%Zによる簡易短絡電流",
    expression: "Isc = In × 100 / %Z",
    variables: [
      { symbol: "Isc", unit: "A", descriptionJa: "短絡電流（簡易値）" },
      { symbol: "In", unit: "A", descriptionJa: "定格電流" },
      { symbol: "%Z", unit: "%", descriptionJa: "百分率インピーダンス" },
    ],
    resultUnit: "A",
    direction: "bidirectional",
    applicability:
      "変圧器単体の二次側端子における概算値。上位系統インピーダンス・ケーブル/母線インピーダンス・" +
      "電動機の逆流電流・発電機寄与・X/R比・非対称/波高値は一切考慮しない — 遮断器の遮断容量選定・" +
      "保護協調の最終OK/NG判定には使用不可。",
    domain: "%Z > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "%Zによる簡易短絡電流 Isc = In × 100 / %Z",
    verified: true,
    engineFiles: ["shortCircuit.ts"],
  },
  {
    id: "percent_z_base_conversion",
    nameJa: "%Zのベース容量換算（同一電圧ベース限定）",
    expression: "%Z_new = %Z_old × (kVA_new / kVA_old)",
    variables: [
      { symbol: "%Z_new", unit: "%", descriptionJa: "変換後の%Z" },
      { symbol: "%Z_old", unit: "%", descriptionJa: "変換前の%Z" },
      { symbol: "kVA_new/kVA_old", unit: "kVA", descriptionJa: "変換後/変換前のベース容量" },
    ],
    resultUnit: "%",
    direction: "bidirectional",
    applicability:
      "同一電圧ベース内で基準容量（ベースkVA）のみを変更する場合に限る。電圧ベースも同時に変える場合は" +
      "別途 (V_old/V_new)² の項が必要であり本ツールは対応していない。",
    domain: "%Z_old, kVA_old, %Z_new, kVA_new > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "%Zのベース容量換算 %Z_new = %Z_old × (kVA_new / kVA_old)（パーユニット法の基本式）",
    verified: true,
    engineFiles: ["shortCircuit.ts"],
  },
  {
    id: "breaking_capacity_check",
    nameJa: "定格遮断電流チェック（算術比較のみ）",
    expression: "sufficient ⟺ 定格遮断電流 ≥ Isc",
    variables: [
      { symbol: "Isc", unit: "A", descriptionJa: "短絡電流（簡易値）" },
      { symbol: "定格遮断電流", unit: "A/kA", descriptionJa: "ユーザーが入力する遮断器の定格遮断電流（対象機器の同一定格電圧・同一条件の値を使用）" },
    ],
    resultUnit: "—",
    direction: "forward",
    applicability:
      "計算されたIsc（簡易値）とユーザー自身が入力した遮断器の定格遮断電流との単純な数値比較のみ。" +
      "定格遮断電流は必ず対象機器の同一定格電圧・同一条件で読み取った値を使用すること。" +
      "正式なOK/NG判定ではなく、定格遮断電流の基準値そのものを本システムが規定・推測することはない。",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "定格遮断電流チェック sufficient ⟺ 定格遮断電流 ≥ Isc",
    verified: true,
    engineFiles: ["shortCircuit.ts"],
  },

  // ---- ctVt.ts ----
  {
    id: "instrument_transformer_ratio",
    nameJa: "計器用変成器（CT/VT）の比の関係",
    expression: "一次側値 = 二次側値（メーター読み値） × 比",
    variables: [
      { symbol: "一次側値", unit: "A または V", descriptionJa: "一次側の実際の値" },
      { symbol: "二次側値", unit: "A または V", descriptionJa: "二次側の値（メーター読み値）" },
      { symbol: "比", unit: "", descriptionJa: "変流比／変圧比" },
    ],
    resultUnit: "A または V",
    direction: "bidirectional",
    applicability: "変流器（CT）・計器用変圧器（VT）の一次・二次間、および二次側計測値から一次側実際値への換算",
    domain: "一次側値, 二次側値, 比 > 0",
    phase: "n/a",
    sourceType: "engineering_fundamental",
    standard: "—",
    edition: "—",
    reference: "計器用変成器（CT/VT）の比の関係 一次側値 = 二次側値（メーター読み値） × 比",
    verified: true,
    engineFiles: ["ctVt.ts"],
  },
  {
    id: "ct_measurement_standard",
    nameJa: "計測用CTの適用規格",
    expression: "（数値計算なし — 適用規格の参照情報のみ）",
    variables: [],
    resultUnit: "—",
    direction: "forward",
    applicability: "標準用及び一般計測用の変流器（計測用CT）のみ。保護用には適用しない。",
    phase: "n/a",
    sourceType: "standard",
    standard: "JIS C 1732-2",
    edition: "2025",
    reference: "計器用変成器（標準用及び一般計測用）－第2部：変流器",
    verified: false,
    verificationNote:
      "規格番号・対象はWeb検索により複数資料で確認できたが、規格原文そのものは未確認。精度階級・許容誤差等の数値は保持していない。",
    engineFiles: ["ctVt.ts"],
  },
  {
    id: "vt_measurement_standard",
    nameJa: "計測用VTの適用規格",
    expression: "（数値計算なし — 適用規格の参照情報のみ）",
    variables: [],
    resultUnit: "—",
    direction: "forward",
    applicability: "標準用及び一般計測用の計器用変圧器（計測用VT）のみ。保護用には適用しない。",
    phase: "n/a",
    sourceType: "standard",
    standard: "JIS C 1732-3",
    edition: "2025",
    reference: "計器用変成器（標準用及び一般計測用）－第3部：計器用変圧器",
    verified: false,
    verificationNote:
      "規格番号・対象はWeb検索により複数資料で確認できたが、規格原文そのものは未確認。精度階級・許容誤差等の数値は保持していない。",
    engineFiles: ["ctVt.ts"],
  },
  {
    id: "protection_ct_vt_standard_unidentified",
    nameJa: "保護用CT/VTの適用規格（未特定）",
    expression: "（数値計算なし — 未特定であることの明示のみ）",
    variables: [],
    resultUnit: "—",
    direction: "forward",
    applicability: "保護用変流器・保護用計器用変圧器（継電器動作用）",
    phase: "n/a",
    sourceType: "standard",
    standard: "—",
    edition: "—",
    reference: "保護用CT/VTの該当規格番号は当システムで未特定",
    verified: false,
    verificationNote:
      "計測用JIS（C 1732-2/3）は標準用及び一般計測用限定のため保護用に流用不可。保護用の該当規格を当システムは未特定・未確認。",
    engineFiles: ["ctVt.ts"],
  },

  // ---- highLowVoltage.ts ----
  {
    id: "voltage_classification",
    nameJa: "電圧区分（低圧・高圧・特別高圧）の判定",
    expression: "低圧: AC≤600V/DC≤750V、高圧: 低圧超〜7000V、特別高圧: 7000V超",
    variables: [{ symbol: "V", unit: "V", descriptionJa: "電圧" }],
    resultUnit: "—（区分名）",
    direction: "forward",
    applicability: "日本国内の電気工作物における電圧区分全般",
    domain: "V ≥ 0（AC/DCで低圧の上限が異なる: AC 600V, DC 750V）",
    phase: "n/a",
    sourceType: "law",
    standard: "電気設備に関する技術基準を定める省令",
    edition: "—",
    reference: "第2条（電圧の種別等：低圧・高圧・特別高圧の定義）",
    verified: false,
    verificationNote:
      "複数の実務資料・経産省解説資料の目次から同条番号・区分名を確認できたが、当システムは省令原文の条文" +
      "そのものは直接確認していないため、本番運用前に原本（e-Gov法令検索等）を確認すること。",
    engineFiles: ["highLowVoltage.ts"],
  },
] as const;

/** id の一意性を保証する（重複登録を防ぐ）。 */
export function findFormulaById(id: string): FormulaRegistryEntry | undefined {
  return FORMULA_REGISTRY.find((f) => f.id === id);
}
