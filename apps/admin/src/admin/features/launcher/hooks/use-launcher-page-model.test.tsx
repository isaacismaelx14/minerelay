import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLauncherPageModel } from "./use-launcher-page-model";

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
}));

const { getAdminApiOriginMock } = vi.hoisted(() => ({
  getAdminApiOriginMock: vi.fn(() => "https://api.minerelay.com"),
}));

vi.mock("@/admin/client/http", () => ({
  requestJson: requestJsonMock,
  getAdminApiOrigin: getAdminApiOriginMock,
}));

describe("useLauncherPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminApiOriginMock.mockReturnValue("https://api.minerelay.com");
  });

  it("loads claims and issues a pairing claim using configured API origin by default", async () => {
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

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/v1/admin/launcher/pairing/claims",
      "POST",
      { apiBaseUrl: "https://api.minerelay.com" },
    );

    await waitFor(() => {
      expect(result.current.latestClaim?.claimId).toBe("claim-1");
      expect(result.current.activeClaims).toHaveLength(1);
      expect(result.current.message).toBe("Pairing claim generated.");
    });
  });

  it("uses manual apiBaseUrl override when issuing a pairing claim", async () => {
    requestJsonMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        claimId: "claim-2",
        pairingToken: "pairing-token-2",
        pairingCode: "XYZ789",
        deepLink: "minerelay://pair",
        expiresAt: "2099-03-06T16:00:00.000Z",
      })
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useLauncherPageModel());

    await waitFor(() => {
      expect(requestJsonMock).toHaveBeenCalledWith(
        "/v1/admin/launcher/pairing/claims",
        "GET",
      );
    });

    act(() => {
      result.current.setApiBaseUrl("https://api-alt.minerelay.com/");
    });

    await act(async () => {
      await result.current.createClaim();
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/v1/admin/launcher/pairing/claims",
      "POST",
      { apiBaseUrl: "https://api-alt.minerelay.com/" },
    );
  });

  it("keeps a newly created claim visible when the follow-up refresh fails", async () => {
    requestJsonMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        claimId: "claim-3",
        pairingToken: "pairing-token-3",
        pairingCode: "LMN456",
        deepLink: "minerelay://pair",
        expiresAt: "2099-03-06T16:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("network down"));

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

    expect(result.current.latestClaim?.claimId).toBe("claim-3");
    expect(result.current.activeClaims).toHaveLength(1);
    expect(result.current.activeClaims[0]?.id).toBe("claim-3");
    expect(result.current.error).toBe("network down");
  });
});
