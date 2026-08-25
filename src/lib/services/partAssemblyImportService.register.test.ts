import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolated from partAssemblyImportService.test.ts on purpose: those tests
// exercise the real (unconfigured-Supabase) code path via
// `parsePartAssemblyImportFile`, where `isSupabaseConfigured()` is false and
// `master` is always `[]`. Testing `registerImportedPartsInMaster`'s actual
// DB-write behavior — the unconditional model-collision skip, and that a
// failed create() never throws out of the loop — needs Supabase to look
// "configured" and `partDataService.create` mocked, so it's kept in its own
// file/module-mock scope rather than risking the other file's tests.
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("./partDataService", () => ({
  partDataService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { partDataService } from "./partDataService";
import {
  AUTO_REGISTERED_SOURCE_LABEL,
  parsePartAssemblyImportFile,
  registerImportedPartsInMaster,
  type PartAssemblyImportRow,
} from "./partAssemblyImportService";

function makeRow(overrides: Partial<PartAssemblyImportRow> = {}): PartAssemblyImportRow {
  return {
    symbol: "MCCB1",
    name: "配線用遮断器",
    manufacturerId: "",
    model: "NF32",
    specification: "AC200V 5A",
    quantity: 1,
    remarks: "",
    ...overrides,
  };
}

describe("registerImportedPartsInMaster", () => {
  beforeEach(() => {
    vi.mocked(partDataService.create).mockReset();
    vi.mocked(partDataService.create).mockResolvedValue({} as never);
  });

  it("always skips a row flagged as a blocked (unique-model) duplicate, even when the caller asked to register it anyway", async () => {
    const rows = [makeRow({ masterDuplicate: { model: "NF32", exact: true, blocked: true } })];

    const result = await registerImportedPartsInMaster(rows, new Set([0]));

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(partDataService.create).not.toHaveBeenCalled();
  });

  it("counts a create() rejection (e.g. a raced unique-constraint violation) as skipped instead of throwing", async () => {
    vi.mocked(partDataService.create).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "part_data_model_key"'),
    );
    const rows = [makeRow()];

    await expect(registerImportedPartsInMaster(rows, new Set())).resolves.toEqual({ created: 0, skipped: 1 });
  });

  it("skips a row with a blank 型番 without attempting to create it (would collide with any other blank-model row)", async () => {
    const rows = [makeRow({ model: "" })];

    const result = await registerImportedPartsInMaster(rows, new Set());

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(partDataService.create).not.toHaveBeenCalled();
  });

  it("creates a row with a non-blank 型番 and no duplicate flag", async () => {
    const rows = [makeRow()];

    const result = await registerImportedPartsInMaster(rows, new Set());

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(partDataService.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "NF32", source: AUTO_REGISTERED_SOURCE_LABEL }),
    );
  });

  it("does not register a soft (non-blocked) duplicate unless its index is in registerDuplicatesAnyway", async () => {
    const rows = [makeRow({ model: "NF33", masterDuplicate: { model: "NF32", exact: false } })];

    const result = await registerImportedPartsInMaster(rows, new Set());

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(partDataService.create).not.toHaveBeenCalled();
  });
});

describe("parsePartAssemblyImportFile (自動登録 vs インポート separation)", () => {
  beforeEach(() => {
    vi.mocked(partDataService.list).mockReset();
  });

  it("does not treat an identical part already registered under インポート as a duplicate — 自動登録 and インポート must stay fully separate", async () => {
    vi.mocked(partDataService.list).mockResolvedValueOnce([
      {
        id: "existing-1",
        category: "配線用遮断器",
        manufacturerId: "",
        model: "NF32",
        specification: "AC200V 5A",
        symbol: "T1",
        source: "インポート",
        files: [],
        updatedAt: "",
      },
    ]);
    const csv = ["記号,品名,メーカー,型式,仕様", "MCCB1,配線用遮断器,,NF32,AC200V 5A"].join("\n");
    const file = new File([csv], "list.csv", { type: "text/csv" });

    const result = await parsePartAssemblyImportFile(file);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].masterDuplicate).toBeUndefined();
  });
});
