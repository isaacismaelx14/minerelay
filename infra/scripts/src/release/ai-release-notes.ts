import type { ChangeItem } from "./changelog";

export type ReleaseNotesAudience = "customer" | "internal";

export type GenerateAiReleaseNotesParams = {
  apiKey: string;
  model?: string;
  maxInputChars?: number;
  maxOutputTokens?: number;
  audience?: ReleaseNotesAudience;
  target: string;
  version: string;
  channel: string;
  newTag: string;
  previousTag: string | null;
  repoWebUrl: string;
  changes: ChangeItem[];
  breakingNotes: string[];
};

type CompactPayload = {
  metadata: {
    target: string;
    version: string;
    channel: string;
    newTag: string;
    previousTag: string | null;
    compareUrl: string;
  };
  totals: {
    keptItems: number;
    omittedItems: number;
  };
  breakingChanges: string[];
  sections: Array<{
    section: string;
    items: Array<{
      scope: string;
      description: string;
      details: string[];
    }>;
  }>;
};

const DEFAULT_MODEL = process.env.OPENAI_RELEASE_NOTES_MODEL?.trim() || "gpt-4.1-mini";
const DEFAULT_MAX_INPUT_CHARS = 12000;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const MAX_ITEMS_PER_SECTION = 30;
const MAX_DETAILS_PER_ITEM = 3;

export async function generateAiReleaseNotes(params: GenerateAiReleaseNotesParams): Promise<string> {
  const compact = compactReleaseContext({
    target: params.target,
    version: params.version,
    channel: params.channel,
    newTag: params.newTag,
    previousTag: params.previousTag,
    repoWebUrl: params.repoWebUrl,
    changes: params.changes,
    breakingNotes: params.breakingNotes,
    maxInputChars: params.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS,
  });

  const audience = params.audience ?? "customer";
  const systemPrompt = buildSystemPrompt(audience);
  const userPrompt = buildUserPrompt(compact, audience);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? DEFAULT_MODEL,
      temperature: 0.2,
      max_output_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`AI release notes request failed (${response.status}): ${raw}`);
  }

  const parsed = JSON.parse(raw) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  const text = extractOutputText(parsed)?.trim();
  if (!text) {
    throw new Error("AI release notes response was empty.");
  }

  return text;
}

export function compactReleaseContext(params: {
  target: string;
  version: string;
  channel: string;
  newTag: string;
  previousTag: string | null;
  repoWebUrl: string;
  changes: ChangeItem[];
  breakingNotes: string[];
  maxInputChars: number;
}): CompactPayload {
  const compareUrl = params.previousTag
    ? `${params.repoWebUrl}/compare/${encodeURIComponent(params.previousTag)}...${encodeURIComponent(params.newTag)}`
    : `${params.repoWebUrl}/releases/tag/${encodeURIComponent(params.newTag)}`;

  const grouped = new Map<string, ChangeItem[]>();
  for (const change of params.changes) {
    const list = grouped.get(change.section) ?? [];
    list.push(change);
    grouped.set(change.section, list);
  }

  const sections: CompactPayload["sections"] = [];
  let kept = 0;
  let omitted = 0;

  for (const [section, items] of grouped) {
    const sliced = items.slice(0, MAX_ITEMS_PER_SECTION);
    kept += sliced.length;
    omitted += Math.max(0, items.length - sliced.length);
    sections.push({
      section,
      items: sliced.map((item) => ({
        scope: item.scope,
        description: sanitizeText(item.description, 180),
        details: item.details
          .slice(0, MAX_DETAILS_PER_ITEM)
          .map((detail) => sanitizeText(detail, 140)),
      })),
    });
  }

  const payload: CompactPayload = {
    metadata: {
      target: params.target,
      version: params.version,
      channel: params.channel,
      newTag: params.newTag,
      previousTag: params.previousTag,
      compareUrl,
    },
    totals: {
      keptItems: kept,
      omittedItems: omitted,
    },
    breakingChanges: params.breakingNotes.map((note) => sanitizeText(note, 220)).slice(0, 12),
    sections,
  };

  return enforceCharBudget(payload, params.maxInputChars);
}

function enforceCharBudget(payload: CompactPayload, maxInputChars: number): CompactPayload {
  const clone: CompactPayload = JSON.parse(JSON.stringify(payload)) as CompactPayload;
  let serialized = JSON.stringify(clone);
  if (serialized.length <= maxInputChars) {
    return clone;
  }

  for (const section of clone.sections) {
    while (section.items.length > 8 && serialized.length > maxInputChars) {
      section.items.pop();
      clone.totals.omittedItems += 1;
      clone.totals.keptItems -= 1;
      serialized = JSON.stringify(clone);
    }
  }

  while (clone.sections.length > 4 && serialized.length > maxInputChars) {
    const removed = clone.sections.pop();
    if (removed) {
      clone.totals.omittedItems += removed.items.length;
      clone.totals.keptItems -= removed.items.length;
    }
    serialized = JSON.stringify(clone);
  }

  if (serialized.length > maxInputChars) {
    for (const section of clone.sections) {
      for (const item of section.items) {
        item.details = [];
      }
    }
  }

  return clone;
}

function buildSystemPrompt(audience: ReleaseNotesAudience): string {
  if (audience === "internal") {
    return [
      "You are a release manager writing concise internal release notes.",
      "Use only provided facts. Never invent details.",
      "Keep technical detail and include risks/migrations if explicitly present.",
      "Output markdown only.",
    ].join(" ");
  }

  return [
    "You are a principal product release editor producing customer-facing release notes.",
    "Your writing must be clear, accurate, and polished.",
    "Use only the facts provided in the payload. Never fabricate capabilities, dates, security claims, or metrics.",
    "Hide internal implementation detail, private repo/process language, and non-customer-safe wording.",
    "If payload says some items were omitted, mention that notes highlight the most user-visible changes.",
    "Output concise markdown with this structure:",
    "1) one-line summary,",
    "2) '## Highlights' with bullets,",
    "3) optional '## Breaking Changes' if present,",
    "4) optional '## Notes' for upgrade guidance.",
    "Do not include raw commit hashes, PR numbers, issue IDs, or internal ticket references.",
  ].join(" ");
}

function buildUserPrompt(payload: CompactPayload, audience: ReleaseNotesAudience): string {
  return [
    `Audience: ${audience}`,
    "Generate release notes from the following JSON payload.",
    "JSON payload:",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function sanitizeText(input: string, maxLength: number): string {
  const cleaned = input
    .replace(/\b[A-Z]{2,}-\d+\b/gu, "internal-reference")
    .replace(/#\d+/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}): string | null {
  if (response.output_text && response.output_text.trim()) {
    return response.output_text;
  }
  const fromContent = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text ?? "")
    .join("\n");
  return fromContent?.trim() ? fromContent : null;
}
