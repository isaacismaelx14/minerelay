"use client";

import { DataItem, TextInput, ui } from "@minerelay/ui";

import {
  formatDateTime,
  useLauncherPageModel,
} from "../hooks/use-launcher-page-model";

export function LauncherPage() {
  const {
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
  } = useLauncherPageModel();

  return (
    <section className="grid gap-[32px] animate-[fadeIn_0.3s_ease-out] max-w-7xl mx-auto w-full">
      <div className="grid gap-[8px]">
        <h2 className="m-0 text-[1.5rem] text-white">Launcher Pairing</h2>
        <p>
          Generate and manage one-time claims used to enroll trusted launcher
          installations.
        </p>
      </div>

      <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 relative">
        <div className="flex items-center justify-between pb-[16px] border-b border-[var(--color-line)] mb-[8px]">
          <h3>Launcher Pairing</h3>
          <button
            className={ui.buttonGhost}
            type="button"
            onClick={() => void refreshClaims()}
            disabled={isLoading || isCreating || isResetting}
          >
            Refresh
          </button>
        </div>
        <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
          Generate one-time claims for secure launcher enrollment. Give users
          the deep link or the fallback pairing code.
        </p>

        <div className="grid gap-[16px]">
          <TextInput
            name="pairingApiBaseUrl"
            label="Server API URL for pairing link"
            value={apiBaseUrl}
            placeholder="https://api.example.com"
            onChange={(event) => setApiBaseUrl(event.currentTarget.value)}
          />
        </div>

        <div className="flex items-center gap-[16px]" style={{ marginTop: 12 }}>
          <button
            className={ui.buttonPrimary}
            type="button"
            onClick={() => void createClaim()}
            disabled={isCreating || isResetting}
          >
            {isCreating ? "Generating..." : "Generate Pairing Claim"}
          </button>
          <button
            className={ui.buttonDanger}
            type="button"
            onClick={() => void resetTrust()}
            disabled={isResetting || isCreating}
            title="Invalidates all trusted launcher devices and sessions"
          >
            {isResetting ? "Resetting..." : "Reset Launcher Trust"}
          </button>
        </div>

        {latestClaim ? (
          <div
            className="p-[16px_20px] rounded-[var(--radius-md)] text-[0.9rem] leading-[1.5] border border-[var(--color-line)] flex flex-col gap-[4px] bg-white/2"
            style={{ marginTop: 12 }}
          >
            <div className="grid gap-[16px]" style={{ gap: 8 }}>
              <DataItem label="Claim ID" value={latestClaim.claimId} />
              <DataItem
                label="Expires"
                value={formatDateTime(latestClaim.expiresAt)}
              />
              <TextInput
                name="latestPairingCode"
                label="Pairing Code"
                value={latestClaim.pairingCode}
                readOnly
                onChange={() => undefined}
              />
              <div className="flex items-center gap-[16px]">
                <button
                  className={ui.buttonGhost}
                  type="button"
                  onClick={() =>
                    void copyValue(latestClaim.pairingCode, "Pairing code")
                  }
                >
                  Copy Pairing Code
                </button>
              </div>
              <TextInput
                name="latestDeepLink"
                label="Deep Link"
                value={latestClaim.deepLink}
                readOnly
                onChange={() => undefined}
              />
              <div className="flex items-center gap-[16px]">
                <button
                  className={ui.buttonGhost}
                  type="button"
                  onClick={() =>
                    void copyValue(latestClaim.deepLink, "Deep link")
                  }
                >
                  Copy Deep Link
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="flex items-center justify-between pb-[16px] border-b border-[var(--color-line)] mb-[8px]"
          style={{ marginTop: 16 }}
        >
          <h3>Active Claims</h3>
        </div>
        {!activeClaims.length ? (
          <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
            No active pairing claims.
          </p>
        ) : (
          <div className="grid gap-[8px]">
            {activeClaims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center p-[12px_16px] bg-white/2 border border-[var(--color-line)] rounded-[var(--radius-md)] gap-[12px]"
                style={{ alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="font-semibold">{claim.id}</div>
                  <div className="text-[0.85rem] text-[var(--color-text-secondary)] mt-[4px]">
                    Expires {formatDateTime(claim.expiresAt)}
                  </div>
                </div>
                <button
                  className={ui.buttonDanger}
                  type="button"
                  onClick={() => void revokeClaim(claim.id)}
                  style={{ padding: "6px 10px" }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <div className={`${ui.statusBase} ${ui.statusError}`}>{error}</div>
        ) : null}
        {message ? (
          <div className={`${ui.statusBase} ${ui.statusOk}`}>{message}</div>
        ) : null}
      </article>
    </section>
  );
}
