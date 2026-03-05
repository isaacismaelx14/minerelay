import {
  dedupeEntries,
  type ParsedCommit,
  type ParsedEntry,
  type ParsedReleaseConfig,
} from "./commit-parser";

type ScopeInferenceResponse = {
  commits?: Array<{
    hash?: string;
    entries?: Array<{
      type?: string;
      scope?: string;
      description?: string;
      breaking?: boolean;
    }>;
    breakingNotes?: string[];
  }>;
};

export type InferScopedEntriesWithAiParams = {
  apiKey: string;
  model?: string;
  commits: ParsedCommit[];
  config: ParsedReleaseConfig;
  maxInputChars?: number;
  maxOutputTokens?: number;
};

const DEFAULT_MODEL =
  process.env.OPENAI_SCOPE_INFER_MODEL?.trim() || "gpt-4.1-mini";
const DEFAULT_MAX_INPUT_CHARS = 12000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1400;
const MAX_COMMITS_PER_REQUEST = 80;
const MAX_BODY_CHARS_PER_COMMIT = 1200;

export async function inferScopedEntriesWithAi(
  params: InferScopedEntriesWithAiParams,
): Promise<Map<string, { entries: ParsedEntry[]; breakingNotes: string[] }>> {
  const candidates = params.commits.slice(0, MAX_COMMITS_PER_REQUEST);
  const compactInput = buildCompactInput({
    commits: candidates,
    config: params.config,
    maxInputChars: params.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS,
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? DEFAULT_MODEL,
      temperature: 0,
      max_output_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserPrompt(compactInput),
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `AI scope inference request failed (${response.status}): ${raw}`,
    );
  }

  const parsed = JSON.parse(raw) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = extractOutputText(parsed)?.trim();
  if (!outputText) {
    throw new Error("AI scope inference response was empty.");
  }

  let outputJson: ScopeInferenceResponse;
  try {
    outputJson = JSON.parse(outputText) as ScopeInferenceResponse;
  } catch {
    throw new Error("AI scope inference did not return valid JSON.");
  }

  return validateAndConvertInference(outputJson, params.config);
}

function buildCompactInput(params: {
  commits: ParsedCommit[];
  config: ParsedReleaseConfig;
  maxInputChars: number;
}): {
  allowedTypes: string[];
  allowedScopes: Record<string, string>;
  commits: Array<{ hash: string; subject: string; body: string }>;
} {
  const payload = {
    allowedTypes: Object.keys(params.config.types),
    allowedScopes: params.config.scopeMap,
    commits: params.commits.map((commit) => ({
      hash: commit.hash,
      subject: sanitize(commit.subject, 220),
      body: sanitize(commit.body, MAX_BODY_CHARS_PER_COMMIT),
    })),
  };

  let serialized = JSON.stringify(payload);
  if (serialized.length <= params.maxInputChars) {
    return payload;
  }

  while (
    payload.commits.length > 5 &&
    serialized.length > params.maxInputChars
  ) {
    payload.commits.pop();
    serialized = JSON.stringify(payload);
  }

  return payload;
}

function buildSystemPrompt(): string {
  return [
    "You classify git commits into conventional entries with required scope.",
    "Use only provided data. Never invent capabilities.",
    "Return strict JSON only, no markdown.",
    'Output schema: {"commits":[{"hash":"...", "entries":[{"type":"feat|fix|perf|refactor|docs|style|chore|build|ci|test","scope":"...", "description":"...", "breaking":false}], "breakingNotes":["..."]}]}',
    "For each commit, include entries only if confidence is high.",
    "If unsure, return empty entries for that commit.",
  ].join(" ");
}

function buildUserPrompt(payload: unknown): string {
  return [
    "Infer scoped conventional entries for the following commits.",
    "Requirements:",
    "- type and scope must be from allowed lists",
    "- description should be short and factual",
    "- preserve breaking signals only if clearly present",
    "JSON payload:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function validateAndConvertInference(
  response: ScopeInferenceResponse,
  config: ParsedReleaseConfig,
): Map<string, { entries: ParsedEntry[]; breakingNotes: string[] }> {
  const map = new Map<
    string,
    { entries: ParsedEntry[]; breakingNotes: string[] }
  >();
  const commits = response.commits ?? [];

  for (const inferredCommit of commits) {
    const hash = inferredCommit.hash?.trim();
    if (!hash) {
      continue;
    }

    const entries: ParsedEntry[] = [];
    for (const item of inferredCommit.entries ?? []) {
      const type = item.type?.trim().toLowerCase();
      const scope = item.scope?.trim();
      const description = item.description?.trim();
      if (!type || !scope || !description) {
        continue;
      }

      const typeRule = config.types[type];
      const target = config.scopeMap[scope];
      if (!typeRule || !target) {
        continue;
      }

      entries.push({
        type,
        scope,
        target,
        description,
        breaking: Boolean(item.breaking),
        section: typeRule.section,
        release: typeRule.release,
        source: "body",
      });
    }

    if (entries.length === 0) {
      continue;
    }

    map.set(hash, {
      entries: dedupeEntries(entries),
      breakingNotes: (inferredCommit.breakingNotes ?? [])
        .map((note) => note.trim())
        .filter((note) => note.length > 0),
    });
  }

  return map;
}

function sanitize(input: string, maxLength: number): string {
  const value = input.replace(/\s+/gu, " ").trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
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
    .filter(
      (content) =>
        content.type === "output_text" && typeof content.text === "string",
    )
    .map((content) => content.text ?? "")
    .join("\n");

  return fromContent?.trim() ? fromContent : null;
}
