import { describe, expect, it } from "vitest";

import { formatLauncherUpdateCommandError } from "./updater";

describe("formatLauncherUpdateCommandError", () => {
  it("formats structured check errors without exposing raw backend text", () => {
    const message = formatLauncherUpdateCommandError(
      {
        code: "LUPD-MANIFEST-UNAVAILABLE",
        action: "check",
        userMessage: "backend raw text should not be shown",
      },
      "check",
    );

    expect(message).toBe(
      "Cannot perform update check. Code: LUPD-MANIFEST-UNAVAILABLE.",
    );
    expect(message).not.toContain("backend raw text");
  });

  it("parses stringified payloads returned through invoke", () => {
    const message = formatLauncherUpdateCommandError(
      JSON.stringify({
        code: "LUPD-DOWNLOAD-FAILED",
        action: "install",
        userMessage: "ignored",
      }),
      "install",
    );

    expect(message).toBe(
      "Cannot perform update installation. Code: LUPD-DOWNLOAD-FAILED.",
    );
  });

  it("falls back to generic install code for unknown errors", () => {
    const message = formatLauncherUpdateCommandError(
      new Error("Raw backend error"),
      "install",
    );

    expect(message).toBe(
      "Cannot perform update installation. Code: LUPD-INSTALL-FAILED.",
    );
    expect(message).not.toContain("Raw backend error");
  });
});
