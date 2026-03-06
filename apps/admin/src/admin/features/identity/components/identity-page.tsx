"use client";

import { useState } from "react";

import { DataItem, DataList } from "@/admin/shared/ui/data-list";
import { TextInput } from "@/admin/shared/ui/form-controls";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";

import { useIdentityPageModel } from "../hooks/use-identity-page-model";

function SupportMatrixModal({ onClose }: { onClose: () => void }) {
  const {
    form,
    baselineRuntime,
    loaderOptions,
    setTextFieldFromEvent,
    refreshLoaders,
    saveSettings,
    statuses,
  } = useIdentityPageModel();
  const [confirmed, setConfirmed] = useState(false);

  const hasChanges =
    form.minecraftVersion.trim() !== baselineRuntime.minecraftVersion.trim() ||
    form.loaderVersion.trim() !== baselineRuntime.loaderVersion.trim();

  return (
    <ModalShell onClose={onClose}>
      <button
        className="modal-close-icon"
        type="button"
        onClick={onClose}
        title="Close"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 18, height: 18 }}
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="modal-head">
        <div className="modal-brand">
          <h3>Support Matrix</h3>
          <p className="meta">Internal Runtime Settings</p>
        </div>
      </div>
      <div className="alert-box danger">
        <strong>Risk Warning</strong>
        <p>
          Altering support matrix values can break launcher bootup and runtime
          compatibility. This action requires server-side validation.
        </p>
      </div>
      <div className="grid two">
        <TextInput
          name="minecraftVersion"
          label="Selected Minecraft Version"
          value={form.minecraftVersion}
          placeholder="1.21.1"
          onChange={setTextFieldFromEvent}
        />
        <div className="data-item">
          <span className="data-label">Fabric Loader Version</span>
          <select
            id="loaderVersion"
            name="loaderVersion"
            value={form.loaderVersion}
            onChange={setTextFieldFromEvent}
          >
            <option value="">Select loader version</option>
            {loaderOptions.map((entry) => (
              <option key={entry.version} value={entry.version}>
                {entry.version}
                {entry.stable ? " (stable)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasChanges ? (
        <>
          <label className="check danger">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <span>I understand this change can break the system.</span>
          </label>
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => void refreshLoaders()}
            >
              Refresh Loader List
            </button>
            <div className="btn-wrapper">
              <button
                type="button"
                className="btn"
                disabled={!confirmed}
                onClick={() => {
                  void saveSettings();
                  onClose();
                }}
              >
                Save Matrix
              </button>
              {!confirmed ? (
                <span className="btn-tooltip">Confirm to enable save</span>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => void refreshLoaders()}
          >
            Refresh Loader List
          </button>
        </div>
      )}

      <div className={statusClass(statuses.settings.tone)}>
        {statuses.settings.text}
      </div>
    </ModalShell>
  );
}

export function IdentityPage() {
  const { form, setTextFieldFromEvent, uploadBrandingImage } =
    useIdentityPageModel();
  const [openMatrix, setOpenMatrix] = useState(false);

  return (
    <>
      <div className="grid two">
        <article className="panel">
          <h3>Server Identity</h3>
          <p className="hint">
            Master identification and connection endpoints.
          </p>
          <div className="grid">
            <TextInput
              name="serverName"
              label="Display Name"
              value={form.serverName}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="serverAddress"
              label="Server Address (IP/Host)"
              value={form.serverAddress}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="profileId"
              label="Profile Identifier"
              value={form.profileId}
              onChange={setTextFieldFromEvent}
              readOnly
            />
          </div>
        </article>

        <article className="panel">
          <h3>Runtime & Compatibility</h3>
          <p className="hint">Minecraft and Fabric loader configuration.</p>
          <DataList>
            <DataItem label="MC Version" value={form.minecraftVersion} />
            <DataItem label="Loader" value={form.loaderVersion} />
          </DataList>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => setOpenMatrix(true)}
            >
              Update Runtime Settings
            </button>
          </div>
        </article>

        <article className="panel">
          <h3>Branding & Assets</h3>
          <p className="hint">Visual identity for the launcher and menu.</p>
          <div className="grid">
            <div className="image-field">
              <div className="image-preview-box">
                {form.brandingLogoUrl ? (
                  <img src={form.brandingLogoUrl} alt="Logo" />
                ) : (
                  <span>Icon</span>
                )}
              </div>
              <div className="upload-controls">
                <span className="data-label">Server Logo / Icon</span>
                <div className="file-input-wrapper">
                  <button className="btn ghost" type="button">
                    Change Icon
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void uploadBrandingImage(
                        "logo",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="image-field">
              <div className="image-preview-box">
                {form.brandingBackgroundUrl ? (
                  <img src={form.brandingBackgroundUrl} alt="BG" />
                ) : (
                  <span>BG</span>
                )}
              </div>
              <div className="upload-controls">
                <span className="data-label">Background Wallpaper</span>
                <div className="file-input-wrapper">
                  <button className="btn ghost" type="button">
                    Change BG
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void uploadBrandingImage(
                        "background",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <TextInput
              name="brandingNewsUrl"
              label="Server News Feed URL (RSS/JSON)"
              value={form.brandingNewsUrl || ""}
              placeholder="https://server.com/news.json"
              onChange={setTextFieldFromEvent}
            />
          </div>
        </article>
      </div>

      {openMatrix ? (
        <SupportMatrixModal onClose={() => setOpenMatrix(false)} />
      ) : null}
    </>
  );
}
