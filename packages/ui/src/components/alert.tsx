"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

const tones = {
  error:
    "border-red-500/30 bg-[rgba(127,29,29,0.2)] text-red-300 shadow-[0_4px_15px_rgba(239,68,68,0.1)]",
  hint: "border-emerald-500/30 bg-[rgba(6,78,59,0.2)] text-emerald-300",
  info: "border-sky-500/30 bg-[rgba(12,74,110,0.2)] text-sky-300",
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
        "rounded-xl py-3.5 px-4 text-[0.9rem] flex items-start gap-3 leading-relaxed border backdrop-blur-[8px]",
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
