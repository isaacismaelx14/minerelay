"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

export type CompactStatTone = "neutral" | "success" | "danger" | "warning";

const toneMap: Record<CompactStatTone, { value: string; border: string }> = {
  neutral: {
    value: "text-[var(--color-text-primary)]",
    border: "border-white/5",
  },
  success: {
    value: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  danger: {
    value: "text-red-400",
    border: "border-red-500/20",
  },
  warning: {
    value: "text-amber-400",
    border: "border-amber-500/20",
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
        "flex flex-col items-center justify-center p-2 rounded-[var(--radius-md)] border bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:bg-white/[0.04] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] gap-1 overflow-hidden group",
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
      <span className="text-[0.6rem] uppercase tracking-widest text-[var(--color-text-muted)] opacity-80 group-hover:opacity-100 transition-opacity duration-300">
        {label}
      </span>
    </article>
  );
}
