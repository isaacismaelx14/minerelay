"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

const toneClasses = {
  online: "text-[#34d399] bg-[#10b981]/10 border-[#10b981]/20",
  busy: "text-[#fbbf24] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  offline:
    "text-[var(--color-text-muted)] bg-white/5 border-[var(--color-line)]",
  error: "text-[#fb7185] bg-[#e11d48]/10 border-[#e11d48]/20",
  warning: "text-[#fbbf24] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  info: "text-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/10 border-[var(--color-brand-accent)]/20",
  neutral:
    "text-[var(--color-text-secondary)] bg-white/5 border-[var(--color-line)]",
} as const;

export type BadgeTone = keyof typeof toneClasses;

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[10px] py-[4px] text-[0.75rem] font-semibold border",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
