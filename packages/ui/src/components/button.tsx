"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

/* ------------------------------------------------------------------ */
/*  Variant / size token maps                                         */
/* ------------------------------------------------------------------ */

const variantClasses = {
  primary:
    "bg-[var(--color-brand-primary)] text-white border-white/15 shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] hover:not-disabled:brightness-110 hover:not-disabled:shadow-[0_2px_12px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 active:not-disabled:shadow-[0_0px_4px_rgba(99,102,241,0.2),inset_0_1px_3px_rgba(0,0,0,0.2)]",
  ghost:
    "bg-white/5 text-[var(--color-text-secondary)] border-white/[0.06] backdrop-blur-sm hover:not-disabled:bg-white/10 hover:not-disabled:border-white/[0.12] hover:not-disabled:text-white",
  outline:
    "bg-white/[0.03] text-[var(--color-text-secondary)] border-white/[0.06] hover:not-disabled:bg-white/[0.07] hover:not-disabled:border-white/[0.12] hover:not-disabled:text-white",
  danger:
    "bg-[#e11d48]/10 text-[#f43f5e] border-[#e11d48]/40 backdrop-blur-sm hover:not-disabled:bg-[#e11d48]/20 hover:not-disabled:text-white hover:not-disabled:border-[#e11d48]/60",
  "danger-ghost":
    "bg-red-500/5 text-red-400/80 border-red-500/10 hover:not-disabled:bg-red-500/10 hover:not-disabled:text-red-400 hover:not-disabled:border-red-500/20",
  warn: "bg-white/[0.03] text-[var(--color-text-muted)] border-white/[0.06] hover:not-disabled:text-amber-400 hover:not-disabled:bg-amber-500/10 hover:not-disabled:border-amber-500/20",
  success:
    "bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-500/20 hover:not-disabled:bg-indigo-400 hover:not-disabled:shadow-indigo-500/30",
  flat: "bg-transparent text-[var(--color-text-primary)] border-transparent hover:not-disabled:text-white",
  link: "bg-transparent text-[var(--color-brand-primary)] border-transparent p-0 hover:not-disabled:underline",
} as const;

const sizeClasses = {
  xs: "text-xs px-2.5 py-1 rounded-[var(--radius-sm)] gap-1.5",
  sm: "text-sm px-3 py-1.5 rounded-[var(--radius-sm)] gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-[var(--radius-md)] gap-2",
  lg: "text-[0.9rem] px-5 py-3 rounded-[var(--radius-md)] gap-2",
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

/* ------------------------------------------------------------------ */
/*  Base classes shared by every button                                */
/* ------------------------------------------------------------------ */

const base =
  "inline-flex items-center justify-center font-semibold cursor-pointer border transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.5] shrink-0";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "ghost",
      size = "md",
      icon,
      iconRight,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          base,
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...rest}
      >
        {icon}
        {children}
        {iconRight}
      </button>
    );
  },
);
