import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  dedupeEntries,
  parseCommits,
  type GitCommit,
  type ParsedReleaseConfig,
} from "./release/commit-parser";
import { inferScopedEntriesWithAi } from "./release/ai-scope-inference";
import {
  buildChangelogEntry,
  buildReleaseBody,
  prependChangelog,
  type ChangeItem,
} from "./release/changelog";
import {
  createGithubRelease,
  getGithubRepoFromGitRemote,
} from "./release/github";
import {
  computeNextVersion,
  normalizeSemver,
  type BumpType,
  type ReleaseChannel,
} from "./release/versioning";
import { generateAiReleaseNotes } from "./release/ai-release-notes";
import {
  buildReleasePlan,
  buildReverseDependencyGraph,
  determineDetectedBump,
  type PlannedRelease,
  type TargetAnalysis,
  type TargetManifest,
} from "./release/release-plan";

type ReleaseConfig = ParsedReleaseConfig & {
  defaultBranch: string;
  releaseNamespace: string;
  targets: Record<string, string>;
};

type CliArgs = {
  target: string;
  dryRun: boolean;
  skipGithub: boolean;
  skipPush: boolean;
  aiScopeInfer: boolean;
  channel: ReleaseChannel;
  bump?: BumpType;
  nextVersion?: string;
  notesMode: "raw" | "ai";
  notesModel?: string;
  notesMaxInputChars?: number;
  notesMaxOutputTokens?: number;
  notesAiStrict: boolean;
  fromTag?: string;
};

type GitHubRepo = ReturnType<typeof getGithubRepoFromGitRemote>;

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type TargetContext = {
  target: string;
  targetPath: string;
  packageJsonPath: string;
  changelogPath: string;
  packageName: string;
  currentVersion: string;
  localDependencyPackageNames: string[];
};

type TargetEvaluation = TargetAnalysis & {
  previousTag: string | null;
  commits: GitCommit[];
  errors: string[];
};

type ParsedTargetSelection = {
  isAuto: boolean;
  requestedTargets: string[];
  explicitTargets: string[];
  displayName: string;
};

const AUTO_TARGET = "auto";
const USAGE =
  "Usage: pnpm --filter @minerelay/infra-scripts release:target -- --target <api|admin|launcher|shared|ui|auto|api,admin,...> [--channel beta|alpha|release] [--bump major|minor|patch] [--next-version <semver>] [--notes-mode raw|ai] [--notes-model <model>] [--notes-max-input-chars <n>] [--notes-max-output-tokens <n>] [--notes-ai-strict] [--ai-scope-infer] [--dry-run] [--skip-github] [--skip-push] [--from-tag <tag>]";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd(), "../..");
  const config = loadConfig(resolve(repoRoot, "release.config.json"));
  const allowedTargets = Object.keys(config.targets);
  const targetSelection = parseRequestedTargets(args.target, allowedTargets);
  const isAutoTargetRequest = targetSelection.isAuto;
  const fromTagTarget =
    targetSelection.explicitTargets.length === 1
      ? (targetSelection.explicitTargets[0] ?? null)
      : null;

  if (isAutoTargetRequest && args.fromTag) {
    throw new Error(
      "--from-tag is only supported with a single explicit target.",
    );
  }

  if (
    !isAutoTargetRequest &&
    targetSelection.explicitTargets.length !== 1 &&
    args.fromTag
  ) {
    throw new Error(
      "--from-tag is only supported with a single explicit target.",
    );
  }

  if (isAutoTargetRequest && args.nextVersion) {
    throw new Error("--next-version is only supported with explicit targets.");
  }

  if (!args.dryRun) {
    ensureOnDefaultBranch(config.defaultBranch);
    ensureCleanWorkingTree();
  }

  const releaseHead = getCurrentHead();
  const repo = getGithubRepoFromGitRemote();
  const targetsToEvaluate = allowedTargets;
  const dependencyRootTargets = ["shared", "ui"].filter((target) =>
    Boolean(config.targets[target]),
  );

  const targetContexts = loadTargetContexts({
    repoRoot,
    config,
    targets: targetsToEvaluate,
  });

  const manifests: TargetManifest[] = targetsToEvaluate.map((target) => ({
    target,
    packageName: getRequiredRecordValue(
      targetContexts,
      target,
      "target context",
    ).packageName,
    dependencies: getRequiredRecordValue(
      targetContexts,
      target,
      "target context",
    ).localDependencyPackageNames,
  }));
  const reverseDependencyGraph = buildReverseDependencyGraph(manifests);

  if (isAutoTargetRequest && !args.aiScopeInfer) {
    const missingBootstrapTags: string[] = [];
    for (const target of targetsToEvaluate) {
      const existingTag = getLatestTargetTag(config.releaseNamespace, target);
      if (existingTag) {
        continue;
      }

      const targetRelativePath = config.targets[target];
      if (!targetRelativePath) {
        continue;
      }
      const packageJsonPath = resolve(
        repoRoot,
        targetRelativePath,
        "package.json",
      );
      const currentVersion = readPackageVersion(packageJsonPath);
      const bootstrapTag = `${config.releaseNamespace}/${target}/v${currentVersion}`;
      missingBootstrapTags.push(bootstrapTag);
    }

    if (missingBootstrapTags.length > 0) {
      throw new Error(
        "Auto release requires baseline tags for all targets. Bootstrap first:\n" +
          missingBootstrapTags
            .map((tag) => `  git tag ${tag}\n  git push origin ${tag}`)
            .join("\n"),
      );
    }
  }

  const evaluations = await evaluateTargetsForRelease({
    args,
    config,
    releaseHead,
    fromTagTarget,
    targets: targetsToEvaluate,
    targetContexts,
  });

  const releasePlan = buildReleasePlan({
    targetOrder: targetsToEvaluate,
    analyses: evaluations,
    reverseDependencyGraph,
    requestedTargets: targetSelection.requestedTargets,
    autoTarget: AUTO_TARGET,
    dependencyRootTargets,
  });

  if (releasePlan.length > 1 && args.nextVersion) {
    throw new Error(
      "--next-version can only be used when exactly one target will be released.",
    );
  }

  validateReleasePlan({
    args,
    config,
    releasePlan,
    evaluations,
    targetContexts,
  });

  const orderedPlan = orderReleasePlanForExecution(releasePlan);
  const sharedReleaseBodyByTarget = new Map<string, string>();

  let releasedTargets = 0;
  for (const plannedRelease of orderedPlan) {
    const released = await releaseTarget({
      args,
      config,
      repo,
      plannedRelease,
      evaluations,
      targetContexts,
      showTargetHeader: isAutoTargetRequest || orderedPlan.length > 1,
      sharedReleaseBodyByTarget,
    });
    if (released) {
      releasedTargets += 1;
    }
  }

  if (releasedTargets === 0) {
    if (isAutoTargetRequest) {
      console.log("No releaseable changes detected for any target.");
    } else {
      console.log(
        `No releaseable changes detected for target selection ${targetSelection.displayName}.`,
      );
    }
    return;
  }

  if (args.dryRun) {
    console.log(`\nDry run complete. Planned releases: ${releasedTargets}`);
  } else {
    console.log(
      `All releases completed. Total targets released: ${releasedTargets}`,
    );
  }
}

async function releaseTarget(params: {
  args: CliArgs;
  config: ReleaseConfig;
  repo: GitHubRepo;
  plannedRelease: PlannedRelease;
  evaluations: Record<string, TargetEvaluation>;
  targetContexts: Record<string, TargetContext>;
  showTargetHeader: boolean;
  sharedReleaseBodyByTarget: Map<string, string>;
}): Promise<boolean> {
  const {
    args,
    config,
    repo,
    plannedRelease,
    evaluations,
    targetContexts,
    showTargetHeader,
    sharedReleaseBodyByTarget,
  } = params;
  const target = plannedRelease.target;

  if (showTargetHeader) {
    const reason =
      plannedRelease.reason === "direct"
        ? "direct"
        : `dependency (${plannedRelease.dependencySourceTarget})`;
    console.log(`\n=== Releasing target: ${target} [${reason}] ===`);
  }

  const evaluation = getRequiredRecordValue(
    evaluations,
    target,
    "target evaluation",
  );
  const targetContext = getRequiredRecordValue(
    targetContexts,
    target,
    "target context",
  );
  const sourceTarget =
    plannedRelease.reason === "dependency"
      ? plannedRelease.dependencySourceTarget
      : target;
  if (!sourceTarget) {
    throw new Error(`[${target}] Missing dependency source target.`);
  }
  const sourceEvaluation = getRequiredRecordValue(
    evaluations,
    sourceTarget,
    "target evaluation",
  );

  if (!sourceEvaluation.detectedBump) {
    throw new Error(
      `[${target}] Missing detected release bump from source target ${sourceTarget}.`,
    );
  }

  const currentVersion = targetContext.currentVersion;
  const previousTag = evaluation.previousTag;
  const effectiveChanges = sourceEvaluation.changes;
  const effectiveBreakingNotes = sourceEvaluation.breakingNotes;
  const detectedBump = sourceEvaluation.detectedBump;

  const nextVersion = computeNextVersion({
    currentVersion,
    detectedBump,
    channel: args.channel,
    explicitBump: args.bump,
    nextVersion: args.nextVersion,
  });
  const scopedReleaseName = `${config.releaseNamespace}/${target}`;
  const newTag = `${scopedReleaseName}/v${nextVersion}`;
  const date = new Date().toISOString().slice(0, 10);

  const rawReleaseBody = buildReleaseBody({
    target,
    version: nextVersion,
    date,
    repoWebUrl: repo.webUrl,
    newTag,
    previousTag,
    changes: effectiveChanges,
    breakingNotes: effectiveBreakingNotes,
  });

  const changelogEntry = buildChangelogEntry({
    target,
    version: nextVersion,
    date,
    repoWebUrl: repo.webUrl,
    newTag,
    previousTag,
    changes: effectiveChanges,
    breakingNotes: effectiveBreakingNotes,
  });

  let releaseBody = rawReleaseBody;
  if (plannedRelease.reason === "dependency") {
    const sourceBody = sharedReleaseBodyByTarget.get(sourceTarget);
    if (!sourceBody) {
      throw new Error(
        `[${target}] Missing release notes for dependency source ${sourceTarget}.`,
      );
    }
    releaseBody = sourceBody;
  } else if (args.notesMode === "ai") {
    releaseBody = await buildAiBodyWithFallback({
      args,
      target,
      version: nextVersion,
      channel: args.channel,
      newTag,
      previousTag,
      repoWebUrl: repo.webUrl,
      changes: effectiveChanges,
      breakingNotes: effectiveBreakingNotes,
      rawReleaseBody,
    });
  }
  sharedReleaseBodyByTarget.set(target, releaseBody);

  console.log(`Target: ${target}`);
  console.log(`Current version: ${currentVersion}`);
  console.log(`Detected bump: ${detectedBump}`);
  console.log(`Release channel: ${args.channel}`);
  if (args.bump) {
    console.log(`Bump override: ${args.bump}`);
  }
  console.log(`Notes mode: ${args.notesMode}`);
  console.log(`Next version: ${nextVersion}`);
  console.log(`Previous tag: ${previousTag ?? "(none)"}`);
  console.log(`New tag: ${newTag}`);

  if (args.dryRun) {
    console.log("\n--- CHANGELOG ENTRY ---\n");
    console.log(changelogEntry);
    console.log("\n--- RELEASE NOTES ---\n");
    console.log(releaseBody);
    return true;
  }

  const modifiedFiles = bumpTargetVersion(
    target,
    nextVersion,
    targetContext.packageJsonPath,
    targetContext.targetPath,
  );
  const existingChangelog = existsSync(targetContext.changelogPath)
    ? readFileSync(targetContext.changelogPath, "utf8")
    : null;
  const nextChangelog = prependChangelog(existingChangelog, changelogEntry);
  writeFileSync(targetContext.changelogPath, nextChangelog, "utf8");

  gitAdd([...modifiedFiles, targetContext.changelogPath]);
  gitCommit(`chore(release): ${newTag}`);
  gitTag(newTag);

  if (!args.skipPush) {
    gitPush();
    gitPushTag(newTag);
  }

  if (!args.skipGithub) {
    const token = process.env.GITHUB_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN is required to create a GitHub release (or pass --skip-github).",
      );
    }

    const result = await createGithubRelease({
      owner: repo.owner,
      repo: repo.repo,
      tagName: newTag,
      name: `${scopedReleaseName} v${nextVersion}`,
      body: releaseBody,
      token,
      prerelease: false,
      draft: shouldDraftGithubRelease(target, args.channel),
    });

    console.log(`GitHub release created: ${result.htmlUrl}`);
  }

  console.log(`Release completed: ${newTag}`);
  return true;
}

export function shouldDraftGithubRelease(
  target: string,
  channel: ReleaseChannel,
): boolean {
  return target === "launcher" && channel === "release";
}

async function buildAiBodyWithFallback(params: {
  args: CliArgs;
  target: string;
  version: string;
  channel: string;
  newTag: string;
  previousTag: string | null;
  repoWebUrl: string;
  changes: ChangeItem[];
  breakingNotes: string[];
  rawReleaseBody: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (params.args.notesAiStrict) {
      throw new Error(
        "OPENAI_API_KEY is required for --notes-mode ai when --notes-ai-strict is enabled.",
      );
    }
    console.warn(
      "OPENAI_API_KEY is missing. Falling back to raw release notes.",
    );
    return params.rawReleaseBody;
  }

  try {
    const aiBody = await generateAiReleaseNotes({
      apiKey,
      model: params.args.notesModel,
      maxInputChars: params.args.notesMaxInputChars,
      maxOutputTokens: params.args.notesMaxOutputTokens,
      audience: "customer",
      target: params.target,
      version: params.version,
      channel: params.channel,
      newTag: params.newTag,
      previousTag: params.previousTag,
      repoWebUrl: params.repoWebUrl,
      changes: params.changes,
      breakingNotes: params.breakingNotes,
    });

    const compareLine = params.previousTag
      ? `[Full Changelog](${params.repoWebUrl}/compare/${encodeURIComponent(params.previousTag)}...${encodeURIComponent(params.newTag)})`
      : `[Release Tag](${params.repoWebUrl}/releases/tag/${encodeURIComponent(params.newTag)})`;

    return `${compareLine}\n\n${aiBody}`.trim();
  } catch (error) {
    if (params.args.notesAiStrict) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `AI release notes failed, using raw notes fallback: ${message}`,
    );
    return params.rawReleaseBody;
  }
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    target: "",
    dryRun: false,
    skipGithub: false,
    skipPush: false,
    aiScopeInfer: false,
    channel: "beta",
    notesMode: "raw",
    notesAiStrict: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || token === "--") {
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--skip-github") {
      args.skipGithub = true;
      continue;
    }

    if (token === "--skip-push") {
      args.skipPush = true;
      continue;
    }

    if (token === "--notes-ai-strict") {
      args.notesAiStrict = true;
      continue;
    }

    if (token === "--ai-scope-infer") {
      args.aiScopeInfer = true;
      continue;
    }

    if (token === "--target" || token === "--from-tag") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      if (token === "--target") {
        args.target = next.trim();
      } else {
        args.fromTag = next.trim();
      }
      i += 1;
      continue;
    }

    if (token === "--channel") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      if (next !== "alpha" && next !== "beta" && next !== "release") {
        throw new Error(
          `Invalid --channel value: ${next}. Expected alpha|beta|release.`,
        );
      }
      args.channel = next;
      i += 1;
      continue;
    }

    if (token === "--bump") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      if (next !== "major" && next !== "minor" && next !== "patch") {
        throw new Error(
          `Invalid --bump value: ${next}. Expected major|minor|patch.`,
        );
      }
      args.bump = next;
      i += 1;
      continue;
    }

    if (token === "--next-version") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      args.nextVersion = normalizeSemver(next);
      i += 1;
      continue;
    }

    if (token === "--notes-mode") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      if (next !== "raw" && next !== "ai") {
        throw new Error(
          `Invalid --notes-mode value: ${next}. Expected raw|ai.`,
        );
      }
      args.notesMode = next;
      i += 1;
      continue;
    }

    if (token === "--notes-model") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      args.notesModel = next.trim();
      i += 1;
      continue;
    }

    if (token === "--notes-max-input-chars") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      const value = Number.parseInt(next, 10);
      if (!Number.isFinite(value) || value < 1000) {
        throw new Error("--notes-max-input-chars must be an integer >= 1000.");
      }
      args.notesMaxInputChars = value;
      i += 1;
      continue;
    }

    if (token === "--notes-max-output-tokens") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}. ${USAGE}`);
      }
      const value = Number.parseInt(next, 10);
      if (!Number.isFinite(value) || value < 200) {
        throw new Error("--notes-max-output-tokens must be an integer >= 200.");
      }
      args.notesMaxOutputTokens = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}. ${USAGE}`);
  }

  if (!args.target) {
    throw new Error(`Missing --target. ${USAGE}`);
  }

  return args;
}

function parseRequestedTargets(
  targetArg: string,
  allowedTargets: string[],
): ParsedTargetSelection {
  const requestedTargets = [
    ...new Set(
      targetArg
        .split(",")
        .map((target) => target.trim())
        .filter(Boolean),
    ),
  ];

  if (requestedTargets.length === 0) {
    throw new Error(`Missing --target. ${USAGE}`);
  }

  if (requestedTargets.includes(AUTO_TARGET)) {
    if (requestedTargets.length > 1) {
      throw new Error(
        `Invalid --target value: ${targetArg}. 'auto' cannot be combined with explicit targets. ${USAGE}`,
      );
    }

    return {
      isAuto: true,
      requestedTargets: [AUTO_TARGET],
      explicitTargets: [],
      displayName: AUTO_TARGET,
    };
  }

  const invalidTargets = requestedTargets.filter(
    (target) => !allowedTargets.includes(target),
  );
  if (invalidTargets.length > 0) {
    throw new Error(
      `Unknown target${invalidTargets.length > 1 ? "s" : ""} \"${invalidTargets.join(", ")}\". Allowed: ${[...allowedTargets, AUTO_TARGET].join(", ")}`,
    );
  }

  return {
    isAuto: false,
    requestedTargets,
    explicitTargets: requestedTargets,
    displayName: requestedTargets.join(","),
  };
}

async function recoverScopedCommitsWithAi(params: {
  args: CliArgs;
  config: ParsedReleaseConfig;
  target: string;
  parsedCommits: ReturnType<typeof parseCommits>;
}): Promise<ReturnType<typeof parseCommits>> {
  const recoverable = params.parsedCommits.filter((commit) =>
    commit.errors.some(isRecoverableScopeError),
  );
  if (recoverable.length === 0) {
    return params.parsedCommits;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `[${params.target}] --ai-scope-infer requires OPENAI_API_KEY.`,
    );
  }

  console.log(
    `[${params.target}] AI scope inference enabled for ${recoverable.length} commit(s) with missing scope metadata.`,
  );

  const inferred = await inferScopedEntriesWithAi({
    apiKey,
    model: params.args.notesModel,
    commits: recoverable,
    config: params.config,
  });

  let inferredCommitCount = 0;
  let skippedRecoverableCommitCount = 0;
  const next = params.parsedCommits.map((commit) => {
    const recovery = inferred.get(commit.hash);
    const recoverableErrors = commit.errors.filter(isRecoverableScopeError);
    if (!recovery || recovery.entries.length === 0) {
      if (recoverableErrors.length > 0) {
        skippedRecoverableCommitCount += 1;
      }
      return commit;
    }

    inferredCommitCount += 1;
    return {
      ...commit,
      entries: dedupeEntries([...commit.entries, ...recovery.entries]),
      breakingNotes: [
        ...new Set([...commit.breakingNotes, ...recovery.breakingNotes]),
      ],
      errors: commit.errors.filter((error) => !isRecoverableScopeError(error)),
    };
  });

  // In AI scope-inference mode, recoverable legacy formatting errors are downgraded
  // to skips if the model cannot infer scope with confidence.
  const normalized = next.map((commit) => ({
    ...commit,
    errors: commit.errors.filter((error) => !isRecoverableScopeError(error)),
  }));

  console.log(
    `[${params.target}] AI scope inference recovered ${inferredCommitCount} commit(s); skipped ${skippedRecoverableCommitCount} commit(s) with low confidence.`,
  );

  return normalized;
}

function isRecoverableScopeError(error: string): boolean {
  return (
    error.includes("invalid conventional line without scope") ||
    error.includes(
      "commit subject is not conventional and no valid conventional scoped entries were found in the body",
    )
  );
}

function loadConfig(configPath: string): ReleaseConfig {
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as ReleaseConfig;
  if (
    !raw.defaultBranch ||
    !raw.releaseNamespace ||
    !raw.targets ||
    !raw.scopeMap ||
    !raw.types
  ) {
    throw new Error(`Invalid release config at ${configPath}`);
  }
  return raw;
}

function ensureOnDefaultBranch(defaultBranch: string): void {
  const currentBranch = execSync("git branch --show-current", {
    encoding: "utf8",
  }).trim();
  if (currentBranch !== defaultBranch) {
    throw new Error(
      `Releases must run on ${defaultBranch}. Current branch is ${currentBranch}.`,
    );
  }
}

function ensureCleanWorkingTree(): void {
  const status = execSync("git status --porcelain", {
    encoding: "utf8",
  }).trim();
  if (status.length > 0) {
    throw new Error("Working tree must be clean before running release.");
  }
}

function getCurrentHead(): string {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

function loadTargetContexts(params: {
  repoRoot: string;
  config: ReleaseConfig;
  targets: string[];
}): Record<string, TargetContext> {
  const contexts: Record<string, TargetContext> = {};
  const packageNameToTarget = new Map<string, string>();

  for (const target of params.targets) {
    const relativePath = params.config.targets[target];
    if (!relativePath) {
      throw new Error(
        `Missing target path for ${target} in release.config.json`,
      );
    }
    const targetPath = resolve(params.repoRoot, relativePath);
    const packageJsonPath = resolve(targetPath, "package.json");
    const manifest = readPackageManifest(packageJsonPath);
    if (!manifest.name) {
      throw new Error(`Expected package name in ${packageJsonPath}`);
    }

    contexts[target] = {
      target,
      targetPath,
      packageJsonPath,
      changelogPath: resolve(targetPath, "CHANGELOG.md"),
      packageName: manifest.name,
      currentVersion: readPackageVersion(packageJsonPath),
      localDependencyPackageNames: [],
    };
    packageNameToTarget.set(manifest.name, target);
  }

  for (const target of params.targets) {
    const context = getRequiredRecordValue(contexts, target, "target context");
    const manifest = readPackageManifest(context.packageJsonPath);
    const dependencyNames = getManifestDependencyNames(manifest);
    context.localDependencyPackageNames = dependencyNames.filter(
      (dependencyName) => packageNameToTarget.has(dependencyName),
    );
  }

  return contexts;
}

async function evaluateTargetsForRelease(params: {
  args: CliArgs;
  config: ReleaseConfig;
  releaseHead: string;
  fromTagTarget: string | null;
  targets: string[];
  targetContexts: Record<string, TargetContext>;
}): Promise<Record<string, TargetEvaluation>> {
  const results: Record<string, TargetEvaluation> = {};

  for (const target of params.targets) {
    const context = params.targetContexts[target];
    const previousTag =
      target === params.fromTagTarget && params.args.fromTag
        ? params.args.fromTag
        : getLatestTargetTag(params.config.releaseNamespace, target);
    const commits = previousTag
      ? getCommitsSinceTag(previousTag, params.releaseHead)
      : params.args.aiScopeInfer
        ? getCommitsSinceTag(null, params.releaseHead)
        : [];

    let parsedCommits = parseCommits(commits, params.config);
    if (params.args.aiScopeInfer) {
      parsedCommits = await recoverScopedCommitsWithAi({
        args: params.args,
        config: params.config,
        target,
        parsedCommits,
      });
    }

    const { changes, breakingNotes } = collectTargetChanges(
      parsedCommits,
      target,
    );

    results[target] = {
      target,
      previousTag,
      commits,
      errors: parsedCommits.flatMap((commit) => commit.errors),
      changes,
      breakingNotes,
      detectedBump: determineDetectedBump(changes),
    };

    if (!previousTag && params.args.aiScopeInfer) {
      console.log(
        `[${target}] No baseline tag found. AI scope inference is evaluating full history.`,
      );
    }
  }

  return results;
}

function validateReleasePlan(params: {
  args: CliArgs;
  config: ReleaseConfig;
  releasePlan: PlannedRelease[];
  evaluations: Record<string, TargetEvaluation>;
  targetContexts: Record<string, TargetContext>;
}): void {
  for (const plannedRelease of params.releasePlan) {
    const target = plannedRelease.target;
    const evaluation = getRequiredRecordValue(
      params.evaluations,
      target,
      "target evaluation",
    );
    const sourceTarget =
      plannedRelease.reason === "dependency"
        ? plannedRelease.dependencySourceTarget
        : target;
    if (!sourceTarget) {
      throw new Error(`[${target}] Missing dependency source target.`);
    }
    const sourceEvaluation = getRequiredRecordValue(
      params.evaluations,
      sourceTarget,
      "target evaluation",
    );

    if (!evaluation.previousTag && !params.args.aiScopeInfer) {
      const currentVersion = getRequiredRecordValue(
        params.targetContexts,
        target,
        "target context",
      ).currentVersion;
      const bootstrapTag = `${params.config.releaseNamespace}/${target}/v${currentVersion}`;
      throw new Error(
        `[${target}] No release tag found (${params.config.releaseNamespace}/${target}/v*). Bootstrap first:\n` +
          `  git tag ${bootstrapTag}\n` +
          `  git push origin ${bootstrapTag}`,
      );
    }

    if (sourceEvaluation.errors.length > 0) {
      throw new Error(
        `[${sourceTarget}] Release aborted due to invalid commits:\n- ${sourceEvaluation.errors.join("\n- ")}`,
      );
    }
  }
}

function orderReleasePlanForExecution(
  releasePlan: PlannedRelease[],
): PlannedRelease[] {
  const direct = releasePlan.filter(
    (plannedRelease) => plannedRelease.reason === "direct",
  );
  const dependency = releasePlan.filter(
    (plannedRelease) => plannedRelease.reason === "dependency",
  );
  return [...direct, ...dependency];
}

function readPackageManifest(packageJsonPath: string): PackageManifest {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageManifest;
}

function getManifestDependencyNames(manifest: PackageManifest): string[] {
  return [
    ...new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]),
  ];
}

function getRequiredRecordValue<T>(
  record: Record<string, T>,
  key: string,
  label: string,
): T {
  const value = record[key];
  if (!value) {
    throw new Error(`Missing ${label} for ${key}.`);
  }
  return value;
}

function readPackageVersion(packageJsonPath: string): string {
  const parsed = readPackageManifest(packageJsonPath);
  if (!parsed.version) {
    throw new Error(`Expected semantic version in ${packageJsonPath}`);
  }
  return normalizeSemver(parsed.version);
}

function getLatestTargetTag(namespace: string, target: string): string | null {
  const out = execSync(
    `git tag --list \"${namespace}/${target}/v*\" --sort=-v:refname`,
    { encoding: "utf8" },
  ).trim();
  const first = out.split(/\r?\n/u).find((line) => line.trim().length > 0);
  return first ?? null;
}

function getCommitsSinceTag(tag: string | null, headRef = "HEAD"): GitCommit[] {
  const range = tag ? `${tag}..${headRef}` : headRef;
  const output = execSync(
    `git log ${range} --pretty=format:%H%x1f%s%x1f%b%x1e`,
    { encoding: "utf8" },
  );
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [hash = "", subject = "", body = ""] = entry.split("\x1f");
      return {
        hash: hash.trim(),
        subject: subject.trim(),
        body: body.trim(),
      };
    })
    .filter((commit) => commit.hash.length > 0 && commit.subject.length > 0);
}

function collectTargetChanges(
  parsedCommits: ReturnType<typeof parseCommits>,
  target: string,
): { changes: ChangeItem[]; breakingNotes: string[] } {
  const result: ChangeItem[] = [];
  const breakingNotes: string[] = [];

  for (const commit of parsedCommits) {
    const scopedEntries = dedupeEntries(
      commit.entries.filter((entry) => entry.target === target),
    );
    if (scopedEntries.length === 0) {
      continue;
    }

    const headerEntries = scopedEntries.filter(
      (entry) => entry.source === "header",
    );
    const bodyEntries = scopedEntries.filter(
      (entry) => entry.source === "body",
    );

    for (const headerEntry of headerEntries) {
      const details = bodyEntries
        .map(
          (bodyEntry) =>
            `${bodyEntry.type}(${bodyEntry.scope}): ${bodyEntry.description}`,
        )
        .filter((detail, index, list) => list.indexOf(detail) === index);

      result.push({
        type: headerEntry.type,
        section: headerEntry.section,
        scope: headerEntry.scope,
        description: headerEntry.description,
        commitHash: commit.hash,
        breaking: headerEntry.breaking,
        details,
      });
    }

    if (headerEntries.length === 0) {
      for (const bodyEntry of bodyEntries) {
        result.push({
          type: bodyEntry.type,
          section: bodyEntry.section,
          scope: bodyEntry.scope,
          description: bodyEntry.description,
          commitHash: commit.hash,
          breaking: bodyEntry.breaking,
          details: [],
        });
      }
    }

    if (commit.breakingNotes.length > 0) {
      breakingNotes.push(...commit.breakingNotes);
    }
  }

  return {
    changes: dedupeChanges(result),
    breakingNotes: [...new Set(breakingNotes)],
  };
}

function dedupeChanges(changes: ChangeItem[]): ChangeItem[] {
  const seen = new Set<string>();
  const deduped: ChangeItem[] = [];

  for (const change of changes) {
    const key = `${change.type}|${change.scope}|${change.description}|${change.commitHash}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(change);
  }

  return deduped;
}

function bumpTargetVersion(
  target: string,
  nextVersion: string,
  packageJsonPath: string,
  targetPath: string,
): string[] {
  if (target === "launcher") {
    execFileSync(
      "node",
      ["apps/launcher/scripts/set-release-version.mjs", nextVersion],
      {
        cwd: resolve(targetPath, "../.."),
        stdio: "inherit",
      },
    );
    return [
      resolve(targetPath, "package.json"),
      resolve(targetPath, "src-tauri/tauri.conf.json"),
      resolve(targetPath, "src-tauri/Cargo.toml"),
    ];
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  pkg.version = nextVersion;
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return [packageJsonPath];
}

function gitAdd(paths: string[]): void {
  execFileSync("git", ["add", ...paths], { stdio: "inherit" });
}

function gitCommit(message: string): void {
  execFileSync("git", ["commit", "--no-verify", "-m", message], {
    stdio: "inherit",
  });
}

function gitTag(tagName: string): void {
  execFileSync("git", ["tag", tagName], { stdio: "inherit" });
}

function gitPush(): void {
  execFileSync("git", ["push"], { stdio: "inherit" });
}

function gitPushTag(tagName: string): void {
  execFileSync("git", ["push", "origin", tagName], { stdio: "inherit" });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
