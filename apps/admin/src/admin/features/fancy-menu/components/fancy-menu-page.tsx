"use client";

import { useRef } from "react";

import {
  Alert,
  Button,
  Card,
  Select,
  SectionHeader,
  SelectableCard,
  SettingRow,
  TextInput,
  ToggleSwitch,
} from "@minerelay/ui";
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

  const isEnabled = form.fancyMenuEnabled === "true";

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Activation Card ─────────────────────────────── */}
        <Card>
          <SectionHeader
            icon={
              <span className="material-symbols-outlined text-[18px]">
                auto_awesome
              </span>
            }
            title="FancyMenu"
            description="Override the default Minecraft main menu with a premium brand experience."
          />

          <SettingRow
            title={isEnabled ? "Enabled" : "Disabled"}
            description={
              isEnabled
                ? "Core mods and config files included in profile."
                : "Standard Minecraft menu will be used."
            }
            control={
              <ToggleSwitch
                enabled={isEnabled}
                onChange={(next) => setFancyMenuEnabled(next)}
              />
            }
          />

          <div className={`${statusClass(statuses.fancy.tone)} mt-auto`}>
            {statuses.fancy.text}
          </div>
        </Card>

        {/* ── Mode Selection Card ─────────────────────────── */}
        <Card className={!isEnabled ? "opacity-40 pointer-events-none" : ""}>
          <SectionHeader
            icon={
              <span className="material-symbols-outlined text-[18px]">
                tune
              </span>
            }
            title="Customization Mode"
            description="Choose how to build your main menu experience."
          />

          <div className="grid grid-cols-2 gap-3 mt-1">
            <SelectableCard
              selected={form.fancyMenuMode === "simple"}
              onClick={() => setFancyMenuMode("simple")}
              icon={
                <span className="material-symbols-outlined text-[20px] text-[var(--color-brand-primary)]">
                  bolt
                </span>
              }
              title="Simple Form"
              description="Set logo, background, and button labels via quick fields."
            />

            <SelectableCard
              selected={form.fancyMenuMode === "custom"}
              onClick={() => setFancyMenuMode("custom")}
              icon={
                <span className="material-symbols-outlined text-[20px] text-[var(--color-brand-primary)]">
                  inventory_2
                </span>
              }
              title="Custom Bundle"
              description="Upload a full FancyMenu .zip with layouts and animations."
            />
          </div>
        </Card>

        {/* ── Configuration Card (full width) ─────────────── */}
        {isEnabled ? (
          <Card className="md:col-span-2">
            <SectionHeader
              icon={
                <span className="material-symbols-outlined text-[18px]">
                  settings
                </span>
              }
              title={
                form.fancyMenuMode === "simple"
                  ? "Simple Configuration"
                  : "Custom Bundle"
              }
              description={
                form.fancyMenuMode === "simple"
                  ? "Configure branding assets and menu button visibility."
                  : "Provide or upload a FancyMenu bundle export."
              }
            />

            {form.fancyMenuMode === "simple" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
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
                <div />
                <Select
                  name="hideSingleplayer"
                  label="Hide Singleplayer"
                  value={form.hideSingleplayer}
                  onChange={setTextFieldFromEvent}
                  options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
                <Select
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
            ) : (
              <div className="flex flex-col gap-4 mt-1">
                <Alert
                  tone="info"
                  className="bg-amber-500/5 border-amber-500/15 text-amber-300/90 [&_strong]:text-amber-400"
                >
                  <strong>Note:</strong> Your .zip must contain a valid
                  FancyMenu export structure (usually including a{" "}
                  <code className="bg-white/5 px-1 py-0.5 rounded text-[0.7rem]">
                    customization
                  </code>{" "}
                  folder).
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <Button
                    variant="ghost"
                    size="md"
                    className="w-full"
                    onClick={() => bundleUploadRef.current?.click()}
                    icon={
                      <span className="material-symbols-outlined text-[18px]">
                        upload_file
                      </span>
                    }
                  >
                    Upload New Bundle .zip
                  </Button>
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
          </Card>
        ) : null}
      </div>
    </div>
  );
}
