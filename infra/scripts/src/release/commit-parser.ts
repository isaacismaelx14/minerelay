export type ReleaseLevel = "major" | "minor" | "patch";

export type TypeRule = {
  section: string;
  release: ReleaseLevel;
};

export type ParsedReleaseConfig = {
  scopeMap: Record<string, string>;
  types: Record<string, TypeRule>;
};

export type GitCommit = {
  hash: string;
  subject: string;
  body: string;
};

export type ParsedEntry = {
  type: string;
  scope: string;
  target: string;
  description: string;
  breaking: boolean;
  section: string;
  release: ReleaseLevel;
  source: "header" | "body";
};

export type ParsedCommit = {
  hash: string;
  subject: string;
  body: string;
  entries: ParsedEntry[];
  breakingNotes: string[];
  errors: string[];
};

const HEADER_REGEX = /^(?<type>[a-z]+)\((?<scope>[A-Za-z0-9._-]+)\)(?<breaking>!)?:\s+(?<description>.+)$/u;
const BREAKING_NOTE_REGEX = /^BREAKING CHANGES?:\s*(.+)$/iu;

export function parseCommits(commits: GitCommit[], config: ParsedReleaseConfig): ParsedCommit[] {
  return commits.map((commit) => parseCommit(commit, config));
}

export function parseCommit(commit: GitCommit, config: ParsedReleaseConfig): ParsedCommit {
  const entries: ParsedEntry[] = [];
  const errors: string[] = [];
  const breakingNotes: string[] = [];
  const allowedTypes = Object.keys(config.types);
  const typePattern = allowedTypes.join("|");
  const bodyRegex = new RegExp(
    `^(?:[*-]\\s*)?(?<type>${typePattern})\\((?<scope>[A-Za-z0-9._-]+)\\)(?<breaking>!)?:\\s*(?<description>.+)$`,
    "iu",
  );
  const missingScopeRegex = new RegExp(`^(?:[*-]\\s*)?(?<type>${typePattern})(?<breaking>!)?:\\s+.+$`, "iu");

  const headerMatch = commit.subject.trim().match(HEADER_REGEX);
  if (headerMatch?.groups) {
    const headerEntry = buildEntryFromMatch(headerMatch.groups, config, commit.hash, "header");
    if (typeof headerEntry === "string") {
      errors.push(headerEntry);
    } else {
      entries.push(headerEntry);
    }
  }

  const lines = commit.body.split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const breakingMatch = line.match(BREAKING_NOTE_REGEX);
    if (breakingMatch?.[1]) {
      breakingNotes.push(breakingMatch[1].trim());
      continue;
    }

    const match = line.match(bodyRegex);
    if (match?.groups) {
      const bodyEntry = buildEntryFromMatch(match.groups, config, commit.hash, "body");
      if (typeof bodyEntry === "string") {
        errors.push(bodyEntry);
      } else {
        entries.push(bodyEntry);
      }
      continue;
    }

    if (line.match(missingScopeRegex)) {
      errors.push(`${commit.hash}: invalid conventional line without scope: \"${line}\"`);
    }
  }

  if (!headerMatch && entries.length === 0) {
    errors.push(
      `${commit.hash}: commit subject is not conventional and no valid conventional scoped entries were found in the body: \"${commit.subject.trim()}\"`,
    );
  }

  if (breakingNotes.length > 0) {
    for (const entry of entries) {
      if (entry.source === "header") {
        entry.breaking = true;
      }
    }
  }

  return {
    hash: commit.hash,
    subject: commit.subject,
    body: commit.body,
    entries,
    breakingNotes,
    errors,
  };
}

function buildEntryFromMatch(
  groups: Record<string, string | undefined>,
  config: ParsedReleaseConfig,
  commitHash: string,
  source: "header" | "body",
): ParsedEntry | string {
  const rawType = groups.type;
  const rawScope = groups.scope;
  const rawDescription = groups.description;
  if (!rawType || !rawScope || !rawDescription) {
    return `${commitHash}: malformed conventional commit entry`;
  }

  const type = rawType.toLowerCase();
  const scope = rawScope;
  const description = rawDescription.trim();
  const isBreaking = Boolean(groups.breaking);
  const typeRule = config.types[type];

  if (!typeRule) {
    return `${commitHash}: unsupported commit type \"${type}\"`;
  }

  const target = config.scopeMap[scope];
  if (!target) {
    return `${commitHash}: unknown scope \"${scope}\". Add it to release.config.json scopeMap.`;
  }

  return {
    type,
    scope,
    target,
    description,
    breaking: isBreaking,
    section: typeRule.section,
    release: typeRule.release,
    source,
  };
}

export function determineReleaseLevel(entries: ParsedEntry[], breakingNotes: string[]): ReleaseLevel {
  if (breakingNotes.length > 0 || entries.some((entry) => entry.breaking)) {
    return "major";
  }
  if (entries.some((entry) => entry.release === "minor")) {
    return "minor";
  }
  return "patch";
}

export function dedupeEntries(entries: ParsedEntry[]): ParsedEntry[] {
  const seen = new Set<string>();
  const deduped: ParsedEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.type}|${entry.scope}|${entry.description}|${entry.source}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}
