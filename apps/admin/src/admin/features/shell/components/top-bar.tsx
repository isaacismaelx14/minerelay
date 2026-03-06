"use client";

import { memo, useState } from "react";

import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { ExarotonLogo } from "@/admin/shared/ui/exaroton-logo";
import {
  exarotonStatusClass,
  getExarotonStatusTone,
  statusClass,
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
    <div className="exaroton-widget">
      <div className="widget-status">
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
        <span className="widget-server-name">{server.name}:</span>
        <span className={exarotonStatusClass(server.status)}>
          {server.statusLabel}
        </span>
        <span className="widget-player-count">
          {server.players.count}/{server.players.max} online
        </span>
      </div>
      <div className="widget-controls">
        <button
          className="control-btn"
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
          className="control-btn"
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
          className="control-btn"
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
    statuses,
    saveDraft,
    publishProfile,
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
    <section className="topbar">
      <div className="topbar-meta">
        {exaroton.connected ? (
          <ExarotonWidget />
        ) : (
          <ExarotonLogo style={{ height: 28 }} />
        )}
      </div>
      <div className="topbar-actions">
        <button
          className="btn ghost"
          type="button"
          onClick={() => void saveDraft()}
        >
          Save Draft
        </button>
        {hasPendingPublish || hasSavedDraft ? (
          <div className="publish-reminder">
            {hasPendingPublish ? (
              <span className="requires-publish">Requires Publish</span>
            ) : (
              <span className="draft-pending">Draft pending</span>
            )}
            <button
              className="btn"
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
              <span className="btn-tooltip">{publishBlockReason}</span>
            ) : null}
          </div>
        ) : (
          <span className="publish-clean">All changes published</span>
        )}
        <button
          className="btn danger ghost"
          type="button"
          style={{ padding: "8px 12px" }}
          onClick={() => void logout()}
        >
          Logout
        </button>
      </div>
      <div className={statusClass(statuses.draft.tone)}>
        {statuses.draft.text}
      </div>

      {showExarotonPublishWarning ? (
        <ModalShell onClose={() => setShowExarotonPublishWarning(false)}>
          <div className="step-header">
            <h2>Before first Exaroton mod sync</h2>
            <p>
              We recommend deleting existing mods from your Exaroton server
              first to avoid conflicts, duplicates, or incompatible jars.
            </p>
          </div>
          <div className="alert-box">
            <p>
              Once you click publish, server-target mods will be synchronized to
              the Exaroton <b>mods</b> folder.
            </p>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setShowExarotonPublishWarning(false)}
            >
              Cancel
            </button>
            <button
              className="btn"
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
