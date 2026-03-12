"use client";

import { useRef } from "react";
import Image from "next/image";
import { Button, TextInput } from "@minerelay/ui";

type Props = {
  displayName: string;
  serverAddress: string;
  logoPreview: string;
  bgPreview: string;
  isSubmitting: boolean;
  onDisplayNameChange: (value: string) => void;
  onServerAddressChange: (value: string) => void;
  onLogoChange: (file: File | null) => void;
  onBgChange: (file: File | null) => void;
  onBack: () => void;
  onComplete: () => void;
};

function ImageUploadArea({
  label,
  hint,
  preview,
  onChange,
  aspectRatio,
}: {
  label: string;
  hint: string;
  preview: string;
  onChange: (file: File | null) => void;
  aspectRatio: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}{" "}
        <span className="text-[var(--color-text-muted)] font-normal normal-case">
          (optional)
        </span>
      </label>
      <div
        className={`group relative rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-line-soft)] bg-[var(--color-bg-surface-elevated)] overflow-hidden cursor-pointer hover:bg-[var(--color-brand-primary)]/5 hover:border-[var(--color-brand-primary)] hover:shadow-sm transition-all duration-300 ${aspectRatio}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
        }
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
      >
        {preview ? (
          <Image
            src={preview}
            alt={label}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6px] text-[var(--color-text-muted)] transition-all duration-300 group-hover:scale-105 group-hover:text-[var(--color-brand-primary)]">
            <span className="material-symbols-outlined text-[28px] transition-transform duration-300 group-hover:-translate-y-1">
              upload
            </span>
            <span className="text-[0.75rem] font-medium">{hint}</span>
          </div>
        )}
        {preview && (
          <button
            type="button"
            className="absolute top-[6px] right-[6px] rounded-full bg-black/60 p-[4px] text-white hover:bg-black/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            aria-label="Remove image"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export function StepIdentity({
  displayName,
  serverAddress,
  logoPreview,
  bgPreview,
  isSubmitting,
  onDisplayNameChange,
  onServerAddressChange,
  onLogoChange,
  onBgChange,
  onBack,
  onComplete,
}: Props) {
  const isValid = displayName.trim().length > 0;

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[8px]">
        <h2 className="text-[1.5rem] font-bold tracking-tight text-[var(--color-text-primary)]">
          Set up your server
        </h2>
        <p className="text-[0.9375rem] text-[var(--color-text-secondary)] leading-relaxed">
          Give your server a name and optionally provide an address and branding
          assets.
        </p>
      </div>

      <div className="flex flex-col gap-[16px]">
        <TextInput
          label="Display Name"
          name="displayName"
          value={displayName}
          placeholder="My Minecraft Server"
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />

        <TextInput
          label="Server Address (optional)"
          name="serverAddress"
          value={serverAddress}
          placeholder="play.example.com"
          onChange={(e) => onServerAddressChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-[16px] pt-2">
        <h3 className="text-[1.125rem] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Branding
        </h3>
        <div className="grid grid-cols-2 gap-[16px]">
          <ImageUploadArea
            label="Logo"
            hint="PNG, JPG or WebP"
            preview={logoPreview}
            onChange={onLogoChange}
            aspectRatio="h-[96px]"
          />
          <ImageUploadArea
            label="Background Wallpaper"
            hint="PNG, JPG or WebP"
            preview={bgPreview}
            onChange={onBgChange}
            aspectRatio="h-[96px]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-[8px]">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={!isValid || isSubmitting}
          onClick={onComplete}
        >
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
              Setting up…
            </>
          ) : (
            <>
              Complete Setup
              <span className="material-symbols-outlined text-[18px]">
                check
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
