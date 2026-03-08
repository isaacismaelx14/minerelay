"use client";

import { useState } from "react";
import Image from "next/image";

import {
  Button,
  DataItem,
  DataList,
  Modal,
  ModalHeader,
  SectionHeader,
  TextInput,
  ui,
} from "@minerelay/ui";
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
    <Modal onClose={onClose}>
      <ModalHeader
        title="Support Matrix"
        subtitle="Internal Runtime Settings"
        onClose={onClose}
      />
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
            <Button
              variant="ghost"
              size="lg"
              onClick={() => void refreshLoaders()}
            >
              Refresh Loader List
            </Button>
            <div className="relative inline-flex flex-col items-center">
              <Button
                variant="primary"
                size="lg"
                disabled={!confirmed}
                onClick={() => {
                  void saveSettings();
                  onClose();
                }}
              >
                Save Matrix
              </Button>
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
          <Button
            variant="ghost"
            size="lg"
            onClick={() => void refreshLoaders()}
          >
            Refresh Loader List
          </Button>
        </div>
      )}

      <div className={statusClass(statuses.settings.tone)}>
        {statuses.settings.text}
      </div>
    </Modal>
  );
}

function BrandingUploadCard({
  label,
  imageUrl,
  altText,
  placeholder,
  buttonLabel,
  onUpload,
  wide,
}: {
  label: string;
  imageUrl: string | undefined;
  altText: string;
  placeholder: string;
  buttonLabel: string;
  onUpload: (file: File | null) => void;
  wide?: boolean;
}) {
  return (
    <div className="group relative rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black/20 p-4 flex items-center gap-4 transition-all duration-200 hover:border-[var(--color-line-strong)] hover:bg-black/30">
      <div
        className={`shrink-0 ${wide ? "w-[120px] h-[68px]" : "w-[72px] h-[72px]"} rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-black/40 overflow-hidden grid place-items-center text-[var(--color-text-muted)] text-xs`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText}
            width={wide ? 120 : 72}
            height={wide ? 68 : 72}
            unoptimized
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="opacity-40">{placeholder}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <span className={ui.dataLabel}>{label}</span>
        <div className="relative inline-flex items-center w-fit">
          <Button variant="ghost" size="xs">
            {buttonLabel}
          </Button>
          <input
            className="absolute inset-0 opacity-0 cursor-pointer"
            type="file"
            accept="image/*"
            onChange={(event) => onUpload(event.target.files?.[0] || null)}
          />
        </div>
      </div>
    </div>
  );
}

export function IdentityPage() {
  const { form, setTextFieldFromEvent, uploadBrandingImage } =
    useIdentityPageModel();
  const [openMatrix, setOpenMatrix] = useState(false);

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Server Identity */}
        <article className={ui.panel}>
          <SectionHeader
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px]"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            }
            title="Server Identity"
            description="Master identification and connection endpoints."
          />
          <div className="grid gap-4 mt-1">
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

        {/* Runtime & Compatibility */}
        <article className={ui.panel}>
          <SectionHeader
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px]"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            }
            title="Runtime & Compatibility"
            description="Minecraft and Fabric loader configuration."
          />
          <div className="mt-1">
            <DataList>
              <DataItem label="MC Version" value={form.minecraftVersion} />
              <DataItem label="Loader" value={form.loaderVersion} />
            </DataList>
          </div>
          <div className="mt-auto pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setOpenMatrix(true)}
            >
              Update Runtime Settings
            </Button>
          </div>
        </article>

        {/* Branding & Assets — full width */}
        <article className={`${ui.panel} md:col-span-2`}>
          <SectionHeader
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px]"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            }
            title="Branding & Assets"
            description="Visual identity for the launcher and menu."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
            <BrandingUploadCard
              label="Server Logo / Icon"
              imageUrl={form.brandingLogoUrl}
              altText="Logo"
              placeholder="Icon"
              buttonLabel="Change Icon"
              onUpload={(file) => void uploadBrandingImage("logo", file)}
            />
            <BrandingUploadCard
              label="Background Wallpaper"
              imageUrl={form.brandingBackgroundUrl}
              altText="BG"
              placeholder="BG"
              buttonLabel="Change BG"
              onUpload={(file) => void uploadBrandingImage("background", file)}
              wide
            />
          </div>

          <div className="mt-1">
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
    </div>
  );
}
