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
    <section className="panel">
      <div className="wizard-steps">
        <button
          type="button"
          className={`step ${activeStep >= 1 ? "done" : ""} ${activeStep === 1 ? "active" : ""}`}
          onClick={() => setActiveStep(1)}
        >
          1. Activation
        </button>
        <button
          type="button"
          className={`step ${activeStep >= 2 ? "done" : ""} ${activeStep === 2 ? "active" : ""}`}
          disabled={!isEnabled}
          onClick={() => isEnabled && setActiveStep(2)}
        >
          2. Mode & Config
        </button>
      </div>

      {activeStep === 1 ? (
        <div className="wizard-panel">
          <h3>Fancy Menu activation</h3>
          <div className="wizard-description">
            FancyMenu is a powerful mod that allows for full customization of
            the Minecraft main menu. By enabling this, we can override the
            default buttons, logo, and background with a premium brand
            experience.
          </div>

          <div className="wizard-box">
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
            <p className="wizard-meta">
              Setting this to Enabled will automatically include necessary core
              mods and configuration files in the profile.
            </p>
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn primary"
              disabled={!isEnabled}
              onClick={() => setActiveStep(2)}
            >
              Continue to Configuration
            </button>
          </div>
        </div>
      ) : null}

      {activeStep === 2 ? (
        <div className="wizard-panel">
          <h3>Choose your customization path</h3>
          <p className="hint">
            Select how you want to build your main menu experience.
          </p>

          <div className="mode-grid">
            <button
              type="button"
              className={`mode-card ${form.fancyMenuMode === "simple" ? "active" : ""}`}
              onClick={() => setFancyMenuMode("simple")}
            >
              <div className="mode-card-icon">⚡</div>
              <h4>Simple Form</h4>
              <p>
                Quickly set a custom logo, background and play button labels via
                the form below.
              </p>
            </button>
            <button
              type="button"
              className={`mode-card ${form.fancyMenuMode === "custom" ? "active" : ""}`}
              onClick={() => setFancyMenuMode("custom")}
            >
              <div className="mode-card-icon">📦</div>
              <h4>Custom Bundle</h4>
              <p>
                Upload a full FancyMenu .zip export with custom layouts,
                animations and more.
              </p>
            </button>
          </div>

          {form.fancyMenuMode === "simple" ? (
            <div className="wizard-box">
              <div className="grid two">
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
              <div className="grid two" style={{ marginTop: 8 }}>
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
            <div className="wizard-box">
              <div
                className="wizard-description"
                style={{ fontSize: "0.85rem" }}
              >
                <strong>Important:</strong> Your .zip must contain a valid
                FancyMenu export structure (usually including a{" "}
                <code>customization</code> folder).
              </div>
              <div className="grid two">
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
              <div className="row">
                <button
                  type="button"
                  className="btn ghost"
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
            className="row"
            style={{ justifyContent: "flex-start", marginTop: 12 }}
          >
            <button
              type="button"
              className="btn ghost"
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
