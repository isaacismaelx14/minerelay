type VerifyArgs = {
  owner: string;
  repo: string;
  tag: string;
  required: Set<"windows" | "macos">;
  token?: string;
};

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  assets: ReleaseAsset[];
};

type LatestJsonPlatform = {
  signature: string;
  url: string;
};

const USAGE =
  "Usage: pnpm --filter @minerelay/infra-scripts updater:verify --owner <owner> --repo <repo> --tag <tag> [--required windows,macos]";

function parseArgs(argv: string[]): VerifyArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) {
      continue;
    }
    if (token === "--") {
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
  const requiredRaw = values.get("required")?.trim() ?? "windows,macos";
  const required = new Set<"windows" | "macos">();
  for (const value of requiredRaw
    .split(",")
    .map((item) => item.trim().toLowerCase())) {
    if (value === "windows" || value === "macos") {
      required.add(value);
    }
  }

  if (!owner || !repo || !tag) {
    throw new Error(`Missing required args. ${USAGE}`);
  }

  return {
    owner,
    repo,
    tag,
    required,
    token: process.env.GITHUB_TOKEN?.trim() || undefined,
  };
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub API request failed (${response.status}) for ${url}`,
    );
  }
  return (await response.json()) as T;
}

function hasWindowsAssets(assets: ReleaseAsset[]): boolean {
  const names = assets.map((asset) => asset.name.toLowerCase());
  const hasInstaller = names.some(
    (name) =>
      name.endsWith(".exe") ||
      name.endsWith(".msi") ||
      name.endsWith(".nsis.zip") ||
      name.endsWith(".msi.zip"),
  );
  const hasSignature = names.some(
    (name) =>
      name.endsWith(".exe.sig") ||
      name.endsWith(".msi.sig") ||
      name.endsWith(".nsis.zip.sig") ||
      name.endsWith(".msi.zip.sig"),
  );
  return hasInstaller && hasSignature;
}

function hasMacAssets(assets: ReleaseAsset[]): boolean {
  const names = assets.map((asset) => asset.name.toLowerCase());
  const hasAppArchive = names.some(
    (name) => name.endsWith(".app.tar.gz") || name.endsWith(".app.zip"),
  );
  const hasSignature = names.some(
    (name) => name.endsWith(".app.tar.gz.sig") || name.endsWith(".app.zip.sig"),
  );
  return hasAppArchive && hasSignature;
}

function decodeSignedFilename(signatureBase64: string): string | null {
  try {
    const decoded = Buffer.from(signatureBase64, "base64").toString("utf-8");
    const match = decoded.match(/\bfile:([^\n\r]+)/u);
    if (!match?.[1]) {
      return null;
    }
    return match[1].trim();
  } catch {
    return null;
  }
}

function filenameFromAssetUrl(assetUrl: string): string | null {
  try {
    const parsed = new URL(assetUrl);
    const segments = parsed.pathname.split("/");
    const raw = segments[segments.length - 1];
    if (!raw) {
      return null;
    }
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const release = await fetchJson<GithubRelease>(
    `https://api.github.com/repos/${args.owner}/${args.repo}/releases/tags/${encodeURIComponent(args.tag)}`,
    args.token,
  );

  const latestJsonAsset = release.assets.find(
    (asset) => asset.name === "latest.json",
  );
  if (!latestJsonAsset) {
    throw new Error(`Release ${release.tag_name} is missing latest.json`);
  }

  const latest = await fetchJson<{
    platforms?: Record<string, LatestJsonPlatform>;
  }>(latestJsonAsset.browser_download_url, args.token);

  const platformKeys = Object.keys(latest.platforms ?? {});
  if (platformKeys.length === 0) {
    throw new Error("latest.json has no platforms entries.");
  }

  for (const [platform, info] of Object.entries(latest.platforms ?? {})) {
    if (!info?.signature || !info?.url) {
      throw new Error(
        `latest.json platform '${platform}' is missing signature or url.`,
      );
    }

    const signedFile = decodeSignedFilename(info.signature);
    const urlFile = filenameFromAssetUrl(info.url);
    if (!signedFile || !urlFile) {
      throw new Error(
        `Could not decode signed/url filename for platform '${platform}'.`,
      );
    }
    if (signedFile !== urlFile) {
      throw new Error(
        `Signature filename mismatch on '${platform}': signature says '${signedFile}' but url points to '${urlFile}'.`,
      );
    }
  }

  if (args.required.has("windows")) {
    if (!hasWindowsAssets(release.assets)) {
      throw new Error("Release is missing Windows updater asset + signature.");
    }
    if (!platformKeys.some((key) => key.startsWith("windows-"))) {
      throw new Error("latest.json is missing Windows platforms.");
    }
  }

  if (args.required.has("macos")) {
    if (!hasMacAssets(release.assets)) {
      throw new Error(
        "Release is missing macOS updater asset (.app archive) + signature.",
      );
    }
    if (!platformKeys.some((key) => key.startsWith("darwin-"))) {
      throw new Error("latest.json is missing macOS platforms.");
    }
  }

  console.log(`Release ${release.tag_name} updater assets verified.`);
}

void main();
