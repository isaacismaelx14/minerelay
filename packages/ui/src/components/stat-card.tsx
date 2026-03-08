"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

const toneClasses = {
  emerald: {
    bg: "bg-[linear-gradient(135deg,var(--color-success-bg),transparent)]",
    text: "text-success-bright",
    border: "border-success-border-strong",
    glow: "shadow-[0_10px_30px_var(--color-success-shadow-soft)]",
  },
  red: {
    bg: "bg-[linear-gradient(135deg,var(--color-danger-bg),transparent)]",
    text: "text-danger-bright",
    border: "border-danger-border-strong",
    glow: "shadow-[0_10px_30px_var(--color-danger-shadow-soft)]",
  },
  amber: {
    bg: "bg-[linear-gradient(135deg,var(--color-warning-bg),transparent)]",
    text: "text-warning-bright",
    border: "border-warning-border-strong",
    glow: "shadow-[0_10px_30px_var(--color-warning-shadow-soft)]",
  },
  indigo: {
    bg: "bg-[linear-gradient(135deg,var(--color-brand-indigo-bg),transparent)]",
    text: "text-brand-indigo",
    border: "border-brand-indigo-border",
    glow: "shadow-[0_10px_30px_var(--color-brand-indigo-shadow)]",
  },
} as const;

export type StatCardTone = keyof typeof toneClasses;

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  tone: StatCardTone;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  tone,
  className,
}: StatCardProps): ReactElement {
  const classes = toneClasses[tone];

  return (
    <div
      className={cn(
        "relative group rounded-2xl border p-5 flex flex-col items-center gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg overflow-hidden",
        classes.border,
        classes.bg,
        classes.glow,
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          classes.bg,
        )}
      />
      <div className="relative flex items-center gap-2">
        <span
          className={cn(
            "material-symbols-outlined text-[22px] opacity-70",
            classes.text,
          )}
        >
          {icon}
        </span>
        <span className="text-[2.2rem] font-bold leading-none tracking-tight text-white font-mono tabular-nums">
          {value}
        </span>
      </div>
      <span
        className={cn(
          "relative text-xs font-semibold uppercase tracking-widest opacity-80",
          classes.text,
        )}
      >
        {label}
      </span>
    </div>
  );
}
