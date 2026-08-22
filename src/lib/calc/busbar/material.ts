/**
 * Copper busbar material source — JIS H 3140. Scope and material grades
 * confirmed via JSA's public catalog listing and cross-checked engineering
 * references; the full clause-by-clause text (dimensional tolerances etc.)
 * has not been independently read, so `verified` covers only what
 * `verificationNote` says it covers — never extend a claim beyond that.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export const JIS_H_3140_COPPER_SOURCE: TechnicalSource = {
  standard: "JIS H 3140",
  edition: "2018",
  reference:
    "銅ブスバー（伸銅品）— 材料区分 C1020（無酸素銅、Cu純度99.96%以上）／ C1100（タフピッチ銅、Cu純度99.90%以上）、質別ごとの導電率規定",
  applicability: "配電盤・制御盤に使用する銅ブスバー素材（伸銅品）全般。",
  sourceType: "standard",
  verified: true,
  verificationNote:
    "規格名・適用範囲・材料区分（C1020/C1100）・質別（O/1/2H/H等で導電率97〜100% IACS）はJSA(日本規格協会)の公開カタログ情報および複数の技術資料で確認済み。個別の寸法公差や全条項の詳細数値は原本未参照のため、それらが必要な計算には別途原本確認が必要。",
};
