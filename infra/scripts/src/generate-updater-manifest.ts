import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type PlatformEntry = {
  signature: string;
  url: string;
};

type ManifestContent = {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, PlatformEntry>;
};

export type ParsedArgs = {
  owner: string;
  repo: string;
  tag: string;
  artifactsDir: string;
  output: string;
  notes: string;
  required: Set<"windows" | "macos">;
};

type MatchResult = {
  assetPath: string;
  sigPath: string;
};

const USAGE =
  "Usage: pnpm --filter @mvl/infra-scripts manifest:generate --owner <owner> --repo <repo> --tag <tag> --artifacts-dir <dir> --output <file> [--notes <notes>] [--required windows,macos]";

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) {
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}. ${USAGE}`);
    }
    values.set(key, next);
    i += 1;
  }

  const owner = values.get("owner")?.trim();
  const repo = values.get("repo")?.trim();
  const tag = values.get("tag")?.trim();
  const artifactsDir = values.get("artifacts-dir")?.trim();
  const output = values.get("output")?.trim();
  const notes = values.get("notes")?.trim() ?? "";
  const requiredRaw = values.get("required")?.trim() ?? "windows,macos";
  const required = new Set<"windows" | "macos">();
  for (const value of requiredRaw.split(",").map((item) => item.trim().toLowerCase())) {
    if (value === "windows" || value === "macos") {
      required.add(value);
    }
  }

  if (!owner || !repo || !tag || !artifactsDir || !output) {
    throw new Error(`Missing required args. ${USAGE}`);
  }

  return {
    owner,
    repo,
    tag,
    artifactsDir: resolve(process.cwd(), artifactsDir),
    output: resolve(process.cwd(), output),
    notes,
    required,
  };
}

function walkFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
      continue;
    }
    if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/\.sig$/u, "")
    .replace(/\.(exe|msi|zip|gz|tar|app)$/gu, " ")
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1);
}

function similarityScore(assetFile: string, sigFile: string): number {
  const assetTokens = new Set(tokenize(assetFile));
  const sigTokens = new Set(tokenize(sigFile));
  let score = 0;
  for (const token of assetTokens) {
    if (sigTokens.has(token)) {
      score += 2;
    }
  }

  if (assetFile.includes("setup") && sigFile.includes("setup")) {
    score += 5;
  }
  if (assetFile.endsWith(".exe") && sigFile.endsWith(".exe.sig")) {
    score += 5;
  }
  if (assetFile.endsWith(".msi") && sigFile.endsWith(".msi.sig")) {
    score += 5;
  }
  if (assetFile.endsWith(".app.tar.gz") && sigFile.endsWith(".app.tar.gz.sig")) {
    score += 8;
  }

  return score;
}

function chooseSignature(assetPath: string, signatureCandidates: string[]): string | null {
  const assetFile = basename(assetPath);

  const exact = signatureCandidates.find((candidate) => basename(candidate) === `${assetFile}.sig`);
  if (exact) {
    return exact;
  }

  let best: { path: string; score: number } | null = null;
  for (const candidate of signatureCandidates) {
    const score = similarityScore(assetFile, basename(candidate));
    if (score <= 0) {
      continue;
    }
    if (!best || score > best.score) {
      best = { path: candidate, score };
    }
  }

  return best?.path ?? null;
}

function releaseAssetUrl(owner: string, repo: string, tag: string, assetName: string): string {
  return `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}

function readSignature(path: string): string {
  return readFileSync(path, "utf-8").trim();
}

function inferMacArch(assetName: string): "universal" | "aarch64" | "x86_64" {
  const lower = assetName.toLowerCase();
  if (lower.includes("universal")) {
    return "universal";
  }
  if (lower.includes("aarch64") || lower.includes("arm64")) {
    return "aarch64";
  }
  if (lower.includes("x86_64") || lower.includes("x64") || lower.includes("amd64")) {
    return "x86_64";
  }
  throw new Error(`Cannot infer macOS arch from updater asset: ${assetName}`);
}

function pickWindowsUpdater(files: string[]): MatchResult {
  const windowsAssets = files.filter((path) => {
    const lower = basename(path).toLowerCase();
    return lower.endsWith(".exe") || lower.endsWith(".msi");
  });
  const signatures = files.filter((path) => basename(path).toLowerCase().endsWith(".sig"));

  const nsisAsset =
    windowsAssets.find((path) => basename(path).toLowerCase().includes("setup.exe")) ??
    windowsAssets.find((path) => basename(path).toLowerCase().endsWith(".exe"));
  const fallbackMsi = windowsAssets.find((path) => basename(path).toLowerCase().endsWith(".msi"));
  const selectedAsset = nsisAsset ?? fallbackMsi;

  if (!selectedAsset) {
    throw new Error("No Windows updater asset found (.exe or .msi).");
  }

  const matchedSig = chooseSignature(selectedAsset, signatures);
  if (!matchedSig) {
    throw new Error(`No signature found for Windows updater asset: ${basename(selectedAsset)}`);
  }

  return { assetPath: selectedAsset, sigPath: matchedSig };
}

function pickMacUpdater(files: string[]): MatchResult {
  const macAssets = files.filter((path) => basename(path).toLowerCase().endsWith(".app.tar.gz"));
  const signatures = files.filter((path) => basename(path).toLowerCase().endsWith(".sig"));

  if (macAssets.length === 0) {
    throw new Error("No macOS updater asset found (.app.tar.gz).");
  }

  const selectedAsset =
    macAssets.find((path) => basename(path).toLowerCase().includes("universal")) ?? macAssets[0];
  if (!selectedAsset) {
    throw new Error("No macOS updater asset selected.");
  }

  const matchedSig = chooseSignature(selectedAsset, signatures);
  if (!matchedSig) {
    throw new Error(`No signature found for macOS updater asset: ${basename(selectedAsset)}`);
  }

  return { assetPath: selectedAsset, sigPath: matchedSig };
}

export function generateManifest(input: ParsedArgs): ManifestContent {
  if (!statSync(input.artifactsDir).isDirectory()) {
    throw new Error(`Artifacts directory is not valid: ${input.artifactsDir}`);
  }

  const files = walkFiles(input.artifactsDir);
  const manifest: ManifestContent = {
    version: input.tag.startsWith("v") ? input.tag.slice(1) : input.tag,
    notes: input.notes,
    pub_date: new Date().toISOString(),
    platforms: {},
  };

  if (input.required.has("windows")) {
    const windows = pickWindowsUpdater(files);
    const winAssetName = basename(windows.assetPath);
    const winSignature = readSignature(windows.sigPath);
    const isNsis = winAssetName.toLowerCase().endsWith(".exe");
    const installer = isNsis ? "nsis" : "msi";
    const url = releaseAssetUrl(input.owner, input.repo, input.tag, winAssetName);

    manifest.platforms["windows-x86_64"] = { signature: winSignature, url };
    manifest.platforms[`windows-x86_64-${installer}`] = { signature: winSignature, url };
  }

  if (input.required.has("macos")) {
    const mac = pickMacUpdater(files);
    const macAssetName = basename(mac.assetPath);
    const macSignature = readSignature(mac.sigPath);
    const url = releaseAssetUrl(input.owner, input.repo, input.tag, macAssetName);
    const arch = inferMacArch(macAssetName);

    if (arch === "universal") {
      manifest.platforms["darwin-aarch64"] = { signature: macSignature, url };
      manifest.platforms["darwin-aarch64-app"] = { signature: macSignature, url };
      manifest.platforms["darwin-x86_64"] = { signature: macSignature, url };
      manifest.platforms["darwin-x86_64-app"] = { signature: macSignature, url };
    } else {
      manifest.platforms[`darwin-${arch}`] = { signature: macSignature, url };
      manifest.platforms[`darwin-${arch}-app`] = { signature: macSignature, url };
    }
  }

  if (input.required.has("windows") && !Object.keys(manifest.platforms).some((key) => key.startsWith("windows-"))) {
    throw new Error("Manifest generation failed: required Windows updater entries are missing.");
  }
  if (input.required.has("macos") && !Object.keys(manifest.platforms).some((key) => key.startsWith("darwin-"))) {
    throw new Error("Manifest generation failed: required macOS updater entries are missing.");
  }

  return manifest;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const manifest = generateManifest(args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  // Intentional concise output for CI logs.
  console.log(`Generated updater manifest: ${args.output}`);
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  main();
}
