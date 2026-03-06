import { describe, expect, it } from "vitest";

import { buildCreateGithubReleasePayload } from "../github";
import { shouldDraftGithubRelease } from "../../semantic-release";

describe("release github payloads", () => {
  it("marks stable launcher releases as drafts until assets are published", () => {
    expect(shouldDraftGithubRelease("launcher", "release")).toBe(true);
    expect(shouldDraftGithubRelease("api", "release")).toBe(false);
    expect(shouldDraftGithubRelease("launcher", "beta")).toBe(false);
  });

  it("serializes draft release creation payloads", () => {
    expect(
      buildCreateGithubReleasePayload({
        owner: "isaacismaelx14",
        repo: "minerelay",
        tagName: "@minerelay/launcher/v0.2.2",
        name: "@minerelay/launcher v0.2.2",
        body: "release notes",
        token: "token",
        draft: true,
        prerelease: false,
      }),
    ).toMatchObject({
      tag_name: "@minerelay/launcher/v0.2.2",
      draft: true,
      prerelease: false,
    });
  });
});
