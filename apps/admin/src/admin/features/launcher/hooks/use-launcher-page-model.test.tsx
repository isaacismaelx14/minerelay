import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLauncherPageModel } from "./use-launcher-page-model";

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
}));

vi.mock("@/admin/client/http", () => ({
  requestJson: requestJsonMock,
}));

describe("useLauncherPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads claims and issues a new pairing claim from the launcher page model", async () => {
    requestJsonMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        claimId: "claim-1",
        pairingToken: "pairing-token",
        pairingCode: "ABC123",
        deepLink: "minerelay://pair",
        expiresAt: "2099-03-06T16:00:00.000Z",
      })
      .mockResolvedValueOnce([
        {
          id: "claim-1",
          expiresAt: "2099-03-06T16:00:00.000Z",
          issuedAt: "2026-03-06T15:00:00.000Z",
          issuedBy: null,
          consumedAt: null,
          revokedAt: null,
          consumedByInstallationId: null,
        },
      ]);

    const { result } = renderHook(() => useLauncherPageModel());

    await waitFor(() => {
      expect(requestJsonMock).toHaveBeenCalledWith(
        "/v1/admin/launcher/pairing/claims",
        "GET",
      );
    });

    await act(async () => {
      await result.current.createClaim();
    });

    await waitFor(() => {
      expect(result.current.latestClaim?.claimId).toBe("claim-1");
      expect(result.current.activeClaims).toHaveLength(1);
      expect(result.current.message).toBe("Pairing claim generated.");
    });
  });
});
