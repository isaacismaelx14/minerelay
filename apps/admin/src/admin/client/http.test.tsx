import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAuthPayload } from "./types";
import {
  authFetch,
  buildEventSourceUrl,
  readError,
  readAdminSession,
  writeAdminSession,
} from "./http";

const API_ORIGIN = "https://api.example.com";

function createAuthPayload(
  overrides: Partial<AdminAuthPayload> = {},
): AdminAuthPayload {
  return {
    success: true,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: "2026-03-06T12:00:00.000Z",
    refreshExpiresAt: "2026-03-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("readError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN = API_ORIGIN;
  });

  it("extracts the first API validation message", async () => {
    const response = new Response(
      JSON.stringify({ message: ["Missing password", "ignored"] }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      },
    );

    await expect(readError(response, "fallback")).resolves.toBe(
      "Missing password",
    );
  });
});

describe("authFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN = API_ORIGIN;
  });

  it("sends bearer auth to the configured API origin", async () => {
    writeAdminSession(createAuthPayload());

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    const response = await authFetch("/v1/admin/bootstrap");

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_ORIGIN}/v1/admin/bootstrap`,
    );
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization"),
    ).toBe("Bearer access-token");
  });

  it("refreshes once and retries with the new access token", async () => {
    writeAdminSession(createAuthPayload());

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createAuthPayload({
              accessToken: "fresh-access-token",
              refreshToken: "fresh-refresh-token",
            }),
          ),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const response = await authFetch("/v1/admin/bootstrap");

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${API_ORIGIN}/v1/admin/auth/refresh`,
    );
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get(
        "x-admin-refresh-token",
      ),
    ).toBe("refresh-token");
    expect(
      new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("authorization"),
    ).toBe("Bearer fresh-access-token");
    expect(readAdminSession()?.refreshToken).toBe("fresh-refresh-token");
  });
});

describe("buildEventSourceUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN = API_ORIGIN;
  });

  it("builds an absolute stream URL with the current access token", () => {
    writeAdminSession(createAuthPayload());

    expect(
      buildEventSourceUrl("/v1/admin/profile/publish/stream", {
        jobId: "job-123",
      }),
    ).toBe(
      `${API_ORIGIN}/v1/admin/profile/publish/stream?accessToken=access-token&jobId=job-123`,
    );
  });
});
