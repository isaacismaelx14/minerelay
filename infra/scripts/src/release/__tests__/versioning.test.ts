import { describe, expect, it } from "vitest";
import { computeNextVersion, normalizeSemver } from "../versioning";

describe("versioning", () => {
  it("normalizes optional v prefix", () => {
    expect(normalizeSemver("v0.1.0-beta.31")).toBe("0.1.0-beta.31");
  });

  it("continues beta prerelease sequence", () => {
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "patch",
        channel: "beta",
      }),
    ).toBe("0.1.0-beta.32");
  });

  it("continues alpha prerelease sequence", () => {
    expect(
      computeNextVersion({
        currentVersion: "1.2.3-alpha.7",
        detectedBump: "minor",
        channel: "alpha",
      }),
    ).toBe("1.2.3-alpha.8");
  });

  it("starts prerelease from detected bump when switching to prerelease channel", () => {
    expect(
      computeNextVersion({
        currentVersion: "0.1.0",
        detectedBump: "minor",
        channel: "beta",
      }),
    ).toBe("0.2.0-beta.1");
  });

  it("uses explicit bump for prerelease when requested", () => {
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "patch",
        channel: "beta",
        explicitBump: "minor",
      }),
    ).toBe("0.2.0-beta.1");
  });

  it("detects release bump for stable releases", () => {
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "patch",
        channel: "release",
      }),
    ).toBe("0.1.1");
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "minor",
        channel: "release",
      }),
    ).toBe("0.2.0");
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "major",
        channel: "release",
      }),
    ).toBe("1.0.0");
  });

  it("accepts exact next version override", () => {
    expect(
      computeNextVersion({
        currentVersion: "0.1.0-beta.31",
        detectedBump: "patch",
        channel: "beta",
        nextVersion: "v0.1.0-beta.99",
      }),
    ).toBe("0.1.0-beta.99");
  });
});
