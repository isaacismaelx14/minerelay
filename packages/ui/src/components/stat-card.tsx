"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

const toneClasses = {
  emerald: {
    bg: "from-emerald-500/10 to-emerald-500/0",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/10",
  },
  red: {
    bg: "from-red-500/10 to-red-500/0",
    text: "text-red-400",
    border: "border-red-500/30",
    glow: "shadow-red-500/10",
  },
  amber: {
    bg: "from-amber-500/10 to-amber-500/0",
    text: "text-amber-400",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/10",
  },
  indigo: {
    bg: "from-indigo-500/10 to-indigo-500/0",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    glow: "shadow-indigo-500/10",
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
        `bg-gradient-to-br ${classes.bg}`,
        classes.glow,
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          `bg-gradient-to-br ${classes.bg}`,
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
