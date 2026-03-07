"use client";

import { useState } from "react";

import { DataItem, DataList } from "@/admin/shared/ui/data-list";
import { TextInput } from "@/admin/shared/ui/form-controls";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";
import { ui } from "@/admin/shared/ui/styles";

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
        className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
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

      <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-[16px] mb-[8px] shrink-0">
        <div className={ui.modalBrand}>
          <h3>Support Matrix</h3>
          <p className={ui.modalMeta}>Internal Runtime Settings</p>
        </div>
      </div>
      <div className="p-[16px_20px] rounded-[var(--radius-md)] text-[0.9rem] leading-[1.5] border flex flex-col gap-[4px] bg-[#ef4444]/5 border-[#ef4444]/20 text-[#fca5a5] [&>strong]:text-[#ef4444] [&>strong]:uppercase [&>strong]:text-[0.75rem] [&>strong]:tracking-[0.05em]">
        <strong>Risk Warning</strong>
        <p>
          Altering support matrix values can break launcher bootup and runtime
          compatibility. This action requires server-side validation.
        </p>
      </div>
      <div className={ui.gridTwo}>
        <TextInput
          name="minecraftVersion"
          label="Selected Minecraft Version"
          value={form.minecraftVersion}
          placeholder="1.21.1"
          onChange={setTextFieldFromEvent}
        />
        <div className={ui.dataItem}>
          <span className={ui.dataLabel}>Fabric Loader Version</span>
          <select
            id="loaderVersion"
            name="loaderVersion"
            value={form.loaderVersion}
            onChange={setTextFieldFromEvent}
            className={ui.selectField}
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
          <label className={`${ui.check} ${ui.checkDanger}`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <span>I understand this change can break the system.</span>
          </label>
          <div className={ui.row}>
            <button
              type="button"
              className={ui.buttonGhost}
              onClick={() => void refreshLoaders()}
            >
              Refresh Loader List
            </button>
            <div className="relative inline-flex flex-col items-center">
              <button
                type="button"
                className={ui.buttonPrimary}
                disabled={!confirmed}
                onClick={() => {
                  void saveSettings();
                  onClose();
                }}
              >
                Save Matrix
              </button>
              {!confirmed ? (
                <span className="absolute top-full mt-[8px] bg-black/80 backdrop-blur-[4px] text-[var(--color-text-muted)] text-[0.75rem] p-[6px_10px] rounded-[var(--radius-sm)] border border-[var(--color-line)] whitespace-nowrap animate-[fadeIn_0.2s_ease-out] pointer-events-none z-10">
                  Confirm to enable save
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className={ui.row}>
          <button
            type="button"
            className={ui.buttonGhost}
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
      <div className={ui.gridTwo}>
        <article className={ui.panel}>
          <h3>Server Identity</h3>
          <p className={ui.hint}>
            Master identification and connection endpoints.
          </p>
          <div className="grid gap-[16px]">
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

        <article className={ui.panel}>
          <h3>Runtime & Compatibility</h3>
          <p className={ui.hint}>Minecraft and Fabric loader configuration.</p>
          <DataList>
            <DataItem label="MC Version" value={form.minecraftVersion} />
            <DataItem label="Loader" value={form.loaderVersion} />
          </DataList>
          <div className={ui.row}>
            <button
              type="button"
              className={ui.buttonPrimary}
              onClick={() => setOpenMatrix(true)}
            >
              Update Runtime Settings
            </button>
          </div>
        </article>

        <article className={ui.panel}>
          <h3>Branding & Assets</h3>
          <p className={ui.hint}>Visual identity for the launcher and menu.</p>
          <div className="grid gap-[16px]">
            <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-[12px] items-center">
              <div className="w-[84px] h-[84px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black/30 overflow-hidden grid place-items-center text-[var(--color-text-muted)]">
                {form.brandingLogoUrl ? (
                  <img
                    src={form.brandingLogoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Icon</span>
                )}
              </div>
              <div className="grid gap-[8px]">
                <span className={ui.dataLabel}>Server Logo / Icon</span>
                <div className="relative inline-flex items-center w-fit">
                  <button className={ui.buttonGhost} type="button">
                    Change Icon
                  </button>
                  <input
                    className="absolute inset-0 opacity-0 cursor-pointer"
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

            <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-[12px] items-center">
              <div className="w-[84px] h-[84px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black/30 overflow-hidden grid place-items-center text-[var(--color-text-muted)]">
                {form.brandingBackgroundUrl ? (
                  <img
                    src={form.brandingBackgroundUrl}
                    alt="BG"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>BG</span>
                )}
              </div>
              <div className="grid gap-[8px]">
                <span className={ui.dataLabel}>Background Wallpaper</span>
                <div className="relative inline-flex items-center w-fit">
                  <button className={ui.buttonGhost} type="button">
                    Change BG
                  </button>
                  <input
                    className="absolute inset-0 opacity-0 cursor-pointer"
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
