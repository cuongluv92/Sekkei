import { addManufacturer, findManufacturerByName } from "@/lib/mock/manufacturers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { mapRowToRecord, parseTabularFile } from "@/lib/utils/importParsing";
import { tokenizeSpecification } from "@/lib/utils/partSearch";
import { extractDxfPartList } from "./dxfPartListExtract";
import { partDataService } from "./partDataService";
import type { PartAssemblyRow, PartData } from "@/lib/types";

export interface PartAssemblyImportRow extends Omit<PartAssemblyRow, "id"> {
  /**
   * 部品データ に登録済み、または今回の取り込み内の別の行と重複している
   * 可能性がある場合の情報 — 確認用の警告表示にだけ使う。このフィールドが
   * あるからといって自動的に何もしない: 登録する/しないはユーザーが確認画面
   * のチェックボックスで選ぶ (`registerImportedPartsInMaster` 参照)。
   * `exact: true` はメーカー・品名・型番・仕様・記号(個体番号を除く)が
   * すべて一致する場合、`exact: false` は仕様だけが一致する場合。
   */
  masterDuplicate?: { model: string; exact: boolean };
}

function normalize(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * 部品製作 に取り込んだ図面/Excel から自動登録された 部品データ は、メーカー
 * カタログや インポート 画面から登録した部品と混ざらないよう、別の source
 * ラベルを付ける — 自社の盤図に載っている自作/手配部品であって、メーカーの
 * 正式なカタログ品ではない場合があるため、区別できることが重要。
 */
export const AUTO_REGISTERED_SOURCE_LABEL = "部品製作から自動登録";

/**
 * 部品データ (メーカー master) doesn't require registering a manufacturer up
 * front in 設定 before it can be recognized — an imported DXF/Excel's メーカー
 * text is matched case-insensitively against existing manufacturers and, if
 * nothing matches, auto-registered as a new one, so it never falls back to
 * 未設定 just because nobody had typed that exact name into Settings yet.
 */
async function resolveManufacturerId(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const existing = findManufacturerByName(trimmed);
  if (existing) return existing.id;
  if (!isSupabaseConfigured()) return "";
  const created = await addManufacturer(trimmed);
  return created.id;
}

/** 仕様の先頭からこの件数のトークンが一致していれば同じ定格とみなす。 */
const SPEC_PREFIX_TOKEN_COUNT = 3;

/**
 * DXF の 仕様 欄には末尾に自由記述の注記が混ざることが多く (実物は
 * 「3P 50AF 30AT 盤内専用品」のように書かれる) — これは遮断器に限らず
 * 端子台・ブザーなど他の部品でも同じで、部品データ 側のきれいな仕様文字列
 * とは完全一致しない。仕様の先頭2〜3トークンさえ一致していれば同じ定格の
 * 部品とみなす — 末尾に付く自由記述の違いは無視してよい、という現場判断。
 * 仕様が空欄の行は対象外 (あてずっぽうで重量を借りない)。
 */
export function specificationLooselyMatches(rowSpecification: string, candidateSpecification: string): boolean {
  const rowTokens = tokenizeSpecification(rowSpecification);
  if (rowTokens.length === 0) return false;
  const candidateTokens = tokenizeSpecification(candidateSpecification);
  const prefixLength = Math.min(SPEC_PREFIX_TOKEN_COUNT, rowTokens.length);
  for (let i = 0; i < prefixLength; i++) {
    if (rowTokens[i] !== candidateTokens[i]) return false;
  }
  return true;
}

/**
 * 型番(model)・仕様・メーカー・品名 から 部品データ に登録済みの一致する部品を
 * 探し、その重量を借りてくる — DXF の部品リストグリッドや大半の Excel BOM に
 * 重量列は無いので、取り込んだだけでは重量が空のままになってしまうため。
 * インポート/カタログ由来のデータも対象に含める (重量だけは 自動登録 と
 * インポート のデータをまたいで借りてよい、という現場判断)。
 * 型番が一致しない部品は対象外 (誤った重量を拾うほうが実害が大きい)。
 */
function findWeightMatch(
  row: { model: string; specification: string; manufacturerId: string },
  master: PartData[],
): number | undefined {
  const model = normalize(row.model);
  if (!model) return undefined;
  const candidates = master.filter((p) => normalize(p.model) === model && p.weight != null);
  if (candidates.length === 0) return undefined;
  const byMaker = row.manufacturerId
    ? candidates.filter((p) => p.manufacturerId === row.manufacturerId)
    : candidates;
  const pool = byMaker.length > 0 ? byMaker : candidates;
  const bySpec = row.specification
    ? pool.filter((p) => specificationLooselyMatches(row.specification, p.specification))
    : pool;
  return (bySpec.length > 0 ? bySpec : pool)[0]?.weight;
}

/**
 * 記号は盤内の個体番号込みで書かれることが多い — 単発 (MCCB1)、連番の
 * 範囲 (MCCB1～3, MCCB1-3)、カンマ列挙 (MCCB1,2,3) のどれも実物の図面で
 * 見かける。部品データ に型番として登録するときはこの個体番号部分を落とし、
 * 部品の種類そのものを表す記号 (MCCB) だけを残す。末尾が数字・区切り文字
 * だけで構成される部分をまとめて切り落とす (単純な「末尾の数字だけ」を
 * 切る実装だと、区切り文字を挟む範囲/列挙表記が切り残ってしまうため)。
 * 全体が数字だけの記号 (捨てると空になる場合) はそのまま残す。
 */
const SYMBOL_INSTANCE_SUFFIX = /[\s,、.\-‐－―~～_\d]*\d[\s,、.\-‐－―~～_\d]*$/;

export function stripSymbolInstanceNumber(symbol: string): string {
  const trimmed = symbol.trim();
  const stripped = trimmed.replace(SYMBOL_INSTANCE_SUFFIX, "").trim();
  return stripped || trimmed;
}

/**
 * 部品製作 の取込から自動登録される 部品データ の重複可能性を検出する —
 * どちらの判定も、既存の 部品データ のうち自動登録 (AUTO_REGISTERED_SOURCE_LABEL)
 * のものだけを対象にする。インポート画面/カタログ由来のデータは別世界
 * (メーカー正式カタログ品と自作/手配品を混同すると、重複でないものを
 * 勝手にまとめてしまいかねない) なので比較対象に含めない。
 *
 * exact: メーカー・品名・型番・仕様、かつ記号 (個体番号を除いた型) まで
 * すべて一致 — 同じ物理部品を指している可能性が高い。型番・仕様が空欄の
 * 行同士というだけで無関係の部品を同一視しないよう、記号が空の行は対象外。
 * spec: 型番は違うが仕様だけが一致 — 型番違いの互換品や別メーカー品の
 * 可能性がある、という参考情報。
 *
 * どちらも「検出」するだけで、実際に登録するかしないかは
 * `registerImportedPartsInMaster` がユーザーの確認 (チェックボックス) を
 * 経てから判断する — ここでは絶対に自動で何も書き込まない。
 */
function findMasterDuplicate(
  row: { symbol: string; manufacturerId: string; category: string; model: string; specification: string },
  autoRegisteredMaster: PartData[],
): { model: string; exact: boolean } | undefined {
  const model = normalize(row.model);
  const specification = normalize(row.specification);
  const category = normalize(row.category);
  const strippedSymbol = normalize(stripSymbolInstanceNumber(row.symbol));

  if (strippedSymbol) {
    const exact = autoRegisteredMaster.find(
      (p) =>
        p.manufacturerId === row.manufacturerId &&
        normalize(p.category) === category &&
        normalize(p.model) === model &&
        normalize(p.specification) === specification &&
        normalize(stripSymbolInstanceNumber(p.symbol ?? "")) === strippedSymbol,
    );
    if (exact) return { model: exact.model, exact: true };
  }

  if (specification) {
    const sameSpec = autoRegisteredMaster.find(
      (p) => normalize(p.specification) === specification && normalize(p.model) !== model,
    );
    if (sameSpec) return { model: sameSpec.model, exact: false };
  }
  return undefined;
}

/**
 * 同じ取込内の複数行が同じ部品を指している場合 (例: MCCB1/MCCB2 が同じ
 * 記号「MCCB」に丸められ、型番・仕様・メーカーも同じ) も検出できるよう、
 * 部品データ の既存データに加えて「この取込内で先に処理した行」も
 * 重複判定の対象に加えていく。最初に出てきた行は重複なし (これが登録される
 * 側)、2件目以降が「重複かもしれません」の対象になる。
 */
function annotateMasterDuplicates(
  rows: PartAssemblyImportRow[],
  master: PartData[],
): PartAssemblyImportRow[] {
  const autoRegisteredMaster = [...master.filter((p) => p.source === AUTO_REGISTERED_SOURCE_LABEL)];
  return rows.map((row) => {
    const masterDuplicate = findMasterDuplicate(
      { symbol: row.symbol, manufacturerId: row.manufacturerId, category: row.name, model: row.model, specification: row.specification },
      autoRegisteredMaster,
    );
    if (!masterDuplicate) {
      // 今回の行がこのキーの「最初の1件」として扱われるよう、以降の行の
      // 重複判定対象に加えておく (DB へはまだ何も書いていない、あくまで
      // このプレビュー内の判定用の一時データ)。
      autoRegisteredMaster.push({
        id: "",
        category: row.name,
        manufacturerId: row.manufacturerId,
        model: row.model,
        specification: row.specification,
        symbol: row.symbol,
        source: AUTO_REGISTERED_SOURCE_LABEL,
        files: [],
        updatedAt: "",
      });
    }
    return { ...row, masterDuplicate };
  });
}

/**
 * 部品データ に新規レコードとして登録する — 重複判定はすでに
 * `annotateMasterDuplicates`/`registerImportedPartsInMaster` の側で
 * 済んでいるので、ここでは常に作成する (自動で「既にある」と判断して
 * 黙ってスキップすることはしない — 型番・仕様が空欄同士というだけで
 * 無関係の部品を同一視してしまう事故を避けるため)。
 */
async function createMasterRecord(row: {
  symbol: string;
  name: string;
  manufacturerId: string;
  model: string;
  specification: string;
  weight?: number;
}): Promise<boolean> {
  if ((!row.model.trim() && !row.symbol.trim()) || !isSupabaseConfigured()) return false;
  await partDataService.create({
    symbol: stripSymbolInstanceNumber(row.symbol) || undefined,
    category: row.name,
    manufacturerId: row.manufacturerId,
    model: row.model,
    specification: row.specification,
    weight: row.weight,
    source: AUTO_REGISTERED_SOURCE_LABEL,
    files: [],
  });
  return true;
}

export interface PartAssemblyImportResult {
  rows: PartAssemblyImportRow[];
  /** False only for a DXF with no recognizable 部品リスト grid — an Excel/CSV with zero data rows still returns found: true, rows: []. */
  found: boolean;
}

export interface RegisterImportedPartsResult {
  /** 部品データ に実際に新規登録された件数。 */
  created: number;
  /** 型番・記号がどちらも空で登録しようがなかった、またはユーザーが重複チェックを外した件数。 */
  skipped: number;
}

/**
 * 取り込み確認 (プレビュー) で「はい」が押された後にだけ呼ぶ — 部品データ への
 * 書き込みはここでのみ発生する。重複の可能性がある行 (`masterDuplicate` 付き)
 * は、`registerDuplicatesAnyway` にその行の index が入っている場合だけ登録
 * する — ユーザーが確認画面で「別の部品として登録する」を選んだ行。逆に
 * `masterDuplicate` の無い行は毎回必ず登録する (自動でのスキップ判断はしない)。
 * 呼び出し側が「部品リストへの取込」と「部品データへの新規登録」を別々の
 * 結果として案内できるよう、実際に登録できた件数を返す (部品製作 の
 * 取込トーストが「n件取り込みました」だけだと、部品データ 側が実際には
 * 0件だったケースがあっても同じ成功表示になってしまい紛らわしいため)。
 */
export async function registerImportedPartsInMaster(
  rows: PartAssemblyImportRow[],
  registerDuplicatesAnyway: Set<number>,
): Promise<RegisterImportedPartsResult> {
  let created = 0;
  let skipped = 0;
  // Sequential, not Promise.all — see `annotateMasterDuplicates`'s comment:
  // duplicate detection already accounts for earlier rows in this same
  // batch, but only holds if rows are actually created one at a time in
  // that same order (concurrent creates could otherwise still race).
  for (const [i, row] of rows.entries()) {
    if (row.masterDuplicate && !registerDuplicatesAnyway.has(i)) {
      skipped++;
      continue;
    }
    if (await createMasterRecord(row)) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * A real-world DXF's ASCII text (group codes' string values, including the
 * 記号/品名/... header labels) is not reliably UTF-8 — AutoCAD's Japanese
 * locale, and a lot of older/JW-CAD-family tooling, write it as Shift_JIS
 * (CP932) instead. `file.text()` always assumes UTF-8, which silently turns
 * every Japanese label into mojibake and makes `findHeaderFields` match
 * nothing (a DXF this app exported itself is unaffected — that text is
 * always produced as UTF-8 JS strings — this only bites a DXF authored
 * elsewhere). Try UTF-8 first (the common/fast case), and only re-decode as
 * Shift_JIS if that didn't find a recognizable 部品リスト header.
 */
async function decodeDxfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  if (extractDxfPartList(utf8Text).found) return utf8Text;
  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return utf8Text; // Shift_JIS decoder unavailable in this runtime — fall back to the UTF-8 read
  }
}

/**
 * Reads an already-filled 部品リスト (BOM) — either a DXF using the same
 * grid layout `部品製作` exports, or an Excel/CSV using the same 記号/品名/
 * メーカー/型式/仕様/重量/数量/備考 headers the インポート page already
 * recognizes — into ready-to-insert 部品製作 rows. Doesn't write to the
 * 案件's 部品リスト itself; the caller reviews/confirms before calling
 * `addRow`/`insertRowAt`/`addRows`. The one exception is メーカー: resolving
 * a name to an id auto-registers it as a new manufacturer when nothing
 * matches (small, harmless, idempotent master data — needed just to compute
 * weight-matching/display correctly in the preview). Registering a brand
 * new 部品データ record (heavier, and possibly ambiguous when 仕様 collides
 * with an existing different 型番) is deliberately deferred to
 * `registerImportedPartsInMaster`, called only after the user confirms.
 */
export async function parsePartAssemblyImportFile(file: File): Promise<PartAssemblyImportResult> {
  const master = isSupabaseConfigured() ? await partDataService.list() : [];

  if (file.name.toLowerCase().endsWith(".dxf")) {
    const text = await decodeDxfText(file);
    const { rows, found } = extractDxfPartList(text);
    const resolvedRows = await Promise.all(
      rows.map(async (r): Promise<PartAssemblyImportRow> => {
        const manufacturerId = await resolveManufacturerId(r.manufacturer);
        return {
          symbol: r.symbol,
          name: r.name,
          manufacturerId,
          model: r.model,
          specification: r.specification,
          weight: findWeightMatch({ model: r.model, specification: r.specification, manufacturerId }, master),
          quantity: r.quantity,
          remarks: r.remarks,
        };
      }),
    );
    return { found, rows: annotateMasterDuplicates(resolvedRows, master) };
  }

  const parsed = await parseTabularFile(file);
  const candidateRows = parsed
    .map((record) => mapRowToRecord(record, "part-data"))
    .filter((r) => r.symbol || r.category || r.model);
  const rows = await Promise.all(
    candidateRows.map(async (r): Promise<PartAssemblyImportRow> => {
      const manufacturerId = await resolveManufacturerId(r.manufacturer ?? "");
      const model = r.model ?? "";
      const specification = r.specification ?? "";
      return {
        symbol: r.symbol ?? "",
        name: r.category ?? "",
        manufacturerId,
        model,
        specification,
        weight: r.weight ?? findWeightMatch({ model, specification, manufacturerId }, master),
        quantity: r.quantity ?? 1,
        remarks: r.remarks ?? "",
      };
    }),
  );
  return { found: true, rows: annotateMasterDuplicates(rows, master) };
}
