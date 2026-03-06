"use client";

import { useState } from "react";

import type { ExarotonServerPayload } from "@/admin/client/types";
import { ExarotonLogo } from "@/admin/shared/ui/exaroton-logo";
import { TextInput } from "@/admin/shared/ui/form-controls";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { exarotonStatusClass, statusClass } from "@/admin/shared/ui/status";

import { useServersPageModel } from "../hooks/use-servers-page-model";

function ServersLanding({
  onSelect,
  connectedIntegration,
}: {
  onSelect: (id: string) => void;
  connectedIntegration?: string | null;
}) {
  return (
    <div className="integrations-grid">
      <button
        className={`integration-card ${connectedIntegration === "exaroton" ? "active-integration" : ""}`}
        onClick={() => onSelect("exaroton")}
        type="button"
      >
        <div className="integration-logo-wrapper">
          <ExarotonLogo style={{ height: 32 }} />
        </div>
        <div className="integration-info">
          <h3>Exaroton</h3>
          <p>
            {connectedIntegration === "exaroton"
              ? "Account connected. Click to manage servers or change selection."
              : "Connect your Exaroton account to manage your servers directly."}
          </p>
        </div>
        {connectedIntegration === "exaroton" ? (
          <div className="connection-badge">Connected</div>
        ) : null}
      </button>

      <div className="integration-card disabled">
        <div className="integration-logo-wrapper">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 28, height: 28, opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="integration-info">
          <h3>Coming Soon</h3>
          <p>We are working to bring you more integrations in the future.</p>
        </div>
      </div>
    </div>
  );
}

export function ServersPage() {
  const {
    exaroton,
    statuses,
    setExarotonStep,
    setExarotonApiKey,
    connectExaroton,
    disconnectExaroton,
    listExarotonServers,
    selectExarotonServer,
    exarotonAction,
    updateExarotonSettings,
  } = useServersPageModel();
  const [confirmDisconnect, setConfirmDisconnect] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );

  const inSetupFlow = selectedIntegration === "exaroton" && !exaroton.connected;
  const isKeyStep = inSetupFlow && exaroton.connectionStep === "key";
  const isServersStep =
    (exaroton.connectionStep === "servers" || !exaroton.selectedServer) &&
    exaroton.connected;
  const isSuccessStep =
    exaroton.connectionStep === "success" && exaroton.connected;

  const setupStepIndex = !selectedIntegration
    ? 0
    : !exaroton.connected
      ? 1
      : !exaroton.selectedServer
        ? 2
        : 3;

  const openExarotonSetup = () => {
    setSelectedIntegration("exaroton");
    if (!exaroton.connected) {
      setExarotonStep("key");
    }
  };

  if (!exaroton.configured) {
    return (
      <section className="exaroton-wizard">
        <div className="alert-box danger">
          <strong>Integration not configured</strong>
          <p>
            Set <code>EXAROTON_ENCRYPTION_KEY</code> on the API server first to
            enable this feature.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="exaroton-wizard">
      {!exaroton.connected && !selectedIntegration ? (
        <>
          <div className="step-header">
            <h2>Select Integration</h2>
            <p>Choose a service to manage your game servers.</p>
          </div>
          <ServersLanding
            onSelect={(id) => {
              if (id === "exaroton") {
                openExarotonSetup();
                return;
              }
              setSelectedIntegration(id);
            }}
            connectedIntegration={exaroton.connected ? "exaroton" : null}
          />
        </>
      ) : null}

      {selectedIntegration === "exaroton" ? (
        <div className="wizard-step">
          <div className="wizard-steps">
            <span className={`step ${setupStepIndex >= 1 ? "active" : ""}`}>
              1. API Key
            </span>
            <span className={`step ${setupStepIndex >= 2 ? "active" : ""}`}>
              2. Select Server
            </span>
            <span className={`step ${setupStepIndex >= 3 ? "done" : ""}`}>
              3. Connected
            </span>
          </div>

          {isKeyStep ? (
            <>
              <div className="step-header">
                <h2>Connect Exaroton Account</h2>
                <p>
                  Obtain your API key from{" "}
                  <a
                    href="https://exaroton.com/account/settings/"
                    target="_blank"
                    rel="noreferrer"
                    className="link-premium"
                  >
                    exaroton.com/account/settings/
                  </a>
                </p>
              </div>

              <div className="security-banner">
                <div className="security-banner-icon">🛡️</div>
                <p>
                  <b>Your key stays protected.</b> All requests run through our
                  secure backend umbrella. After saving, we no longer expose
                  your raw key in UI; it is encrypted at rest and only decrypted
                  when an authorized action needs to call Exaroton.
                </p>
              </div>

              <div className="api-key-container">
                <label className="label">Exaroton API Key</label>
                <input
                  className="api-key-input"
                  type="password"
                  placeholder="Paste your secret API key here..."
                  value={exaroton.apiKeyInput}
                  onChange={(event) => setExarotonApiKey(event.target.value)}
                />
              </div>

              <div
                className="row"
                style={{ justifyContent: "flex-end", gap: 12, marginTop: 12 }}
              >
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setExarotonStep("idle");
                    setSelectedIntegration(null);
                  }}
                >
                  Back
                </button>
                <button
                  className="btn primary"
                  type="button"
                  style={{ padding: "12px 32px" }}
                  disabled={!exaroton.apiKeyInput || exaroton.busy}
                  onClick={() => void connectExaroton()}
                >
                  {exaroton.busy ? "Connecting..." : "Connect Account"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {isServersStep ? (
        <div className="wizard-step">
          <div className="step-header">
            <h2>Select Server</h2>
            <p>Choose the server you want to manage within the client.</p>
          </div>

          <div className="exaroton-server-grid">
            {exaroton.servers.map((server: ExarotonServerPayload) => (
              <button
                key={server.id}
                className={`server-card ${exaroton.selectedServer?.id === server.id ? "active" : ""}`}
                onClick={() => void selectExarotonServer(server.id)}
                disabled={exaroton.busy}
                type="button"
              >
                <div className="server-name-row">
                  <strong>{server.name}</strong>
                  <span className={exarotonStatusClass(server.status)}>
                    {server.statusLabel}
                  </span>
                </div>
                <p className="hint">{server.address}</p>
                <div className="meta">
                  {server.players.count} / {server.players.max} players online
                </div>
              </button>
            ))}
          </div>

          {!exaroton.servers.length ? (
            <div className="alert-box">
              <p>
                No servers found on this account. Please create one on Exaroton
                first.
              </p>
            </div>
          ) : null}

          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 12 }}
          >
            <button
              className="btn ghost"
              style={{ padding: "10px 20px" }}
              onClick={() => {
                if (!exaroton.connected) {
                  setExarotonStep("key");
                } else {
                  setSelectedIntegration(null);
                }
              }}
            >
              {exaroton.connected ? "Back" : "Back to API Key"}
            </button>
            <button
              className="btn"
              style={{ padding: "10px 24px" }}
              onClick={() => void listExarotonServers()}
            >
              Refresh List
            </button>
          </div>
        </div>
      ) : null}

      {isSuccessStep ||
      (exaroton.connected &&
        exaroton.selectedServer &&
        exaroton.connectionStep !== "servers") ? (
        <div className="exaroton-wizard">
          {isSuccessStep ? (
            <div className="success-step">
              <div className="success-icon-wrapper">
                <span>✓</span>
              </div>
              <div className="success-content">
                <h2>Successfully Connected!</h2>
                <p>
                  Your server <b>{exaroton.selectedServer?.name}</b> is now
                  fully integrated with the MineRelay.
                </p>
              </div>
              <button
                className="finish-btn"
                onClick={() => setExarotonStep("idle")}
              >
                Go to Dashboard
              </button>
            </div>
          ) : null}

          {!isSuccessStep && exaroton.connected ? (
            <div className="grid two">
              <article className="panel">
                <h3>Connected Account</h3>
                <div
                  className="exaroton-account-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="exaroton-account-info">
                    <strong>{exaroton.accountName}</strong>
                    <span>{exaroton.accountEmail}</span>
                  </div>
                  <button
                    className="btn danger ghost"
                    style={{ padding: "10px 20px" }}
                    onClick={() => setConfirmDisconnect("PENDING")}
                  >
                    Disconnect Account
                  </button>
                </div>

                {confirmDisconnect ? (
                  <ModalShell onClose={() => setConfirmDisconnect("")}>
                    <div className="step-header">
                      <h2>Confirm Disconnection</h2>
                      <p>
                        To disconnect, please type the name of the connected
                        server: <b>{exaroton.selectedServer?.name}</b>
                      </p>
                    </div>
                    <TextInput
                      name="confirm"
                      label="Type server name to confirm"
                      value={
                        confirmDisconnect === "PENDING" ? "" : confirmDisconnect
                      }
                      onChange={(event) =>
                        setConfirmDisconnect(event.currentTarget.value)
                      }
                      placeholder={exaroton.selectedServer?.name}
                    />
                    <div
                      className="row"
                      style={{
                        justifyContent: "flex-end",
                        gap: 12,
                        marginTop: 20,
                      }}
                    >
                      <button
                        className="btn ghost"
                        onClick={() => setConfirmDisconnect("")}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn danger"
                        disabled={
                          confirmDisconnect !== exaroton.selectedServer?.name
                        }
                        onClick={() => {
                          void disconnectExaroton();
                          setConfirmDisconnect("");
                        }}
                      >
                        Confirm Disconnect
                      </button>
                    </div>
                  </ModalShell>
                ) : null}
              </article>

              {exaroton.selectedServer ? (
                <article className="panel">
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <h3>Selected Server</h3>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setExarotonStep("servers");
                        void listExarotonServers();
                      }}
                    >
                      Change Server
                    </button>
                  </div>
                  <div
                    className="exaroton-selected-card"
                    style={{
                      background: "rgba(99,102,241,0.05)",
                      borderColor: "var(--brand-primary)",
                    }}
                  >
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <div>
                        <strong>{exaroton.selectedServer.name}</strong>
                        <p className="hint">
                          {exaroton.selectedServer.address}
                        </p>
                      </div>
                      <span
                        className={exarotonStatusClass(
                          exaroton.selectedServer.status,
                        )}
                      >
                        {exaroton.selectedServer.statusLabel}
                      </span>
                    </div>
                  </div>
                </article>
              ) : null}

              <article className="panel">
                <div
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <h3>Controls & Settings</h3>
                  {exaroton.busy ? (
                    <span className="hint">Saving...</span>
                  ) : null}
                </div>
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void exarotonAction("start")}
                  >
                    Start
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void exarotonAction("restart")}
                  >
                    Restart
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void exarotonAction("stop")}
                  >
                    Stop
                  </button>
                </div>
                <fieldset
                  disabled={exaroton.busy}
                  style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}
                >
                  <div className="grid" style={{ gap: 12 }}>
                    <label className="check" style={{ opacity: 0.7 }}>
                      <input type="checkbox" checked disabled />
                      <span>Server status (required, cannot be disabled)</span>
                    </label>

                    <label className="check">
                      <input
                        type="checkbox"
                        checked={exaroton.settings.modsSyncEnabled}
                        onChange={(event) =>
                          void updateExarotonSettings({
                            modsSyncEnabled: event.currentTarget.checked,
                          })
                        }
                      />
                      <span>Mods sync</span>
                    </label>

                    <div className="alert-box" style={{ marginTop: 4 }}>
                      <strong>Player access</strong>
                      <div className="grid" style={{ marginTop: 8, gap: 8 }}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanViewStatus}
                            disabled={
                              exaroton.settings.playerCanStartServer ||
                              exaroton.settings.playerCanStopServer ||
                              exaroton.settings.playerCanRestartServer
                            }
                            onChange={(event) =>
                              void updateExarotonSettings({
                                playerCanViewStatus:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Status visibility for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={
                              exaroton.settings.playerCanViewOnlinePlayers
                            }
                            disabled={!exaroton.settings.playerCanViewStatus}
                            onChange={(event) =>
                              void updateExarotonSettings({
                                playerCanViewOnlinePlayers:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Online players count for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanStartServer}
                            onChange={(event) =>
                              void updateExarotonSettings({
                                playerCanStartServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Start server for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanStopServer}
                            onChange={(event) =>
                              void updateExarotonSettings({
                                playerCanStopServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Stop server for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanRestartServer}
                            onChange={(event) =>
                              void updateExarotonSettings({
                                playerCanRestartServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Restart server for players</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </article>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="row" style={{ justifyContent: "flex-start" }}>
        <div className={statusClass(statuses.exaroton.tone)}>
          {statuses.exaroton.text}
        </div>
      </div>
      {exaroton.error ? (
        <div className="alert-box danger" style={{ marginTop: 12 }}>
          <p>{exaroton.error}</p>
        </div>
      ) : null}
    </section>
  );
}
