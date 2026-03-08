"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

const toneClasses = {
  online: "text-success-bright bg-success-bg border-success-border",
  busy: "text-warning-bright bg-warning-bg border-warning-border",
  offline: "text-text-muted bg-surface-subtle border-line",
  error: "text-danger-bright bg-danger-bg border-danger-border",
  warning: "text-warning-bright bg-warning-bg border-warning-border",
  info: "text-brand-accent bg-brand-accent/10 border-brand-accent/20",
  neutral: "text-text-secondary bg-surface-subtle border-line",
} as const;

export type BadgeTone = keyof typeof toneClasses;

export interface BadgeProps {
  tone?: BadgeTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  pulse = false,
  children,
  className,
}: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-[10px] py-[4px] text-[0.75rem] font-semibold border",
        toneClasses[tone],
        className,
      )}
    >
      {pulse && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
            tone === "online" && "bg-success",
            (tone === "busy" || tone === "warning") && "bg-warning",
            tone === "error" && "bg-danger-accent",
            tone === "info" && "bg-brand-accent",
            (tone === "offline" || tone === "neutral") && "bg-text-muted",
          )}
        />
      )}
      {children}
    </span>
  );
}
