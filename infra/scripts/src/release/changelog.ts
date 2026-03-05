export type ChangeItem = {
  type: string;
  section: string;
  scope: string;
  description: string;
  commitHash: string;
  breaking: boolean;
  details: string[];
};

export type ReleaseDocumentInput = {
  target: string;
  version: string;
  date: string;
  repoWebUrl: string;
  newTag: string;
  previousTag: string | null;
  changes: ChangeItem[];
  breakingNotes: string[];
};

export function buildReleaseBody(input: ReleaseDocumentInput): string {
  const lines: string[] = [];

  const compareLine = input.previousTag
    ? `[Full Changelog](${input.repoWebUrl}/compare/${encodeURIComponent(input.previousTag)}...${encodeURIComponent(input.newTag)})`
    : `[Release Tag](${input.repoWebUrl}/releases/tag/${encodeURIComponent(input.newTag)})`;
  lines.push(compareLine, "");

  if (input.breakingNotes.length > 0) {
    lines.push("## BREAKING CHANGES", "");
    for (const note of input.breakingNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  const sections = groupBySection(input.changes);
  for (const [sectionName, items] of sections) {
    lines.push(`## ${sectionName}`, "");
    for (const item of items) {
      lines.push(formatChangeLine(item, input.repoWebUrl));
      for (const detail of item.details) {
        lines.push(`  - ${detail}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function buildChangelogEntry(input: ReleaseDocumentInput): string {
  const title = `## [${input.newTag}](${input.repoWebUrl}/releases/tag/${encodeURIComponent(input.newTag)}) (${input.date})`;
  return `${title}\n\n${buildReleaseBody(input)}\n`;
}

export function prependChangelog(existingContent: string | null, entry: string): string {
  if (!existingContent || existingContent.trim().length === 0) {
    return `# Changelog\n\n${entry}`.trimEnd() + "\n";
  }

  if (existingContent.startsWith("# Changelog")) {
    const firstSectionIndex = existingContent.indexOf("\n## ");
    if (firstSectionIndex === -1) {
      return `${existingContent.trimEnd()}\n\n${entry}`.trimEnd() + "\n";
    }
    const head = existingContent.slice(0, firstSectionIndex + 1);
    const tail = existingContent.slice(firstSectionIndex + 1);
    return `${head}${entry}\n${tail}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  }

  return `# Changelog\n\n${entry}\n${existingContent.trim()}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function groupBySection(changes: ChangeItem[]): Map<string, ChangeItem[]> {
  const grouped = new Map<string, ChangeItem[]>();
  for (const change of changes) {
    const key = change.breaking ? `${change.section} (breaking)` : change.section;
    const list = grouped.get(key) ?? [];
    list.push(change);
    grouped.set(key, list);
  }
  return grouped;
}

function formatChangeLine(change: ChangeItem, repoWebUrl: string): string {
  const shortHash = change.commitHash.slice(0, 7);
  return `- **${change.scope}:** ${change.description} ([${shortHash}](${repoWebUrl}/commit/${change.commitHash}))`;
}
