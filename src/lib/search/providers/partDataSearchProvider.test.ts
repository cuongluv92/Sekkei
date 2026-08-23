import { describe, expect, it, vi } from "vitest";
import type { PartData } from "@/lib/types";

const parts: PartData[] = [
  {
    id: "p1",
    category: "ブレーカー",
    manufacturerId: "m1",
    model: "NF125-SEP",
    specification: "3P 125AF/100AT",
    source: "社内DB",
    files: [],
    updatedAt: "2026-01-01",
  },
  {
    id: "p2",
    category: "ブレーカー",
    manufacturerId: "m1",
    model: "NF250-SEP",
    specification: "3P 250AF/125AT",
    source: "社内DB",
    files: [],
    updatedAt: "2026-01-01",
  },
];

vi.mock("@/lib/services", () => ({
  partDataService: {
    list: vi.fn(async () => parts),
    search: vi.fn(async (query: string) =>
      parts.filter((p) => p.specification.includes(query)),
    ),
  },
}));

const { partDataSearchProvider } = await import("./partDataSearchProvider");

describe("partDataSearchProvider — specOnly uses strict technical-token matching (not substring)", () => {
  it("without specOnly, falls back to the part-data master's own broad search", async () => {
    const hits = await partDataSearchProvider.search("3P 125AF/100AT");
    expect(hits.map((h) => h.id)).toEqual(["p1"]);
  });

  it("with specOnly, a bare unit token like AT matches every spec ending with it (AND semantics across parts)", async () => {
    const hits = await partDataSearchProvider.search("AT", { specOnly: true });
    expect(hits.map((h) => h.id).sort()).toEqual(["p1", "p2"]);
  });

  it("with specOnly, a number+unit token like 5AT does NOT loosely substring-match 125AT (spec exactness — never a false hit)", async () => {
    const hits = await partDataSearchProvider.search("5AT", {
      specOnly: true,
    });
    expect(hits).toEqual([]);
  });

  it("with specOnly, an exact number+unit token like 125AT matches only the part actually carrying it", async () => {
    const hits = await partDataSearchProvider.search("125AT", {
      specOnly: true,
    });
    expect(hits.map((h) => h.id)).toEqual(["p2"]);
  });

  it("carries spec=1 in the destination href when specOnly is used", async () => {
    const hits = await partDataSearchProvider.search("125AT", {
      specOnly: true,
    });
    expect(hits[0].href).toContain("spec=1");
  });
});
