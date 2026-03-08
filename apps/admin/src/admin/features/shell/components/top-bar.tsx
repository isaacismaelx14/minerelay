"use client";

import { memo, useState } from "react";

import { Button, Modal, ModalHeader, useToast } from "@minerelay/ui";
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
    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl py-1.5 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            statusTone === "ok"
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
              : statusTone === "error"
                ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"
                : "bg-gray-500"
          }`}
        />
        <span className="text-sm font-semibold text-white">{server.name}</span>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded ${exarotonStatusClass(server.status)}`}
        >
          {server.statusLabel}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {server.players.count}/{server.players.max} online
        </span>
      </div>
      <div className="flex gap-1 border-l border-white/[0.08] pl-2.5">
        <button
          className="w-7 h-7 rounded-lg grid place-items-center cursor-pointer transition-all bg-transparent text-[var(--color-text-muted)] hover:not-disabled:bg-white/[0.08] hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed border-none"
          type="button"
          title="Start Server"
          disabled={exaroton.busy || disableStartByStatus}
          onClick={() => void exarotonAction("start")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button
          className="w-7 h-7 rounded-lg grid place-items-center cursor-pointer transition-all bg-transparent text-[var(--color-text-muted)] hover:not-disabled:bg-white/[0.08] hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed border-none"
          type="button"
          title="Restart Server"
          disabled={exaroton.busy || disableRestartByStatus}
          onClick={() => void exarotonAction("restart")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <button
          className="w-7 h-7 rounded-lg grid place-items-center cursor-pointer transition-all bg-transparent text-[var(--color-text-muted)] hover:not-disabled:bg-white/[0.08] hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed border-none"
          type="button"
          title="Stop Server"
          disabled={exaroton.busy || disableStopByStatus}
          onClick={() => void exarotonAction("stop")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
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
    discardDraft,
    publishProfile,
    statuses,
  } = useTopBarModel();
  const { pushToast } = useToast();
  const [showExarotonPublishWarning, setShowExarotonPublishWarning] =
    useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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

    void publishProfile().then(() => {
      const s = statuses.publish;
      if (s.tone === "ok") pushToast("success", s.text);
      else if (s.tone === "error") pushToast("error", s.text);
    });
  };

  const acknowledgeWarningAndPublish = () => {
    localStorage.setItem(EXAROTON_MODS_WARNING_KEY, "1");
    setShowExarotonPublishWarning(false);
    void publishProfile().then(() => {
      const s = statuses.publish;
      if (s.tone === "ok") pushToast("success", s.text);
      else if (s.tone === "error") pushToast("error", s.text);
    });
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-5 flex-wrap">
      {/* Left side: server widget */}
      <div className="flex items-center gap-3 min-w-0">
        {exaroton.connected ? <ExarotonWidget /> : null}
      </div>

      {/* Right side: status + actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Status badge */}
        {hasPendingPublish || hasSavedDraft ? (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
              hasPendingPublish
                ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                : "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
            }`}
          >
            {hasPendingPublish ? "Requires Publish" : "Draft pending"}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)] px-2.5 py-1">
            All changes published
          </span>
        )}

        {/* Publish */}
        {(hasPendingPublish || hasSavedDraft) && (
          <Button
            variant="success"
            size="sm"
            disabled={isBusy.publish || Boolean(publishBlockReason)}
            onClick={handlePublish}
            title={
              publishBlockReason ||
              (isBusy.publish ? statuses.publish.text : undefined)
            }
          >
            {publishButtonLabel}
          </Button>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] mx-0.5" />

        {/* Save Draft */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void saveDraft().then(() => {
              const s = statuses.draft;
              if (s.tone === "ok") pushToast("success", s.text);
              else if (s.tone === "error") pushToast("error", s.text);
            })
          }
        >
          Save Draft
        </Button>

        {/* Discard Draft */}
        {(hasPendingPublish || hasSavedDraft) && (
          <Button
            variant="warn"
            size="sm"
            onClick={() => setShowDiscardConfirm(true)}
          >
            Discard
          </Button>
        )}

        {/* Logout */}
        <Button variant="danger-ghost" size="sm" onClick={() => void logout()}>
          Logout
        </Button>
      </div>

      {/* Discard Draft Confirmation */}
      {showDiscardConfirm ? (
        <Modal onClose={() => setShowDiscardConfirm(false)}>
          <ModalHeader
            title="Discard Draft?"
            onClose={() => setShowDiscardConfirm(false)}
          />
          <div className="p-5 overflow-y-auto">
            <p className="border border-amber-500/30 bg-amber-500/10 text-amber-400 p-4 rounded-xl text-sm leading-relaxed m-0">
              All unsaved changes will be lost. The profile will be reloaded
              from the last published state.
            </p>
          </div>
          <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-3 bg-black/10 shrink-0">
            <Button
              variant="flat"
              size="md"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="warn"
              size="md"
              className="!bg-amber-500 !text-black !border-transparent hover:not-disabled:!bg-amber-400 shadow-lg shadow-amber-500/20"
              onClick={() => {
                void discardDraft().then(() => {
                  const s = statuses.draft;
                  if (s.tone === "ok") pushToast("success", "Draft discarded.");
                  else if (s.tone === "error") pushToast("error", s.text);
                });
                setShowDiscardConfirm(false);
              }}
            >
              Discard Changes
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* Exaroton Publish Warning */}
      {showExarotonPublishWarning ? (
        <Modal onClose={() => setShowExarotonPublishWarning(false)}>
          <ModalHeader
            title="Before first Exaroton mod sync"
            onClose={() => setShowExarotonPublishWarning(false)}
          />
          <div className="p-5 overflow-y-auto flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed m-0">
              We recommend deleting existing mods from your Exaroton server
              first to avoid conflicts, duplicates, or incompatible jars.
            </p>
            <div className="bg-black/25 border border-[var(--color-line)] rounded-xl p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
              Once you click publish, server-target mods will be synchronized to
              the Exaroton <b className="text-white">mods</b> folder.
            </div>
          </div>
          <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-3 bg-black/10 shrink-0">
            <Button
              variant="flat"
              size="md"
              onClick={() => setShowExarotonPublishWarning(false)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="md"
              onClick={acknowledgeWarningAndPublish}
            >
              I Understand
            </Button>
          </div>
        </Modal>
      ) : null}
    </header>
  );
});
