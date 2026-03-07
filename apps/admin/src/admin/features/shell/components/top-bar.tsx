"use client";

import { memo, useState } from "react";

import { ModalShell } from "@/admin/shared/ui/modal-shell";
import {
  exarotonStatusClass,
  getExarotonStatusTone,
} from "@/admin/shared/ui/status";

import { useTopBarModel } from "../hooks/use-top-bar-model";

const EXAROTON_MODS_WARNING_KEY = "admin-exaroton-mods-delete-warning-v1";

const ExarotonWidget = memo(function ExarotonWidget() {
  const { exaroton, exarotonAction } = useTopBarModel();

  if (!exaroton.connected || !exaroton.selectedServer) return null;

  const server = exaroton.selectedServer;
  const statusTone = getExarotonStatusTone(server.status);
  const disableStartByStatus = [1, 2, 3, 4, 6].includes(server.status);
  const disableStopByStatus = [0, 2, 3, 4, 6].includes(server.status);
  const disableRestartByStatus = [0, 2, 3, 4, 6].includes(server.status);

  return (
    <div className="bg-black/30 border border-[var(--color-line-strong)] rounded-[var(--radius-xl)] py-[6px] px-[16px] flex items-center gap-[16px] text-[0.85rem] backdrop-blur-[var(--blur-glass)]">
      <div className="flex items-center gap-[8px] font-semibold">
        <span
          className={`widget-dot ${statusTone}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              statusTone === "ok"
                ? "var(--success)"
                : statusTone === "error"
                  ? "var(--danger)"
                  : "var(--text-muted)",
          }}
        />
        <span className="text-[var(--color-text-primary)] font-bold">
          {server.name}:
        </span>
        <span className={exarotonStatusClass(server.status)}>
          {server.statusLabel}
        </span>
        <span className="text-[var(--color-text-muted)] text-[0.72rem] font-medium ml-[2px] whitespace-nowrap">
          {server.players.count}/{server.players.max} online
        </span>
      </div>
      <div className="flex gap-[4px] border-l border-[var(--color-line)] pl-[12px]">
        <button
          className="w-[28px] h-[28px] rounded-[6px] grid place-items-center cursor-pointer transition-all duration-200 bg-transparent text-[var(--color-text-secondary)] hover:not-disabled:bg-white/10 hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed [&>svg]:w-[14px] [&>svg]:h-[14px]"
          type="button"
          title="Start Server"
          disabled={exaroton.busy || disableStartByStatus}
          onClick={() => void exarotonAction("start")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button
          className="w-[28px] h-[28px] rounded-[6px] grid place-items-center cursor-pointer transition-all duration-200 bg-transparent text-[var(--color-text-secondary)] hover:not-disabled:bg-white/10 hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed [&>svg]:w-[14px] [&>svg]:h-[14px]"
          type="button"
          title="Restart Server"
          disabled={exaroton.busy || disableRestartByStatus}
          onClick={() => void exarotonAction("restart")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <button
          className="w-[28px] h-[28px] rounded-[6px] grid place-items-center cursor-pointer transition-all duration-200 bg-transparent text-[var(--color-text-secondary)] hover:not-disabled:bg-white/10 hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed [&>svg]:w-[14px] [&>svg]:h-[14px]"
          type="button"
          title="Stop Server"
          disabled={exaroton.busy || disableStopByStatus}
          onClick={() => void exarotonAction("stop")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export const TopBar = memo(function TopBar() {
  const {
    exaroton,
    hasPendingPublish,
    publishBlockReason,
    hasSavedDraft,
    isBusy,
    logout,
    saveDraft,
    publishProfile,
    statuses,
  } = useTopBarModel();
  const [showExarotonPublishWarning, setShowExarotonPublishWarning] =
    useState(false);

  const publishButtonLabel =
    isBusy.publish && statuses.publish.text.trim().length > 0
      ? statuses.publish.text
      : "Publish";

  const handlePublish = () => {
    if (publishBlockReason) {
      return;
    }

    const shouldWarn =
      exaroton.connected &&
      exaroton.settings.modsSyncEnabled &&
      !localStorage.getItem(EXAROTON_MODS_WARNING_KEY);

    if (shouldWarn) {
      setShowExarotonPublishWarning(true);
      return;
    }

    void publishProfile();
  };

  const acknowledgeWarningAndPublish = () => {
    localStorage.setItem(EXAROTON_MODS_WARNING_KEY, "1");
    setShowExarotonPublishWarning(false);
    void publishProfile();
  };

  return (
    <section className="flex justify-between items-start gap-[24px] border-b border-[var(--color-line)] pb-[24px]">
      <div className="text-[0.92rem] text-[var(--color-text-secondary)] [&_b]:text-white">
        {exaroton.connected ? <ExarotonWidget /> : null}
      </div>
      <div className="flex gap-[12px] items-center">
        {hasPendingPublish || hasSavedDraft ? (
          <div className="flex items-center gap-[8px]">
            {hasPendingPublish ? (
              <span className="text-[0.78rem] font-semibold text-[#f97316] bg-[#f97316]/12 border border-[#f97316]/30 rounded-[6px] py-[3px] px-[10px] whitespace-nowrap">
                Requires Publish
              </span>
            ) : (
              <span className="text-[0.78rem] font-semibold text-[#eab308] bg-[#eab308]/12 border border-[#eab308]/30 rounded-[6px] py-[3px] px-[10px] whitespace-nowrap">
                Draft pending
              </span>
            )}
            <button
              className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)]"
              type="button"
              disabled={isBusy.publish || Boolean(publishBlockReason)}
              onClick={handlePublish}
              title={
                publishBlockReason ||
                (isBusy.publish ? statuses.publish.text : undefined)
              }
            >
              {publishButtonLabel}
            </button>
            {publishBlockReason ? (
              <span className="text-[0.75rem] text-[#fca5a5] font-medium opacity-90 bg-[#ef4444]/10 py-[6px] px-[12px] rounded-[var(--radius-sm)] border border-[#ef4444]/15 absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap z-10">
                {publishBlockReason}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-[0.82rem] text-[var(--color-text-muted)]">
            All changes published
          </span>
        )}
        <button
          className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          type="button"
          onClick={() => void saveDraft()}
        >
          Save Draft
        </button>
        <button
          className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-gradient-to-br from-[#e11d48] to-[#be123c] text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          type="button"
          style={{ padding: "8px 12px" }}
          onClick={() => void logout()}
        >
          Logout
        </button>
      </div>

      {showExarotonPublishWarning ? (
        <ModalShell onClose={() => setShowExarotonPublishWarning(false)}>
          <div className="flex items-center justify-between mb-[4px]">
            <h2 className="m-0 mb-2 text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
              Before first Exaroton mod sync
            </h2>
            <p className="text-[0.88rem] text-[var(--color-text-muted)] leading-[1.6]">
              We recommend deleting existing mods from your Exaroton server
              first to avoid conflicts, duplicates, or incompatible jars.
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-black/25 min-h-[42px] flex items-center justify-center py-[10px] px-[14px] text-[0.85rem] text-[var(--color-text-muted)] transition-all duration-150 ease-out mt-3">
            <p>
              Once you click publish, server-target mods will be synchronized to
              the Exaroton <b>mods</b> folder.
            </p>
          </div>
          <div className="flex justify-end gap-[16px] mt-4">
            <button
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              type="button"
              onClick={() => setShowExarotonPublishWarning(false)}
            >
              Cancel
            </button>
            <button
              className="border border-white/10 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)]"
              type="button"
              onClick={acknowledgeWarningAndPublish}
            >
              I Understand
            </button>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
});
