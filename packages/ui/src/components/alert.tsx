"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

const tones = {
  error:
    "border-danger-border-strong bg-danger-surface text-danger-soft-text shadow-[0_4px_15px_var(--color-danger-shadow-soft)]",
  hint: "border-success-border-strong bg-success-surface text-success-soft-text",
  info: "border-info-border bg-info-bg text-info-bright",
} as const;

export type AlertTone = keyof typeof tones;

export interface AlertProps {
  tone?: AlertTone;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  icon,
  children,
  className,
}: AlertProps): ReactElement {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-md)] py-3.5 px-4 text-[0.9rem] flex items-start gap-3 leading-relaxed border backdrop-blur-[8px]",
        tones[tone],
        className,
      )}
    >
      {icon && (
        <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
          {icon}
        </span>
      )}
      <div>{children}</div>
    </div>
  );
}
