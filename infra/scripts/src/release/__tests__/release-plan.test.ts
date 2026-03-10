import { describe, expect, it } from "vitest";
import type { ChangeItem } from "../changelog";
import {
  buildReleasePlan,
  buildReverseDependencyGraph,
  determineDetectedBump,
  isReleaseRelevantChange,
  type PlannedRelease,
  type TargetAnalysis,
  type TargetManifest,
} from "../release-plan";

function change(type: string, breaking = false): ChangeItem {
  return {
    type,
    section: "Section",
    scope: "scope",
    description: "description",
    commitHash: "abcd1234",
    breaking,
    details: [],
  };
}

function analysis(target: string, changes: ChangeItem[]): TargetAnalysis {
  return {
    target,
    changes,
    breakingNotes: [],
    detectedBump: determineDetectedBump(changes),
  };
}

function expectUniqueTargets(plan: PlannedRelease[]): void {
  const targets = plan.map((entry) => entry.target);
  expect(new Set(targets).size).toBe(targets.length);
}

function toNotesSourceMap(plan: PlannedRelease[]): Record<string, string> {
  return Object.fromEntries(
    plan.map((entry) => [entry.target, entry.releaseNotesSourceTarget]),
  );
}

const releaseableManifests: TargetManifest[] = [
  {
    target: "shared",
    packageName: "@minerelay/shared",
    dependencies: [],
  },
  {
    target: "ui",
    packageName: "@minerelay/ui",
    dependencies: [],
  },
  {
    target: "api",
    packageName: "@minerelay/api",
    dependencies: ["@minerelay/shared"],
  },
  {
    target: "admin",
    packageName: "@minerelay/admin",
    dependencies: ["@minerelay/shared", "@minerelay/ui"],
  },
  {
    target: "launcher",
    packageName: "@minerelay/launcher",
    dependencies: ["@minerelay/shared", "@minerelay/ui"],
  },
];

const releaseTargetOrder = ["shared", "ui", "api", "admin", "launcher"];
const dependencyRootTargets = ["shared", "ui"];

function baseAnalyses(overrides?: Partial<Record<string, ChangeItem[]>>) {
  return {
    shared: analysis("shared", overrides?.shared ?? []),
    ui: analysis("ui", overrides?.ui ?? []),
    api: analysis("api", overrides?.api ?? []),
    admin: analysis("admin", overrides?.admin ?? []),
    launcher: analysis("launcher", overrides?.launcher ?? []),
  } satisfies Record<string, TargetAnalysis>;
}

describe("release-plan", () => {
  // Scope boundary: this suite validates release-plan decisions only.
  // Workflow/tag-dispatch behavior is integration-level and tested elsewhere.
  it("treats all configured change types and any breaking change as release relevant", () => {
    expect(isReleaseRelevantChange(change("feat"))).toBe(true);
    expect(isReleaseRelevantChange(change("fix"))).toBe(true);
    expect(isReleaseRelevantChange(change("perf"))).toBe(true);

    expect(isReleaseRelevantChange(change("docs", true))).toBe(true);
    expect(isReleaseRelevantChange(change("refactor", true))).toBe(true);

    expect(isReleaseRelevantChange(change("docs"))).toBe(true);
    expect(isReleaseRelevantChange(change("style"))).toBe(true);
    expect(isReleaseRelevantChange(change("refactor"))).toBe(true);
    expect(isReleaseRelevantChange(change("test"))).toBe(true);
    expect(isReleaseRelevantChange(change("chore"))).toBe(true);
    expect(isReleaseRelevantChange(change("build"))).toBe(true);
    expect(isReleaseRelevantChange(change("ci"))).toBe(true);
  });

  it("builds reverse dependency graph dynamically", () => {
    const graph = buildReverseDependencyGraph(releaseableManifests);
    expect(graph.get("shared")).toEqual(["admin", "api", "launcher"]);
    expect(graph.get("ui")).toEqual(["admin", "launcher"]);
    expect(graph.get("api")).toBeUndefined();
  });

  it("fans out ui-only style changes to admin and launcher in auto mode", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ ui: [change("style")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "ui",
        reason: "direct",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("fans out shared-only changes to configured dependents in auto mode", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ shared: [change("feat")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("marks shared direct and launcher direct when both changed", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        launcher: [change("fix")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "direct",
        releaseNotesSourceTarget: "launcher",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("marks shared direct and api direct when both changed", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        api: [change("fix")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      { target: "api", reason: "direct", releaseNotesSourceTarget: "api" },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("marks shared direct and admin direct when both changed", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        admin: [change("perf")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("keeps shared direct while api and admin stay direct when all three changed", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        api: [change("fix")],
        admin: [change("perf")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      { target: "api", reason: "direct", releaseNotesSourceTarget: "api" },
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("uses direct releases for all targets when all changed directly", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        api: [change("fix")],
        admin: [change("perf")],
        launcher: [change("feat")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      { target: "api", reason: "direct", releaseNotesSourceTarget: "api" },
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
      {
        target: "launcher",
        reason: "direct",
        releaseNotesSourceTarget: "launcher",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("treats configured non-breaking patch change types as direct releases", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [
          change("docs"),
          change("style"),
          change("refactor"),
          change("test"),
          change("chore"),
          change("build"),
          change("ci"),
        ],
        api: [change("docs")],
        admin: [change("chore")],
        launcher: [change("refactor")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "direct",
        releaseNotesSourceTarget: "api",
      },
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
      {
        target: "launcher",
        reason: "direct",
        releaseNotesSourceTarget: "launcher",
      },
    ]);
  });

  it("returns empty release plan when there are no changes", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses(),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([]);
  });

  it("overrides explicit selections when shared changed", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ shared: [change("fix")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["launcher"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("respects explicit selections when shared did not change", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ launcher: [change("fix")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["launcher"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "launcher",
        reason: "direct",
        releaseNotesSourceTarget: "launcher",
      },
    ]);
  });

  it("releases multiple explicit targets without unrelated fan-out", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        api: [change("fix")],
        admin: [change("feat")],
        launcher: [change("perf")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["api", "admin"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      { target: "api", reason: "direct", releaseNotesSourceTarget: "api" },
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("releases only api when api changed directly", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ api: [change("fix")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      { target: "api", reason: "direct", releaseNotesSourceTarget: "api" },
    ]);
  });

  it("releases only admin when admin changed directly", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ admin: [change("feat")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "admin",
        reason: "direct",
        releaseNotesSourceTarget: "admin",
      },
    ]);
  });

  it("releases only launcher when launcher changed directly", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ launcher: [change("perf")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "launcher",
        reason: "direct",
        releaseNotesSourceTarget: "launcher",
      },
    ]);
  });

  it("does not include packages that do not depend on shared during shared-only fan-out", () => {
    const manifests: TargetManifest[] = [
      ...releaseableManifests,
      {
        target: "docs-site",
        packageName: "@minerelay/docs-site",
        dependencies: [],
      },
    ];

    const plan = buildReleasePlan({
      targetOrder: [...releaseTargetOrder, "docs-site"],
      analyses: {
        ...baseAnalyses({ shared: [change("feat")] }),
        "docs-site": analysis("docs-site", []),
      },
      reverseDependencyGraph: buildReverseDependencyGraph(manifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
  });

  it("includes additional configured package that depends on shared in shared-only fan-out", () => {
    const manifests: TargetManifest[] = [
      ...releaseableManifests,
      {
        target: "ui",
        packageName: "@minerelay/ui",
        dependencies: ["@minerelay/shared"],
      },
    ];

    const plan = buildReleasePlan({
      targetOrder: [...releaseTargetOrder, "ui"],
      analyses: {
        ...baseAnalyses({ shared: [change("feat")] }),
        ui: analysis("ui", []),
      },
      reverseDependencyGraph: buildReverseDependencyGraph(manifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "ui",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
  });

  it("does not fan out to non-configured targets even if they depend on shared", () => {
    const manifests: TargetManifest[] = [
      ...releaseableManifests,
      {
        target: "sdk",
        packageName: "@minerelay/sdk",
        dependencies: ["@minerelay/shared"],
      },
    ];

    const analyses: Record<string, TargetAnalysis> = {
      ...baseAnalyses({ shared: [change("feat")] }),
      sdk: analysis("sdk", []),
    };

    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses,
      reverseDependencyGraph: buildReverseDependencyGraph(manifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "shared",
        reason: "direct",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "api",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "shared",
        releaseNotesSourceTarget: "shared",
      },
    ]);
    expect(plan.some((entry) => entry.target === "sdk")).toBe(false);
  });

  it("uses shared release notes source for shared-only fan-out", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({ shared: [change("feat")] }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(toNotesSourceMap(plan)).toEqual({
      shared: "shared",
      api: "shared",
      admin: "shared",
      launcher: "shared",
    });
    expect(
      plan
        .filter((entry) => entry.target !== "shared")
        .every((entry) => entry.releaseNotesSourceTarget === "shared"),
    ).toBe(true);
  });

  it("uses shared notes for shared fan-out but launcher notes for launcher direct release", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        launcher: [change("fix")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(toNotesSourceMap(plan)).toEqual({
      shared: "shared",
      api: "shared",
      admin: "shared",
      launcher: "launcher",
    });
    const launcherEntry = plan.find((entry) => entry.target === "launcher");
    expect(launcherEntry?.reason).toBe("direct");
    expect(launcherEntry?.releaseNotesSourceTarget).toBe("launcher");
  });

  it("uses each target as release notes source when all targets changed directly", () => {
    const plan = buildReleasePlan({
      targetOrder: releaseTargetOrder,
      analyses: baseAnalyses({
        shared: [change("feat")],
        api: [change("fix")],
        admin: [change("perf")],
        launcher: [change("feat")],
      }),
      reverseDependencyGraph: buildReverseDependencyGraph(releaseableManifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(toNotesSourceMap(plan)).toEqual({
      shared: "shared",
      api: "api",
      admin: "admin",
      launcher: "launcher",
    });
    expect(
      plan.every((entry) => entry.target === entry.releaseNotesSourceTarget),
    ).toBe(true);
  });

  it("fans out ui-only changes to configured dependents in auto mode", () => {
    const manifests: TargetManifest[] = [
      {
        target: "ui",
        packageName: "@minerelay/ui",
        dependencies: [],
      },
      {
        target: "admin",
        packageName: "@minerelay/admin",
        dependencies: ["@minerelay/ui"],
      },
      {
        target: "launcher",
        packageName: "@minerelay/launcher",
        dependencies: ["@minerelay/ui"],
      },
    ];

    const plan = buildReleasePlan({
      targetOrder: ["admin", "launcher", "ui"],
      analyses: {
        ui: analysis("ui", [change("feat")]),
        admin: analysis("admin", []),
        launcher: analysis("launcher", []),
      },
      reverseDependencyGraph: buildReverseDependencyGraph(manifests),
      requestedTargets: ["auto"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "ui",
        reason: "direct",
        releaseNotesSourceTarget: "ui",
      },
    ]);
    expectUniqueTargets(plan);
  });

  it("overrides explicit selections when ui changed", () => {
    const manifests: TargetManifest[] = [
      {
        target: "ui",
        packageName: "@minerelay/ui",
        dependencies: [],
      },
      {
        target: "admin",
        packageName: "@minerelay/admin",
        dependencies: ["@minerelay/ui"],
      },
      {
        target: "launcher",
        packageName: "@minerelay/launcher",
        dependencies: ["@minerelay/ui"],
      },
    ];

    const plan = buildReleasePlan({
      targetOrder: ["admin", "launcher", "ui"],
      analyses: {
        ui: analysis("ui", [change("fix")]),
        admin: analysis("admin", []),
        launcher: analysis("launcher", []),
      },
      reverseDependencyGraph: buildReverseDependencyGraph(manifests),
      requestedTargets: ["launcher"],
      autoTarget: "auto",
      dependencyRootTargets,
    });

    expect(plan).toEqual([
      {
        target: "admin",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "launcher",
        reason: "dependency",
        dependencySourceTarget: "ui",
        releaseNotesSourceTarget: "ui",
      },
      {
        target: "ui",
        reason: "direct",
        releaseNotesSourceTarget: "ui",
      },
    ]);
    expectUniqueTargets(plan);
  });
});
