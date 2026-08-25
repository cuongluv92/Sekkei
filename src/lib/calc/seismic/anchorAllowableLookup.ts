import type { BoltDiameter, SeismicAnchorAllowable } from "@/lib/types";

/**
 * あと施工アンカーボルトの許容引抜荷重 (Ta) は、コンクリート厚さが厚いほど
 * 埋込み長さを取れて大きくなる — 逆に言えば、実際のコンクリート厚さが
 * 社内選定マスタに登録された値のちょうど中間だった場合、安全側に倒すには
 * 「登録されている厚さのうち、実測値を超えない範囲で最大のもの」の Ta を
 * 採用するのが正しい (実測値より厚い行を使うと、実際より高い Ta を
 * 過大評価してしまう)。選定の「入力値以上で最小」(次のサイズに切り上げ)
 * とは逆方向の丸め — 対象が「これだけ出せる」上限値であって「これだけ
 * 必要」という下限値ではないため。
 */
export function findAllowablePulloutKn(
  allowables: SeismicAnchorAllowable[],
  query: { manufacturerId: string; method: string; boltDiameter: BoltDiameter; concreteThicknessMm: number },
): number | null {
  const candidates = allowables
    .filter(
      (a) =>
        a.manufacturerId === query.manufacturerId &&
        a.method === query.method &&
        a.boltDiameter === query.boltDiameter &&
        a.concreteThicknessMm <= query.concreteThicknessMm,
    )
    .sort((a, b) => b.concreteThicknessMm - a.concreteThicknessMm);
  return candidates.length > 0 ? candidates[0].allowablePulloutKn : null;
}
