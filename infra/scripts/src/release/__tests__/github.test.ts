import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCreateGithubReleasePayload,
  createGithubRelease,
} from "../github";
import { shouldDraftGithubRelease } from "../../semantic-release";

describe("release github payloads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("returns existing release url when release already exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => '{"errors":[{"code":"already_exists"}]}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          html_url:
            "https://github.com/isaacismaelx14/minerelay/releases/tag/test",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGithubRelease({
      owner: "isaacismaelx14",
      repo: "minerelay",
      tagName: "@minerelay/api/v1.0.0",
      name: "@minerelay/api v1.0.0",
      body: "notes",
      token: "token",
    });

    expect(result.htmlUrl).toBe(
      "https://github.com/isaacismaelx14/minerelay/releases/tag/test",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient fetch failures before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          '{"html_url":"https://github.com/isaacismaelx14/minerelay/releases/tag/retried"}',
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGithubRelease({
      owner: "isaacismaelx14",
      repo: "minerelay",
      tagName: "@minerelay/api/v1.0.1",
      name: "@minerelay/api v1.0.1",
      body: "notes",
      token: "token",
    });

    expect(result.htmlUrl).toBe(
      "https://github.com/isaacismaelx14/minerelay/releases/tag/retried",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
