"use client";

import { DataItem } from "@/admin/shared/ui/data-list";
import { TextInput } from "@/admin/shared/ui/form-controls";

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
    <section className="exaroton-wizard">
      <div className="step-header">
        <h2>Launcher Pairing</h2>
        <p>
          Generate and manage one-time claims used to enroll trusted launcher
          installations.
        </p>
      </div>

      <article className="panel">
        <div className="panel-header">
          <h3>Launcher Pairing</h3>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void refreshClaims()}
            disabled={isLoading || isCreating || isResetting}
          >
            Refresh
          </button>
        </div>
        <p className="hint">
          Generate one-time claims for secure launcher enrollment. Give users
          the deep link or the fallback pairing code.
        </p>

        <div className="grid">
          <TextInput
            name="pairingApiBaseUrl"
            label="Server API URL for pairing link"
            value={apiBaseUrl}
            placeholder="https://api.example.com"
            onChange={(event) => setApiBaseUrl(event.currentTarget.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn"
            type="button"
            onClick={() => void createClaim()}
            disabled={isCreating || isResetting}
          >
            {isCreating ? "Generating..." : "Generate Pairing Claim"}
          </button>
          <button
            className="btn danger ghost"
            type="button"
            onClick={() => void resetTrust()}
            disabled={isResetting || isCreating}
            title="Invalidates all trusted launcher devices and sessions"
          >
            {isResetting ? "Resetting..." : "Reset Launcher Trust"}
          </button>
        </div>

        {latestClaim ? (
          <div className="alert-box" style={{ marginTop: 12 }}>
            <div className="grid" style={{ gap: 8 }}>
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
              <div className="row">
                <button
                  className="btn ghost"
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
              <div className="row">
                <button
                  className="btn ghost"
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

        <div className="panel-header" style={{ marginTop: 16 }}>
          <h3>Active Claims</h3>
        </div>
        {!activeClaims.length ? (
          <p className="hint">No active pairing claims.</p>
        ) : (
          <div className="list compact">
            {activeClaims.map((claim) => (
              <div
                key={claim.id}
                className="item"
                style={{ alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="name">{claim.id}</div>
                  <div className="meta">
                    Expires {formatDateTime(claim.expiresAt)}
                  </div>
                </div>
                <button
                  className="btn danger ghost"
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

        {error ? <div className="status error">{error}</div> : null}
        {message ? <div className="status ok">{message}</div> : null}
      </article>
    </section>
  );
}
