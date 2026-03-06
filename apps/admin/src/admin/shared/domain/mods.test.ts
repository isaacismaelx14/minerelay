import { describe, expect, it } from "vitest";

import type { AdminMod } from "@/admin/client/types";

import { computeServerModDiffSummary, mergeMods, sameMods } from "./mods";

function createMod(overrides: Partial<AdminMod> = {}): AdminMod {
  return {
    kind: "mod",
    name: "Example Mod",
    provider: "modrinth",
    side: "client",
    projectId: "project-a",
    versionId: "version-a",
    url: "https://example.com/mod.jar",
    sha256: "sha-a",
    ...overrides,
  };
}

describe("sameMods", () => {
  it("treats the same mods as equal regardless of order", () => {
    const left = [
      createMod({ projectId: "alpha", versionId: "1", sha256: "a" }),
      createMod({ projectId: "beta", versionId: "2", sha256: "b" }),
    ];
    const right = [left[1]!, left[0]!];

    expect(sameMods(left, right)).toBe(true);
  });
});

describe("mergeMods", () => {
  it("replaces incoming mods by project id while keeping untouched entries", () => {
    const merged = mergeMods(
      [
        createMod({ projectId: "alpha", versionId: "1", sha256: "a" }),
        createMod({ projectId: "beta", versionId: "1", sha256: "b" }),
      ],
      [createMod({ projectId: "beta", versionId: "2", sha256: "c" })],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((mod) => mod.projectId === "beta")?.versionId).toBe("2");
  });
});

describe("computeServerModDiffSummary", () => {
  it("counts only server-relevant changes", () => {
    const baseline = [
      createMod({ projectId: "alpha", side: "both", versionId: "1" }),
      createMod({ projectId: "beta", side: "server", versionId: "1" }),
      createMod({ projectId: "client-only", side: "client", versionId: "1" }),
    ];
    const current = [
      createMod({ projectId: "alpha", side: "both", versionId: "2" }),
      createMod({ projectId: "gamma", side: "server", versionId: "1" }),
      createMod({ projectId: "client-only", side: "client", versionId: "9" }),
    ];

    expect(computeServerModDiffSummary(current, baseline)).toEqual({
      add: 1,
      remove: 1,
      update: 1,
      keep: 0,
      hasChanges: true,
    });
  });
});
