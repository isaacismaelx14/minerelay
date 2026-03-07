"use client";

import { useState } from "react";

import type { ExarotonServerPayload } from "@/admin/client/types";
import { ExarotonLogo } from "@/admin/shared/ui/exaroton-logo";
import { TextInput } from "@/admin/shared/ui/form-controls";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { exarotonStatusClass, statusClass } from "@/admin/shared/ui/status";
import { ui } from "@/admin/shared/ui/styles";

import { useServersPageModel } from "../hooks/use-servers-page-model";

function ServersLanding({
  onSelect,
  connectedIntegration,
}: {
  onSelect: (id: string) => void;
  connectedIntegration?: string | null;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[20px]">
      <button
        className={`flex flex-col gap-[16px] p-[24px] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-lg)] text-left cursor-pointer transition-all duration-200 relative overflow-hidden hover:not-disabled:bg-white/5 hover:not-disabled:border-[var(--color-line-strong)] hover:not-disabled:-translate-y-[2px] ${connectedIntegration === "exaroton" ? "border-[var(--color-brand-primary)] bg-[rgba(99,102,241,0.05)] shadow-[0_4px_24px_rgba(99,102,241,0.15)]" : ""}`}
        onClick={() => onSelect("exaroton")}
        type="button"
      >
        <div className="w-[52px] h-[52px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black/30 grid place-items-center">
          <ExarotonLogo style={{ height: 32 }} />
        </div>
        <div className="grid gap-[4px]">
          <h3 className="m-0 mb-[6px] text-[1.15rem] text-white">Exaroton</h3>
          <p className="m-0 text-[0.88rem] text-[var(--color-text-muted)] leading-[1.5]">
            {connectedIntegration === "exaroton"
              ? "Account connected. Click to manage servers or change selection."
              : "Connect your Exaroton account to manage your servers directly."}
          </p>
        </div>
        {connectedIntegration === "exaroton" ? (
          <div className="absolute top-[16px] right-[16px] text-[0.72rem] uppercase tracking-[0.05em] font-bold bg-[#10b981]/10 text-[var(--color-success)] py-[4px] px-[10px] rounded-full border border-[#10b981]/20">
            Connected
          </div>
        ) : null}
      </button>

      <div className="flex flex-col gap-[16px] p-[24px] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-lg)] text-left cursor-not-allowed transition-all duration-200 relative overflow-hidden opacity-50 grayscale">
        <div className="w-[52px] h-[52px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black/30 grid place-items-center">
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
        <div className="grid gap-[4px]">
          <h3 className="m-0 mb-[6px] text-[1.15rem] text-white">
            Coming Soon
          </h3>
          <p className="m-0 text-[0.88rem] text-[var(--color-text-muted)] leading-[1.5]">
            We are working to bring you more integrations in the future.
          </p>
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
      <section className="max-w-[800px] mx-auto w-full grid gap-[32px]">
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-[var(--radius-md)] p-[16px] text-[0.95rem] flex flex-col gap-[8px]">
          <strong>Integration not configured</strong>
          <p className="m-0 text-[var(--color-text-secondary)] leading-[1.6]">
            Set <code>EXAROTON_ENCRYPTION_KEY</code> on the API server first to
            enable this feature.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[800px] mx-auto w-full grid gap-[32px]">
      {!exaroton.connected && !selectedIntegration ? (
        <>
          <div className="text-center mb-[24px]">
            <h2 className="m-0 mb-[8px] text-[1.8rem] tracking-[-0.02em]">
              Select Integration
            </h2>
            <p className="m-0 text-[1rem] text-[var(--color-text-secondary)]">
              Choose a service to manage your game servers.
            </p>
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[32px] md:p-[40px] relative overflow-hidden">
          <div className="flex justify-between items-center mb-[32px] relative before:absolute before:top-1/2 before:left-0 before:right-0 before:h-[1px] before:bg-[var(--color-line)] before:-z-10">
            <span
              className={`flex-1 text-center font-semibold text-[0.85rem] py-[12px] uppercase tracking-[0.05em] transition-colors relative z-10 bg-[var(--color-bg-card)] ${setupStepIndex >= 1 ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-muted)]"}`}
            >
              1. API Key
            </span>
            <span
              className={`flex-1 text-center font-semibold text-[0.85rem] py-[12px] uppercase tracking-[0.05em] transition-colors relative z-10 bg-[var(--color-bg-card)] ${setupStepIndex >= 2 ? (setupStepIndex >= 3 ? "text-white" : "text-[var(--color-brand-primary)]") : "text-[var(--color-text-muted)]"}`}
            >
              2. Select Server
            </span>
            <span
              className={`flex-1 text-center font-semibold text-[0.85rem] py-[12px] uppercase tracking-[0.05em] transition-colors relative z-10 bg-[var(--color-bg-card)] ${setupStepIndex >= 3 ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-muted)]"}`}
            >
              3. Connected
            </span>
          </div>

          {isKeyStep ? (
            <>
              <div className="text-center mb-[24px]">
                <h2 className="m-0 mb-[8px] text-[1.8rem] tracking-[-0.02em]">
                  Connect Exaroton Account
                </h2>
                <p className="m-0 text-[1rem] text-[var(--color-text-secondary)]">
                  Obtain your API key from{" "}
                  <a
                    href="https://exaroton.com/account/settings/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-brand-accent)] underline decoration-[var(--color-brand-accent)]/40 underline-offset-[3px] hover:text-white"
                  >
                    exaroton.com/account/settings/
                  </a>
                </p>
              </div>

              <div className="flex items-start gap-[12px] bg-[#10b981]/10 border border-[#10b981]/20 rounded-[var(--radius-md)] p-[16px] text-[0.85rem] text-[var(--color-text-secondary)] leading-[1.6] mb-[24px]">
                <div className="text-[1.2rem] mt-[2px]">🛡️</div>
                <p>
                  <b>Your key stays protected.</b> All requests run through our
                  secure backend umbrella. After saving, we no longer expose
                  your raw key in UI; it is encrypted at rest and only decrypted
                  when an authorized action needs to call Exaroton.
                </p>
              </div>

              <div className="grid gap-[8px] mb-[24px]">
                <label className="grid gap-[8px] text-[0.85rem] font-medium text-[var(--color-text-secondary)]">
                  Exaroton API Key
                </label>
                <input
                  className="font-mono text-[1.1rem] border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                  type="password"
                  placeholder="Paste your secret API key here..."
                  value={exaroton.apiKeyInput}
                  onChange={(event) => setExarotonApiKey(event.target.value)}
                />
              </div>

              <div
                className={ui.row}
                style={{ justifyContent: "flex-end", gap: 12, marginTop: 12 }}
              >
                <button
                  className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                  type="button"
                  onClick={() => {
                    setExarotonStep("idle");
                    setSelectedIntegration(null);
                  }}
                >
                  Back
                </button>
                <button
                  className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[32px] md:p-[40px] relative overflow-hidden">
          <div className="text-center mb-[24px]">
            <h2 className="m-0 mb-[8px] text-[1.8rem] tracking-[-0.02em]">
              Select Server
            </h2>
            <p className="m-0 text-[1rem] text-[var(--color-text-secondary)]">
              Choose the server you want to manage within the client.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[16px] mb-[24px]">
            {exaroton.servers.map((server: ExarotonServerPayload) => (
              <button
                key={server.id}
                className={`flex flex-col gap-[8px] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[20px] text-left cursor-pointer transition-all duration-200 hover:not-disabled:bg-white/5 hover:not-disabled:border-white/10 hover:not-disabled:-translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed ${exaroton.selectedServer?.id === server.id ? "border-[var(--color-brand-primary)] bg-[rgba(99,102,241,0.05)] shadow-[0_4px_24px_rgba(99,102,241,0.15)]" : ""}`}
                onClick={() => void selectExarotonServer(server.id)}
                disabled={exaroton.busy}
                type="button"
              >
                <div className="flex justify-between items-start gap-[12px] w-full">
                  <strong className="font-semibold text-white text-[1.05rem]">
                    {server.name}
                  </strong>
                  <span className={exarotonStatusClass(server.status)}>
                    {server.statusLabel}
                  </span>
                </div>
                <p className="m-0 font-mono text-[0.75rem] text-[var(--color-text-muted)]">
                  {server.address}
                </p>
                <div className="mt-auto pt-[8px] text-[0.8rem] text-[var(--color-text-muted)] flex items-center gap-[6px] before:content-[''] before:w-[6px] before:h-[6px] before:bg-[var(--color-brand-accent)] before:rounded-full before:shadow-[0_0_8px_var(--color-brand-accent-glow)]">
                  {server.players.count} / {server.players.max} players online
                </div>
              </button>
            ))}
          </div>

          {!exaroton.servers.length ? (
            <div className={`${ui.statusBase} ${ui.statusIdle}`}>
              <p>
                No servers found on this account. Please create one on Exaroton
                first.
              </p>
            </div>
          ) : null}

          <div
            className={ui.row}
            style={{ justifyContent: "space-between", marginTop: 12 }}
          >
            <button
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
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
              className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
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
        <div className="max-w-[800px] mx-auto w-full grid gap-[32px]">
          {isSuccessStep ? (
            <div className="text-center py-[40px] px-[20px] flex flex-col items-center gap-[24px]">
              <div className="w-[80px] h-[80px] rounded-full bg-[#10b981]/10 border-[2px] border-[#10b981]/20 flex items-center justify-center text-[2.5rem] text-[var(--color-success)] mb-[8px] animate-bounce">
                <span>✓</span>
              </div>
              <div className="grid gap-[8px] text-center">
                <h2 className="m-0 mb-[12px] text-[2rem] tracking-[-0.02em]">
                  Successfully Connected!
                </h2>
                <p className="m-0 text-[1.05rem] text-[var(--color-text-secondary)] leading-[1.6]">
                  Your server <b>{exaroton.selectedServer?.name}</b> is now
                  fully integrated with the MineRelay.
                </p>
              </div>
              <button
                className="mt-[12px] border-none bg-white text-black font-bold py-[14px] px-[32px] rounded-full text-[1.05rem] cursor-pointer transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(255,255,255,0.2)]"
                onClick={() => setExarotonStep("idle")}
              >
                Go to Dashboard
              </button>
            </div>
          ) : null}

          {!isSuccessStep && exaroton.connected ? (
            <div className="grid grid-cols-2 gap-[16px]">
              <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
                <h3 className="m-0 mb-[8px] text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
                  Connected Account
                </h3>
                <div
                  className="exaroton-account-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="flex flex-col gap-[4px]">
                    <strong className="text-[1.1rem] text-white font-semibold">
                      {exaroton.accountName}
                    </strong>
                    <span className="text-[0.85rem] text-[var(--color-text-secondary)]">
                      {exaroton.accountEmail}
                    </span>
                  </div>
                  <button
                    className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[#f43f5e] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-[#f43f5e]/10 hover:not-disabled:border-[#f43f5e]/20 hover:not-disabled:text-[#f87171] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                    style={{ padding: "10px 20px" }}
                    onClick={() => setConfirmDisconnect("PENDING")}
                  >
                    Disconnect Account
                  </button>
                </div>

                {confirmDisconnect ? (
                  <ModalShell onClose={() => setConfirmDisconnect("")}>
                    <div className="text-center mb-[24px]">
                      <h2 className="m-0 mb-[8px] text-[1.8rem] tracking-[-0.02em]">
                        Confirm Disconnection
                      </h2>
                      <p className="m-0 text-[1rem] text-[var(--color-text-secondary)]">
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
                      className="flex items-center gap-[16px]"
                      style={{
                        justifyContent: "flex-end",
                        gap: 12,
                        marginTop: 20,
                      }}
                    >
                      <button
                        className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                        onClick={() => setConfirmDisconnect("")}
                      >
                        Cancel
                      </button>
                      <button
                        className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-br from-[#e11d48] to-[#be123c] text-white shadow-[0_4px_12px_rgba(225,29,72,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(225,29,72,0.4)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
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
                <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
                  <div
                    className="flex items-center gap-[16px]"
                    style={{ justifyContent: "space-between" }}
                  >
                    <h3 className="m-0 mb-[8px] text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
                      Selected Server
                    </h3>
                    <button
                      className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                      onClick={() => {
                        setExarotonStep("servers");
                        void listExarotonServers();
                      }}
                    >
                      Change Server
                    </button>
                  </div>
                  <div
                    className="border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[20px]"
                    style={{
                      background: "rgba(99,102,241,0.05)",
                      borderColor: "var(--brand-primary)",
                    }}
                  >
                    <div
                      className="flex items-center gap-[16px]"
                      style={{ justifyContent: "space-between" }}
                    >
                      <div>
                        <strong>{exaroton.selectedServer.name}</strong>
                        <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
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

              <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
                <div
                  className="flex items-center gap-[16px]"
                  style={{ justifyContent: "space-between" }}
                >
                  <h3 className="m-0 mb-[8px] text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
                    Controls & Settings
                  </h3>
                  {exaroton.busy ? (
                    <span className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
                      Saving...
                    </span>
                  ) : null}
                </div>
                <div
                  className="flex items-center gap-[16px]"
                  style={{ gap: 8, marginBottom: 12 }}
                >
                  <button
                    className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void exarotonAction("start")}
                  >
                    Start
                  </button>
                  <button
                    className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void exarotonAction("restart")}
                  >
                    Restart
                  </button>
                  <button
                    className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
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
                    <label
                      className="flex items-center gap-[12px] cursor-pointer text-[0.9rem] text-[var(--color-text-primary)] transition-colors hover:text-white [&>input]:w-[18px] [&>input]:h-[18px] [&>input]:accent-[var(--color-brand-primary)] [&>input]:cursor-pointer"
                      style={{ opacity: 0.7 }}
                    >
                      <input type="checkbox" checked disabled />
                      <span>Server status (required, cannot be disabled)</span>
                    </label>

                    <label className={ui.check}>
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

                    <div
                      className="bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-md)] p-[16px] text-[0.95rem] flex flex-col gap-[8px]"
                      style={{ marginTop: 4 }}
                    >
                      <strong>Player access</strong>
                      <div className="grid" style={{ marginTop: 8, gap: 8 }}>
                        <label className="flex items-center gap-[12px] cursor-pointer text-[0.9rem] text-[var(--color-text-primary)] transition-colors hover:text-white [&>input]:w-[18px] [&>input]:h-[18px] [&>input]:accent-[var(--color-brand-primary)] [&>input]:cursor-pointer">
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

                        <label className="flex items-center gap-[12px] cursor-pointer text-[0.9rem] text-[var(--color-text-primary)] transition-colors hover:text-white [&>input]:w-[18px] [&>input]:h-[18px] [&>input]:accent-[var(--color-brand-primary)] [&>input]:cursor-pointer">
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

                        <label className={ui.check}>
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

                        <label className={ui.check}>
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

                        <label className={ui.check}>
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

      <div
        className="flex items-center gap-[16px]"
        style={{ justifyContent: "flex-start" }}
      >
        <div className={statusClass(statuses.exaroton.tone)}>
          {statuses.exaroton.text}
        </div>
      </div>
      {exaroton.error ? (
        <div
          className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-[var(--radius-md)] p-[16px] text-[0.95rem] flex flex-col gap-[8px]"
          style={{ marginTop: 12 }}
        >
          <p>{exaroton.error}</p>
        </div>
      ) : null}
    </section>
  );
}
