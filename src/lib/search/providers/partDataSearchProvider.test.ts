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

describe("partDataSearchProvider — specQuery AND-filters with strict technical-token matching (not substring)", () => {
  it("with no specQuery, falls back to the part-data master's own broad search on query alone", async () => {
    const hits = await partDataSearchProvider.search("3P 125AF/100AT");
    expect(hits.map((h) => h.id)).toEqual(["p1"]);
  });

  it("with specQuery alone (query blank), a bare unit token like AT matches every spec ending with it (AND semantics across parts)", async () => {
    const hits = await partDataSearchProvider.search("", { specQuery: "AT" });
    expect(hits.map((h) => h.id).sort()).toEqual(["p1", "p2"]);
  });

  it("with specQuery, a number+unit token like 5AT does NOT loosely substring-match 125AT (spec exactness — never a false hit)", async () => {
    const hits = await partDataSearchProvider.search("", {
      specQuery: "5AT",
    });
    expect(hits).toEqual([]);
  });

  it("with specQuery, an exact number+unit token like 125AT matches only the part actually carrying it", async () => {
    const hits = await partDataSearchProvider.search("", {
      specQuery: "125AT",
    });
    expect(hits.map((h) => h.id)).toEqual(["p2"]);
  });

  it("combines query and specQuery as an AND filter, narrowing a broad model-number match down to the exact spec", async () => {
    const hits = await partDataSearchProvider.search("NF", {
      specQuery: "125AT",
    });
    expect(hits.map((h) => h.id)).toEqual(["p2"]);
  });

  it("carries both q and spec in the destination href", async () => {
    const hits = await partDataSearchProvider.search("NF", {
      specQuery: "125AT",
    });
    expect(hits[0].href).toContain("q=NF");
    expect(hits[0].href).toContain("spec=125AT");
  });
});
