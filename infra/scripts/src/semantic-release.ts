import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  dedupeEntries,
  determineReleaseLevel,
  parseCommits,
  type GitCommit,
  type ParsedReleaseConfig,
  type ReleaseLevel,
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

const AUTO_TARGET = "auto";
const USAGE =
  "Usage: pnpm --filter @mss/infra-scripts release:target -- --target <api|launcher|shared|auto> [--channel beta|alpha|release] [--bump major|minor|patch] [--next-version <semver>] [--notes-mode raw|ai] [--notes-model <model>] [--notes-max-input-chars <n>] [--notes-max-output-tokens <n>] [--notes-ai-strict] [--ai-scope-infer] [--dry-run] [--skip-github] [--skip-push] [--from-tag <tag>]";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd(), "../..");
  const config = loadConfig(resolve(repoRoot, "release.config.json"));
  const allowedTargets = Object.keys(config.targets);

  if (args.target !== AUTO_TARGET && !config.targets[args.target]) {
    throw new Error(
      `Unknown target \"${args.target}\". Allowed: ${[...allowedTargets, AUTO_TARGET].join(", ")}`,
    );
  }

  if (args.target === AUTO_TARGET && args.fromTag) {
    throw new Error(
      "--from-tag is only supported with an explicit target (api|launcher|shared).",
    );
  }

  if (args.target === AUTO_TARGET && args.nextVersion) {
    throw new Error(
      "--next-version is only supported with an explicit target (api|launcher|shared).",
    );
  }

  if (!args.dryRun) {
    ensureOnDefaultBranch(config.defaultBranch);
    ensureCleanWorkingTree();
  }

  const releaseHead = getCurrentHead();
  const repo = getGithubRepoFromGitRemote();
  const targetsToEvaluate =
    args.target === AUTO_TARGET ? allowedTargets : [args.target];

  if (args.target === AUTO_TARGET && !args.aiScopeInfer) {
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

  let releasedTargets = 0;

  for (const target of targetsToEvaluate) {
    const released = await releaseTarget({
      args,
      config,
      repoRoot,
      repo,
      target,
      releaseHead,
      showTargetHeader: args.target === AUTO_TARGET,
    });
    if (released) {
      releasedTargets += 1;
    }
  }

  if (releasedTargets === 0) {
    if (args.target === AUTO_TARGET) {
      console.log("No releaseable changes detected for any target.");
    } else {
      console.log(`No releaseable changes detected for target ${args.target}.`);
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
  repoRoot: string;
  repo: GitHubRepo;
  target: string;
  releaseHead: string;
  showTargetHeader: boolean;
}): Promise<boolean> {
  const {
    args,
    config,
    repoRoot,
    repo,
    target,
    releaseHead,
    showTargetHeader,
  } = params;

  if (showTargetHeader) {
    console.log(`\n=== Evaluating target: ${target} ===`);
  }

  const targetRelativePath = config.targets[target];
  if (!targetRelativePath) {
    throw new Error(`Missing target path for ${target} in release.config.json`);
  }
  const targetPath = resolve(repoRoot, targetRelativePath);
  const packageJsonPath = resolve(targetPath, "package.json");
  const changelogPath = resolve(targetPath, "CHANGELOG.md");

  const currentVersion = readPackageVersion(packageJsonPath);
  const previousTag =
    args.fromTag ?? getLatestTargetTag(config.releaseNamespace, target);
  if (!previousTag && !args.aiScopeInfer) {
    const bootstrapTag = `${config.releaseNamespace}/${target}/v${currentVersion}`;
    throw new Error(
      `[${target}] No release tag found (${config.releaseNamespace}/${target}/v*). Bootstrap first:\n` +
        `  git tag ${bootstrapTag}\n` +
        `  git push origin ${bootstrapTag}`,
    );
  }
  if (!previousTag && args.aiScopeInfer) {
    console.log(
      `[${target}] No baseline tag found. AI scope inference will evaluate full history.`,
    );
  }
  const commits = getCommitsSinceTag(previousTag, releaseHead);

  if (commits.length === 0) {
    console.log(
      `[${target}] No commits found since ${previousTag ?? "repo start"}.`,
    );
    return false;
  }

  let parsedCommits = parseCommits(commits, config);
  if (args.aiScopeInfer) {
    parsedCommits = await recoverScopedCommitsWithAi({
      args,
      config,
      target,
      parsedCommits,
    });
  }
  const errors = parsedCommits.flatMap((commit) => commit.errors);
  if (errors.length > 0) {
    throw new Error(
      `[${target}] Release aborted due to invalid commits:\n- ${errors.join("\n- ")}`,
    );
  }

  const { changes, breakingNotes } = collectTargetChanges(
    parsedCommits,
    target,
  );

  if (changes.length === 0 && breakingNotes.length === 0) {
    console.log(
      `[${target}] No scoped changes since ${previousTag ?? "repo start"}.`,
    );
    return false;
  }

  const detectedBump = determineReleaseLevel(
    changes.map((change) => ({
      type: change.type,
      scope: change.scope,
      target,
      description: change.description,
      breaking: change.breaking,
      section: change.section,
      release: releaseFromType(change.type, config),
      source: "header",
    })),
    breakingNotes,
  );

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
    changes,
    breakingNotes,
  });

  const changelogEntry = buildChangelogEntry({
    target,
    version: nextVersion,
    date,
    repoWebUrl: repo.webUrl,
    newTag,
    previousTag,
    changes,
    breakingNotes,
  });

  let releaseBody = rawReleaseBody;
  if (args.notesMode === "ai") {
    releaseBody = await buildAiBodyWithFallback({
      args,
      target,
      version: nextVersion,
      channel: args.channel,
      newTag,
      previousTag,
      repoWebUrl: repo.webUrl,
      changes,
      breakingNotes,
      rawReleaseBody,
    });
  }

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
    repoRoot,
    packageJsonPath,
  );
  const existingChangelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8")
    : null;
  const nextChangelog = prependChangelog(existingChangelog, changelogEntry);
  writeFileSync(changelogPath, nextChangelog, "utf8");

  gitAdd([...modifiedFiles, changelogPath]);
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
    });

    console.log(`GitHub release created: ${result.htmlUrl}`);
  }

  console.log(`Release completed: ${newTag}`);
  return true;
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

function readPackageVersion(packageJsonPath: string): string {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };
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

function releaseFromType(type: string, config: ReleaseConfig): ReleaseLevel {
  const rule = config.types[type];
  if (!rule) {
    return "patch";
  }
  return rule.release;
}

function bumpTargetVersion(
  target: string,
  nextVersion: string,
  repoRoot: string,
  packageJsonPath: string,
): string[] {
  if (target === "launcher") {
    execFileSync(
      "node",
      ["apps/launcher/scripts/set-release-version.mjs", nextVersion],
      {
        cwd: repoRoot,
        stdio: "inherit",
      },
    );
    return [
      resolve(repoRoot, "apps/launcher/package.json"),
      resolve(repoRoot, "apps/launcher/src-tauri/tauri.conf.json"),
      resolve(repoRoot, "apps/launcher/src-tauri/Cargo.toml"),
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
