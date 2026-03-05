import type { ReleaseLevel } from "./commit-parser";

export type ReleaseChannel = "alpha" | "beta" | "release";
export type BumpType = "major" | "minor" | "patch";

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prereleaseLabel?: string;
  prereleaseNumber?: number;
};

const SEMVER_REGEX =
  /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<label>[0-9A-Za-z-]+)\.(?<num>\d+))?$/u;

export function normalizeSemver(input: string): string {
  const parsed = parseSemver(input);
  return formatSemver(parsed);
}

export function computeNextVersion(params: {
  currentVersion: string;
  detectedBump: ReleaseLevel;
  channel: ReleaseChannel;
  explicitBump?: BumpType;
  nextVersion?: string;
}): string {
  if (params.nextVersion) {
    return normalizeSemver(params.nextVersion);
  }

  const current = parseSemver(params.currentVersion);
  const base = stripPrerelease(current);

  if (params.channel === "release") {
    const bump = params.explicitBump ?? params.detectedBump;
    return formatSemver(applyBump(base, bump));
  }

  if (params.explicitBump) {
    const bumped = applyBump(base, params.explicitBump);
    return `${formatSemver(bumped)}-${params.channel}.1`;
  }

  if (
    current.prereleaseLabel === params.channel &&
    typeof current.prereleaseNumber === "number"
  ) {
    return `${formatSemver(base)}-${params.channel}.${current.prereleaseNumber + 1}`;
  }

  const bumped = applyBump(base, params.detectedBump);
  return `${formatSemver(bumped)}-${params.channel}.1`;
}

function parseSemver(input: string): ParsedVersion {
  const trimmed = input.trim();
  const match = trimmed.match(SEMVER_REGEX);
  if (!match?.groups) {
    throw new Error(`Invalid semantic version: ${input}`);
  }

  const major = Number.parseInt(match.groups.major ?? "", 10);
  const minor = Number.parseInt(match.groups.minor ?? "", 10);
  const patch = Number.parseInt(match.groups.patch ?? "", 10);
  if ([major, minor, patch].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid semantic version: ${input}`);
  }

  const label = match.groups.label?.trim();
  const numRaw = match.groups.num?.trim();
  const prereleaseNumber =
    typeof numRaw === "string" && numRaw.length > 0
      ? Number.parseInt(numRaw, 10)
      : undefined;
  if (
    typeof prereleaseNumber === "number" &&
    Number.isNaN(prereleaseNumber)
  ) {
    throw new Error(`Invalid semantic version prerelease number: ${input}`);
  }

  return {
    major,
    minor,
    patch,
    prereleaseLabel: label,
    prereleaseNumber,
  };
}

function stripPrerelease(version: ParsedVersion): ParsedVersion {
  return {
    major: version.major,
    minor: version.minor,
    patch: version.patch,
  };
}

function applyBump(version: ParsedVersion, bump: BumpType): ParsedVersion {
  if (bump === "major") {
    return { major: version.major + 1, minor: 0, patch: 0 };
  }
  if (bump === "minor") {
    return { major: version.major, minor: version.minor + 1, patch: 0 };
  }
  return { major: version.major, minor: version.minor, patch: version.patch + 1 };
}

function formatSemver(version: ParsedVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  if (
    version.prereleaseLabel &&
    typeof version.prereleaseNumber === "number"
  ) {
    return `${base}-${version.prereleaseLabel}.${version.prereleaseNumber}`;
  }
  return base;
}
