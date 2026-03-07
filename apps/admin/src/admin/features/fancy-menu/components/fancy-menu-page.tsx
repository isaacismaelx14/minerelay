"use client";

import { useRef, useState } from "react";

import { SelectInput, TextInput } from "@/admin/shared/ui/form-controls";
import { statusClass } from "@/admin/shared/ui/status";

import { useFancyMenuPageModel } from "../hooks/use-fancy-menu-page-model";

export function FancyMenuPage() {
  const {
    form,
    setTextFieldFromEvent,
    statuses,
    uploadFancyBundle,
    setFancyMenuEnabled,
    setFancyMenuMode,
  } = useFancyMenuPageModel();
  const bundleUploadRef = useRef<HTMLInputElement | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  const isEnabled = form.fancyMenuEnabled === "true";

  return (
    <section className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 relative">
      <div className="flex gap-[8px] mb-[24px]">
        <button
          type="button"
          className={`flex-1 text-center py-[12px] px-[20px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] border-none rounded-[var(--radius-md)] cursor-pointer whitespace-nowrap transition-all duration-300 [&.active]:bg-gradient-to-r [&.active]:from-[var(--color-brand-primary)] [&.active]:to-[var(--color-brand-accent)] [&.active]:text-white [&.active]:shadow-[0_4px_12px_rgba(99,102,241,0.3)] [&.done]:bg-[var(--color-brand-primary)]/10 [&.done]:text-[var(--color-brand-primary)] hover:not(:disabled):not(.active):bg-[white]/5 disabled:opacity-40 disabled:cursor-not-allowed ${activeStep >= 1 ? "done" : ""} ${activeStep === 1 ? "active" : ""}`}
          onClick={() => setActiveStep(1)}
        >
          1. Activation
        </button>
        <button
          type="button"
          className={`flex-1 text-center py-[12px] px-[20px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] border-none rounded-[var(--radius-md)] cursor-pointer whitespace-nowrap transition-all duration-300 [&.active]:bg-gradient-to-r [&.active]:from-[var(--color-brand-primary)] [&.active]:to-[var(--color-brand-accent)] [&.active]:text-white [&.active]:shadow-[0_4px_12px_rgba(99,102,241,0.3)] [&.done]:bg-[var(--color-brand-primary)]/10 [&.done]:text-[var(--color-brand-primary)] hover:not(:disabled):not(.active):bg-[white]/5 disabled:opacity-40 disabled:cursor-not-allowed ${activeStep >= 2 ? "done" : ""} ${activeStep === 2 ? "active" : ""}`}
          disabled={!isEnabled}
          onClick={() => isEnabled && setActiveStep(2)}
        >
          2. Mode & Config
        </button>
      </div>

      {activeStep === 1 ? (
        <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-line)] rounded-[var(--radius-md)] p-[32px] animate-[fadeIn_0.3s_ease-out] relative">
          <h3 className="m-0 mb-[12px] text-[1.4rem]">Fancy Menu activation</h3>
          <div className="text-[0.95rem] text-[var(--color-text-secondary)] leading-[1.6] mb-[24px]">
            FancyMenu is a powerful mod that allows for full customization of
            the Minecraft main menu. By enabling this, we can override the
            default buttons, logo, and background with a premium brand
            experience.
          </div>

          <div className="bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-md)] p-[24px] mb-[24px]">
            <SelectInput
              name="fancyMenuEnabled"
              label="FancyMenu Status"
              value={form.fancyMenuEnabled}
              onChange={(event) => {
                const enabled = event.currentTarget.value === "true";
                setFancyMenuEnabled(enabled);
                if (enabled) setActiveStep(2);
              }}
              options={[
                { value: "false", label: "Disabled (Standard Minecraft Menu)" },
                { value: "true", label: "Enabled (Custom Brand Experience)" },
              ]}
            />
            <p className="m-[16px_0_0] text-[0.85rem] text-[var(--color-text-muted)]">
              Setting this to Enabled will automatically include necessary core
              mods and configuration files in the profile.
            </p>
          </div>

          <div
            className="flex items-center gap-[16px]"
            style={{ justifyContent: "flex-end" }}
          >
            <button
              type="button"
              className="border border-[var(--color-brand-primary)] rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:not-disabled:shadow-[0_8px_20px_rgba(99,102,241,0.4),0_0_12px_rgba(99,102,241,0.2)] hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
              disabled={!isEnabled}
              onClick={() => setActiveStep(2)}
            >
              Continue to Configuration
            </button>
          </div>
        </div>
      ) : null}

      {activeStep === 2 ? (
        <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-line)] rounded-[var(--radius-md)] p-[32px] animate-[fadeIn_0.3s_ease-out] relative">
          <h3 className="m-0 mb-[12px] text-[1.4rem]">
            Choose your customization path
          </h3>
          <p className="text-[0.9rem] text-[var(--color-text-muted)] m-0 leading-[1.5]">
            Select how you want to build your main menu experience.
          </p>

          <div className="grid grid-cols-2 gap-[20px] my-[24px]">
            <button
              type="button"
              className={`bg-[var(--color-bg-card)] border-2 border-transparent rounded-[var(--radius-lg)] p-[24px] text-left cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col gap-[12px] hover:bg-[var(--color-bg-hover)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] [&.active]:border-[var(--color-brand-primary)] [&.active]:bg-[#6366f1]/5 [&.active]:shadow-[0_0_0_2px_rgba(99,102,241,0.2),0_8px_24px_rgba(99,102,241,0.15)] ${form.fancyMenuMode === "simple" ? "active" : ""}`}
              onClick={() => setFancyMenuMode("simple")}
            >
              <div className="text-[2rem] mb-[8px]">⚡</div>
              <h4 className="m-0 text-[1.1rem] text-white">Simple Form</h4>
              <p className="m-0 text-[0.9rem] text-[var(--color-text-secondary)] leading-[1.5]">
                Quickly set a custom logo, background and play button labels via
                the form below.
              </p>
            </button>
            <button
              type="button"
              className={`bg-[var(--color-bg-card)] border-2 border-transparent rounded-[var(--radius-lg)] p-[24px] text-left cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col gap-[12px] hover:bg-[var(--color-bg-hover)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] [&.active]:border-[var(--color-brand-primary)] [&.active]:bg-[#6366f1]/5 [&.active]:shadow-[0_0_0_2px_rgba(99,102,241,0.2),0_8px_24px_rgba(99,102,241,0.15)] ${form.fancyMenuMode === "custom" ? "active" : ""}`}
              onClick={() => setFancyMenuMode("custom")}
            >
              <div className="text-[2rem] mb-[8px]">📦</div>
              <h4 className="m-0 text-[1.1rem] text-white">Custom Bundle</h4>
              <p className="m-0 text-[0.9rem] text-[var(--color-text-secondary)] leading-[1.5]">
                Upload a full FancyMenu .zip export with custom layouts,
                animations and more.
              </p>
            </button>
          </div>

          {form.fancyMenuMode === "simple" ? (
            <div className="bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-md)] p-[24px] mb-[24px]">
              <div className="grid grid-cols-[1fr_1fr] gap-[24px]">
                <TextInput
                  name="playButtonLabel"
                  label="Play Button Label"
                  value={form.playButtonLabel}
                  placeholder="START"
                  onChange={setTextFieldFromEvent}
                />
                <TextInput
                  name="brandingLogoUrl"
                  label="Brand Logo URL"
                  value={form.brandingLogoUrl}
                  placeholder="https://..."
                  onChange={setTextFieldFromEvent}
                />
                <TextInput
                  name="brandingBackgroundUrl"
                  label="Brand Background URL"
                  value={form.brandingBackgroundUrl}
                  placeholder="https://..."
                  onChange={setTextFieldFromEvent}
                />
              </div>
              <div
                className="grid grid-cols-[1fr_1fr] gap-[24px]"
                style={{ marginTop: 8 }}
              >
                <SelectInput
                  name="hideSingleplayer"
                  label="Hide Singleplayer"
                  value={form.hideSingleplayer}
                  onChange={setTextFieldFromEvent}
                  options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
                <SelectInput
                  name="hideMultiplayer"
                  label="Hide Multiplayer"
                  value={form.hideMultiplayer}
                  onChange={setTextFieldFromEvent}
                  options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-md)] p-[24px] mb-[24px]">
              <div
                className="text-[0.95rem] text-[var(--color-text-secondary)] leading-[1.6] mb-[24px]"
                style={{ fontSize: "0.85rem" }}
              >
                <strong>Important:</strong> Your .zip must contain a valid
                FancyMenu export structure (usually including a{" "}
                <code>customization</code> folder).
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-[24px]">
                <TextInput
                  name="fancyMenuCustomLayoutUrl"
                  label="Bundle Download URL"
                  value={form.fancyMenuCustomLayoutUrl}
                  placeholder="https://.../bundle.zip"
                  onChange={setTextFieldFromEvent}
                />
                <TextInput
                  name="fancyMenuCustomLayoutSha256"
                  label="Bundle SHA256"
                  value={form.fancyMenuCustomLayoutSha256}
                  placeholder="hex sha256"
                  onChange={setTextFieldFromEvent}
                />
              </div>
              <div className="flex items-center gap-[16px]">
                <button
                  type="button"
                  className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
                  style={{ width: "100%" }}
                  onClick={() => bundleUploadRef.current?.click()}
                >
                  Upload New Bundle .zip
                </button>
                <input
                  ref={bundleUploadRef}
                  type="file"
                  accept=".zip"
                  hidden
                  onChange={(event) => {
                    void uploadFancyBundle(
                      event.currentTarget.files?.[0] ?? null,
                    );
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
          )}

          <div
            className="flex items-center gap-[16px]"
            style={{ justifyContent: "flex-start", marginTop: 12 }}
          >
            <button
              type="button"
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-out inline-flex items-center justify-center text-[0.9rem] gap-[8px] bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8]"
              onClick={() => setActiveStep(1)}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={statusClass(statuses.fancy.tone)}
        style={{ marginTop: 24 }}
      >
        {statuses.fancy.text}
      </div>
    </section>
  );
}
