import type { ChangeItem } from "./changelog";
import type { ReleaseLevel } from "./commit-parser";

export type TargetManifest = {
  target: string;
  packageName: string;
  dependencies: string[];
};

export type TargetAnalysis = {
  target: string;
  changes: ChangeItem[];
  breakingNotes: string[];
  detectedBump: ReleaseLevel | null;
};

export type PlannedRelease = {
  target: string;
  reason: "direct" | "dependency";
  dependencySourceTarget?: string;
  releaseNotesSourceTarget: string;
};

export function isReleaseRelevantChange(change: ChangeItem): boolean {
  return change.breaking || change.type.trim().length > 0;
}

export function determineDetectedBump(
  changes: ChangeItem[],
): ReleaseLevel | null {
  const releaseRelevantChanges = changes.filter(isReleaseRelevantChange);
  if (releaseRelevantChanges.length === 0) {
    return null;
  }

  if (releaseRelevantChanges.some((change) => change.breaking)) {
    return "major";
  }
  if (releaseRelevantChanges.some((change) => change.type === "feat")) {
    return "minor";
  }
  return "patch";
}

export function buildReverseDependencyGraph(
  manifests: TargetManifest[],
): Map<string, string[]> {
  const byPackageName = new Map(
    manifests.map((manifest) => [manifest.packageName, manifest.target]),
  );
  const graph = new Map<string, string[]>();

  for (const manifest of manifests) {
    for (const dependencyPackageName of manifest.dependencies) {
      const dependencyTarget = byPackageName.get(dependencyPackageName);
      if (!dependencyTarget || dependencyTarget === manifest.target) {
        continue;
      }
      const dependents = graph.get(dependencyTarget) ?? [];
      if (!dependents.includes(manifest.target)) {
        dependents.push(manifest.target);
      }
      graph.set(dependencyTarget, dependents);
    }
  }

  for (const dependents of graph.values()) {
    dependents.sort();
  }

  return graph;
}

export function collectTransitiveDependents(
  reverseGraph: Map<string, string[]>,
  sourceTarget: string,
): string[] {
  const queue = [...(reverseGraph.get(sourceTarget) ?? [])];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next)) {
      continue;
    }
    visited.add(next);
    const downstream = reverseGraph.get(next) ?? [];
    for (const dependent of downstream) {
      if (!visited.has(dependent)) {
        queue.push(dependent);
      }
    }
  }

  return [...visited].sort();
}

export function buildReleasePlan(params: {
  targetOrder: string[];
  analyses: Record<string, TargetAnalysis>;
  reverseDependencyGraph: Map<string, string[]>;
  requestedTargets: string[];
  autoTarget: string;
  dependencyRootTargets?: string[];
}): PlannedRelease[] {
  const configuredTargets = new Set(params.targetOrder);
  const isAutoTargetRequest =
    params.requestedTargets.length === 1 &&
    params.requestedTargets[0] === params.autoTarget;
  const directTargets = new Set(
    Object.values(params.analyses)
      .filter(
        (analysis) =>
          analysis.detectedBump !== null &&
          configuredTargets.has(analysis.target),
      )
      .map((analysis) => analysis.target),
  );
  const requestedTargets = new Set(
    params.requestedTargets.filter((target) => target !== params.autoTarget),
  );

  const dependencyRootTargets = new Set(params.dependencyRootTargets ?? []);
  const forcedDependencyRootTargets = isAutoTargetRequest
    ? []
    : [...dependencyRootTargets].filter((target) => directTargets.has(target));

  const planned = new Map<string, PlannedRelease>();
  const directSourceTargets = isAutoTargetRequest
    ? [...directTargets]
    : [
        ...new Set([
          ...forcedDependencyRootTargets,
          ...[...requestedTargets].filter((target) =>
            directTargets.has(target),
          ),
        ]),
      ];

  for (const target of directSourceTargets) {
    planned.set(target, {
      target,
      reason: "direct",
      releaseNotesSourceTarget: target,
    });
  }

  const dependencyFanoutSources = isAutoTargetRequest
    ? directSourceTargets
    : [
        ...new Set([
          ...forcedDependencyRootTargets,
          ...directSourceTargets.filter((target) =>
            dependencyRootTargets.has(target),
          ),
        ]),
      ];

  for (const sourceTarget of dependencyFanoutSources) {
    for (const dependentTarget of collectTransitiveDependents(
      params.reverseDependencyGraph,
      sourceTarget,
    )) {
      if (!configuredTargets.has(dependentTarget)) {
        continue;
      }
      if (planned.has(dependentTarget)) {
        continue;
      }
      planned.set(dependentTarget, {
        target: dependentTarget,
        reason: "dependency",
        dependencySourceTarget: sourceTarget,
        releaseNotesSourceTarget: sourceTarget,
      });
    }
  }

  const orderLookup = new Map(
    params.targetOrder.map((target, index) => [target, index]),
  );

  return [...planned.values()].sort((left, right) => {
    const leftIndex = orderLookup.get(left.target) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderLookup.get(right.target) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}
