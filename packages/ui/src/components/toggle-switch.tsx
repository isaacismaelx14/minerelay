"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

export interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({
  enabled,
  onChange,
  disabled,
  className,
}: ToggleSwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
        enabled
          ? "bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)]/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
          : "bg-white/10 border-white/[0.08]",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-[20px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
