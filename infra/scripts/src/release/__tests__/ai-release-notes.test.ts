import { describe, expect, it } from "vitest";
import { compactReleaseContext } from "../ai-release-notes";

describe("ai release notes compaction", () => {
  it("limits payload size and counts omitted changes", () => {
    const changes = Array.from({ length: 80 }, (_, index) => ({
      type: "feat",
      section: "Features",
      scope: "api",
      description: `Add capability number ${index + 1}`,
      commitHash: `abc${index}`.padEnd(40, "0"),
      breaking: false,
      details: ["detail a", "detail b", "detail c", "detail d"],
    }));

    const compact = compactReleaseContext({
      target: "api",
      version: "0.1.0-beta.31",
      channel: "beta",
      newTag: "@mss/api/v0.1.0-beta.31",
      previousTag: "@mss/api/v0.1.0-beta.30",
      repoWebUrl: "https://github.com/isaacismaelx14/mc-client-center",
      changes,
      breakingNotes: [],
      maxInputChars: 3500,
    });

    const serialized = JSON.stringify(compact);
    expect(serialized.length).toBeLessThanOrEqual(3500);
    expect(compact.totals.omittedItems).toBeGreaterThan(0);
    expect(compact.sections[0]?.items.length).toBeLessThanOrEqual(30);
  });
});
