"use client";

import { useCallback, useEffect, useState } from "react";

import { getAdminApiOrigin, requestJson } from "@/admin/client/http";
import type {
  LauncherPairingClaimIssuePayload,
  LauncherPairingClaimListItem,
  LauncherTrustResetPayload,
} from "@/admin/client/types";

function toIsoLocalInputValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return normalized;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function useLauncherPageModel() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    (() => {
      if (typeof window === "undefined") {
        return "";
      }

      try {
        return toIsoLocalInputValue(getAdminApiOrigin());
      } catch {
        return "";
      }
    })(),
  );
  const [claims, setClaims] = useState<LauncherPairingClaimListItem[]>([]);
  const [latestClaim, setLatestClaim] =
    useState<LauncherPairingClaimIssuePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshClaims = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const next = await requestJson<LauncherPairingClaimListItem[]>(
        "/v1/admin/launcher/pairing/claims",
        "GET",
      );
      setClaims(next);
    } catch (requestError) {
      setError(
        (requestError as Error).message || "Failed to load pairing claims",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshClaims();
  }, [refreshClaims]);

  const createClaim = async () => {
    setIsCreating(true);
    setError("");
    setMessage("");
    try {
      const payload = await requestJson<LauncherPairingClaimIssuePayload>(
        "/v1/admin/launcher/pairing/claims",
        "POST",
        { apiBaseUrl: apiBaseUrl.trim() || undefined },
      );

      // Keep new claims visible even if the follow-up list refresh fails.
      setClaims((prev) => {
        const nextEntry: LauncherPairingClaimListItem = {
          id: payload.claimId,
          expiresAt: payload.expiresAt,
          issuedAt: new Date().toISOString(),
          issuedBy: "admin",
          consumedAt: null,
          revokedAt: null,
          consumedByInstallationId: null,
        };
        const remaining = prev.filter((entry) => entry.id !== payload.claimId);
        return [nextEntry, ...remaining];
      });

      setLatestClaim(payload);
      setMessage("Pairing claim generated.");
      await refreshClaims();
    } catch (requestError) {
      setError(
        (requestError as Error).message || "Failed to create pairing claim",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
      setError("");
    } catch {
      setError("Clipboard permission denied in this browser.");
    }
  };

  const revokeClaim = async (claimId: string) => {
    setError("");
    setMessage("");
    try {
      await requestJson<{ revoked: boolean }>(
        `/v1/admin/launcher/pairing/claims/${encodeURIComponent(claimId)}`,
        "DELETE",
      );
      setClaims((prev) =>
        prev.map((entry) =>
          entry.id === claimId
            ? { ...entry, revokedAt: new Date().toISOString() }
            : entry,
        ),
      );
      if (latestClaim?.claimId === claimId) {
        setLatestClaim(null);
      }
      setMessage("Pairing claim revoked.");
    } catch (requestError) {
      setError(
        (requestError as Error).message || "Failed to revoke pairing claim",
      );
    }
  };

  const resetTrust = async () => {
    setIsResetting(true);
    setError("");
    setMessage("");
    try {
      const payload = await requestJson<LauncherTrustResetPayload>(
        "/v1/admin/launcher/trust/reset",
        "POST",
      );
      setLatestClaim(null);
      setMessage(`Launcher trust reset at ${formatDateTime(payload.resetAt)}.`);
      await refreshClaims();
    } catch (requestError) {
      setError(
        (requestError as Error).message || "Failed to reset launcher trust",
      );
    } finally {
      setIsResetting(false);
    }
  };

  const activeClaims = claims.filter(
    (entry) =>
      !entry.revokedAt &&
      !entry.consumedAt &&
      new Date(entry.expiresAt).getTime() > Date.now(),
  );

  return {
    apiBaseUrl,
    setApiBaseUrl,
    latestClaim,
    isLoading,
    isCreating,
    isResetting,
    error,
    message,
    activeClaims,
    refreshClaims,
    createClaim,
    copyValue,
    revokeClaim,
    resetTrust,
  };
}
