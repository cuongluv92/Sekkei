import { addManufacturer, findManufacturerByName } from "@/lib/mock/manufacturers";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { mapRowToRecord, parseTabularFile } from "@/lib/utils/importParsing";
import { extractDxfPartList } from "./dxfPartListExtract";
import { partDataService } from "./partDataService";
import type { PartAssemblyRow, PartData } from "@/lib/types";

export interface PartAssemblyImportRow extends Omit<PartAssemblyRow, "id"> {
  /**
   * 仕様が既存の 部品データ と一致するが型番が異なる場合の、その既存レコードの
   * 型番 — 確認用の警告表示にだけ使う (このフィールドがあるからといって
   * 自動的に何もしない。登録するかはユーザーが確認画面で選ぶ)。
   */
  specDuplicateModel?: string;
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

/**
 * 型番(model)・仕様・メーカー・品名 から 部品データ に登録済みの一致する部品を
 * 探し、その重量を借りてくる — DXF の部品リストグリッドや大半の Excel BOM に
 * 重量列は無いので、取り込んだだけでは重量が空のままになってしまうため。
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
    ? pool.filter((p) => normalize(p.specification) === normalize(row.specification))
    : pool;
  return (bySpec.length > 0 ? bySpec : pool)[0]?.weight;
}

/**
 * 型番は違うが仕様が同じ既存の 部品データ がある場合、その型番を返す —
 * 同じ仕様の部品が別の型番でもう登録されている (別メーカー品や型番違いの
 * 互換品など) 可能性があるという警告のためだけで、自動では何もしない。
 */
function findSpecDuplicateModel(
  row: { model: string; specification: string },
  master: PartData[],
): string | undefined {
  const specification = normalize(row.specification);
  if (!specification) return undefined;
  const model = normalize(row.model);
  return master.find((p) => normalize(p.specification) === specification && normalize(p.model) !== model)?.model;
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
 * 取り込んだ行と同じ (メーカー・品名・型番・仕様) の 部品データ が無ければ、
 * 新規レコードとして自動登録する — 一度取り込んだ部品は次回から
 * 部品データ に「型番のある部品」として残るので、以降の取り込みは
 * 記号や仕様の完全一致だけで重量まで自動的に拾えるようになる。
 */
async function registerInMasterIfMissing(row: {
  symbol: string;
  name: string;
  manufacturerId: string;
  model: string;
  specification: string;
  weight?: number;
}): Promise<void> {
  if (!row.model.trim() || !isSupabaseConfigured()) return;
  const existing = await partDataService.findExisting({
    manufacturerId: row.manufacturerId,
    category: row.name,
    model: row.model,
    specification: row.specification,
  });
  if (existing) return;
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
}

export interface PartAssemblyImportResult {
  rows: PartAssemblyImportRow[];
  /** False only for a DXF with no recognizable 部品リスト grid — an Excel/CSV with zero data rows still returns found: true, rows: []. */
  found: boolean;
}

/**
 * 取り込み確認 (プレビュー) で「はい」が押された後にだけ呼ぶ — 部品データ への
 * 書き込みはここでのみ発生する。仕様が重複している行 (`specDuplicateModel`
 * 付き) は、`registerDuplicatesAnyway` にその行の index が入っている場合
 * だけ登録する — ユーザーが確認画面で「別の部品として登録する」を選んだ行。
 */
export async function registerImportedPartsInMaster(
  rows: PartAssemblyImportRow[],
  registerDuplicatesAnyway: Set<number>,
): Promise<void> {
  await Promise.all(
    rows.map((row, i) => {
      if (row.specDuplicateModel && !registerDuplicatesAnyway.has(i)) return undefined;
      return registerInMasterIfMissing(row);
    }),
  );
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
          specDuplicateModel: findSpecDuplicateModel({ model: r.model, specification: r.specification }, master),
        };
      }),
    );
    return { found, rows: resolvedRows };
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
        specDuplicateModel: findSpecDuplicateModel({ model, specification }, master),
      };
    }),
  );
  return { found: true, rows };
}
