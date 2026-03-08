"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

export type CompactStatTone = "neutral" | "success" | "danger" | "warning";

const toneMap: Record<CompactStatTone, { value: string; border: string }> = {
  neutral: {
    value: "text-text-primary",
    border: "border-line-soft",
  },
  success: {
    value: "text-success-bright",
    border: "border-success-border",
  },
  danger: {
    value: "text-danger-bright",
    border: "border-danger-border",
  },
  warning: {
    value: "text-warning-bright",
    border: "border-warning-border",
  },
};

export interface CompactStatProps {
  label: string;
  value: string | number;
  tone?: CompactStatTone;
  className?: string;
}

export function CompactStat({
  label,
  value,
  tone = "neutral",
  className,
}: CompactStatProps): ReactElement {
  const { value: valueClass, border } = toneMap[tone];
  return (
    <article
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-[var(--radius-md)] border bg-surface-soft backdrop-blur-md transition-all duration-300 hover:bg-surface-soft-hover hover:shadow-[0_4px_12px_var(--color-shadow-soft)] gap-1 overflow-hidden group",
        border,
        className,
      )}
    >
      <strong
        className={cn(
          "text-sm font-bold tabular-nums tracking-tight group-hover:scale-105 transition-transform duration-300",
          valueClass,
        )}
      >
        {value}
      </strong>
      <span className="text-[0.6rem] uppercase tracking-widest text-text-muted opacity-80 group-hover:opacity-100 transition-opacity duration-300">
        {label}
      </span>
    </article>
  );
}
