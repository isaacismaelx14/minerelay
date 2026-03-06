import { describe, expect, it } from "vitest";

import { bumpSemver, normalizeSemver } from "./release";

describe("normalizeSemver", () => {
  it("parses valid semantic versions", () => {
    expect(normalizeSemver("2.14.7")).toEqual({
      major: 2,
      minor: 14,
      patch: 7,
    });
  });

  it("falls back to the default version when the input is invalid", () => {
    expect(normalizeSemver("beta")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
    });
  });
});

describe("bumpSemver", () => {
  it("bumps the requested segment", () => {
    expect(bumpSemver({ major: 1, minor: 2, patch: 3 }, "patch")).toBe("1.2.4");
    expect(bumpSemver({ major: 1, minor: 2, patch: 3 }, "minor")).toBe("1.3.0");
    expect(bumpSemver({ major: 1, minor: 2, patch: 3 }, "major")).toBe("2.0.0");
  });
});
