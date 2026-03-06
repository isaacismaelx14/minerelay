import { describe, expect, it } from "vitest";
import {
  buildChangelogEntry,
  buildReleaseBody,
  prependChangelog,
} from "../changelog";

describe("changelog formatter", () => {
  it("formats release body and changelog entry", () => {
    const input = {
      target: "api",
      version: "0.2.0",
      date: "2026-03-04",
      repoWebUrl: "https://github.com/isaacismaelx14/mc-client-center",
      newTag: "@minerelay/api/v0.2.0",
      previousTag: "@minerelay/api/v0.1.0",
      breakingNotes: ["existing authentication tokens are invalid"],
      changes: [
        {
          type: "feat",
          section: "Features",
          scope: "api",
          description: "add launcher pairing endpoint",
          commitHash: "9937db7b7298cd9c19e1f24927b8407c4f1af099",
          breaking: false,
          details: [
            "feat(api): add challenge rotation",
            "fix(api): reject stale claims",
          ],
        },
        {
          type: "fix",
          section: "Bug Fixes",
          scope: "api",
          description: "harden session lookup",
          commitHash: "2d3abdf9716707de18c381ec1607b48d2a6fef03",
          breaking: false,
          details: [],
        },
      ],
    };

    expect(buildReleaseBody(input)).toMatchInlineSnapshot(`
      "[Full Changelog](https://github.com/isaacismaelx14/mc-client-center/compare/%40minerelay%2Fapi%2Fv0.1.0...%40minerelay%2Fapi%2Fv0.2.0)

      ## BREAKING CHANGES

      - existing authentication tokens are invalid

      ## Features

      - **api:** add launcher pairing endpoint ([9937db7](https://github.com/isaacismaelx14/mc-client-center/commit/9937db7b7298cd9c19e1f24927b8407c4f1af099))
        - feat(api): add challenge rotation
        - fix(api): reject stale claims

      ## Bug Fixes

      - **api:** harden session lookup ([2d3abdf](https://github.com/isaacismaelx14/mc-client-center/commit/2d3abdf9716707de18c381ec1607b48d2a6fef03))"
    `);

    expect(buildChangelogEntry(input)).toMatchInlineSnapshot(`
      "## [@minerelay/api/v0.2.0](https://github.com/isaacismaelx14/mc-client-center/releases/tag/%40minerelay%2Fapi%2Fv0.2.0) (2026-03-04)

      [Full Changelog](https://github.com/isaacismaelx14/mc-client-center/compare/%40minerelay%2Fapi%2Fv0.1.0...%40minerelay%2Fapi%2Fv0.2.0)

      ## BREAKING CHANGES

      - existing authentication tokens are invalid

      ## Features

      - **api:** add launcher pairing endpoint ([9937db7](https://github.com/isaacismaelx14/mc-client-center/commit/9937db7b7298cd9c19e1f24927b8407c4f1af099))
        - feat(api): add challenge rotation
        - fix(api): reject stale claims

      ## Bug Fixes

      - **api:** harden session lookup ([2d3abdf](https://github.com/isaacismaelx14/mc-client-center/commit/2d3abdf9716707de18c381ec1607b48d2a6fef03))
      "
    `);
  });

  it("prepends entry into existing changelog", () => {
    const current = `# Changelog\n\n## [@minerelay/api/v0.1.0](https://example.com) (2026-03-01)\n\n- initial release\n`;
    const updated = prependChangelog(
      current,
      "## [@minerelay/api/v0.2.0](https://example.com) (2026-03-04)\n\n- new release\n",
    );

    expect(updated).toContain(
      "## [@minerelay/api/v0.2.0](https://example.com) (2026-03-04)",
    );
    expect(updated.indexOf("@minerelay/api/v0.2.0")).toBeLessThan(
      updated.indexOf("@minerelay/api/v0.1.0"),
    );
  });
});
