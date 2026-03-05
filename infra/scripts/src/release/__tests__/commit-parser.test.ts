import { describe, expect, it } from "vitest";
import { dedupeEntries, determineReleaseLevel, parseCommit } from "../commit-parser";

const config = {
  scopeMap: {
    api: "api",
    launcher: "launcher",
    platform: "launcher",
    shared: "shared",
  },
  types: {
    feat: { section: "Features", release: "minor" as const },
    fix: { section: "Bug Fixes", release: "patch" as const },
    perf: { section: "Performance", release: "patch" as const },
    refactor: { section: "Refactoring", release: "patch" as const },
    docs: { section: "Documentation", release: "patch" as const },
    style: { section: "Styles", release: "patch" as const },
    chore: { section: "Chores", release: "patch" as const },
    build: { section: "Build", release: "patch" as const },
    ci: { section: "CI", release: "patch" as const },
    test: { section: "Tests", release: "patch" as const },
  },
};

describe("commit-parser", () => {
  it("parses valid scoped headers", () => {
    const parsed = parseCommit(
      {
        hash: "abc1234",
        subject: "feat(api): add profile endpoint",
        body: "",
      },
      config,
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]).toMatchObject({
      type: "feat",
      scope: "api",
      target: "api",
      description: "add profile endpoint",
      source: "header",
    });
  });

  it("fails invalid or missing scope commit lines", () => {
    const parsed = parseCommit(
      {
        hash: "def5678",
        subject: "feat: no scope",
        body: "* fix: still missing scope",
      },
      config,
    );

    expect(parsed.errors).toEqual([
      'def5678: invalid conventional line without scope: "* fix: still missing scope"',
      'def5678: commit subject is not conventional and no valid conventional scoped entries were found in the body: "feat: no scope"',
    ]);
  });

  it("marks breaking changes from bang and BREAKING CHANGE notes", () => {
    const parsed = parseCommit(
      {
        hash: "feedbee",
        subject: "feat(api)!: replace token format",
        body: "BREAKING CHANGE: existing tokens are no longer accepted",
      },
      config,
    );

    expect(parsed.breakingNotes).toEqual(["existing tokens are no longer accepted"]);
    expect(parsed.entries[0]?.breaking).toBe(true);
    expect(determineReleaseLevel(parsed.entries, parsed.breakingNotes)).toBe("major");
  });

  it("parses body bullets from squash commits", () => {
    const parsed = parseCommit(
      {
        hash: "9988776",
        subject: "Security update (#5)",
        body: [
          "* feat(platform): add pairing support",
          "- fix(api): handle missing token",
          "feat(shared): expose lockfile schema",
          "not a conventional line",
        ].join("\n"),
      },
      config,
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.entries.map((entry) => `${entry.type}:${entry.scope}:${entry.source}`)).toEqual([
      "feat:platform:body",
      "fix:api:body",
      "feat:shared:body",
    ]);
  });

  it("dedupes repeated entries", () => {
    const parsed = parseCommit(
      {
        hash: "1122334",
        subject: "feat(shared): add schema",
        body: "* feat(shared): add schema\n- feat(shared): add schema",
      },
      config,
    );

    const deduped = dedupeEntries(parsed.entries);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((entry) => entry.source)).toEqual(["header", "body"]);
  });

  it("enforces known scopes", () => {
    const parsed = parseCommit(
      {
        hash: "7654321",
        subject: "feat(unknown): add thing",
        body: "",
      },
      config,
    );

    expect(parsed.errors).toEqual(['7654321: unknown scope "unknown". Add it to release.config.json scopeMap.']);
  });

  it("applies release-level precedence major > minor > patch", () => {
    const patch = parseCommit({ hash: "a", subject: "fix(api): x", body: "" }, config);
    const minor = parseCommit({ hash: "b", subject: "feat(api): x", body: "" }, config);
    const major = parseCommit({ hash: "c", subject: "feat(api)!: x", body: "" }, config);

    expect(determineReleaseLevel(patch.entries, patch.breakingNotes)).toBe("patch");
    expect(determineReleaseLevel(minor.entries, minor.breakingNotes)).toBe("minor");
    expect(determineReleaseLevel(major.entries, major.breakingNotes)).toBe("major");
  });
});
