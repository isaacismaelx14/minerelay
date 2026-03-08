"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

/* ------------------------------------------------------------------ */
/*  Variant / size token maps                                         */
/* ------------------------------------------------------------------ */

const variantClasses = {
  primary:
    "bg-brand-primary text-white border-line-emphasis shadow-[0_1px_2px_var(--color-surface-deep-30),inset_0_1px_0_var(--color-line-strong)] hover:not-disabled:brightness-110 hover:not-disabled:shadow-[0_2px_12px_var(--color-brand-primary-shadow-hover),inset_0_1px_0_var(--color-line-emphasis)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 active:not-disabled:shadow-[0_0px_4px_var(--color-brand-primary-shadow-soft),inset_0_1px_3px_var(--color-shadow-md)]",
  ghost:
    "bg-surface-subtle text-text-secondary border-line backdrop-blur-sm hover:not-disabled:bg-surface-subtle-hover hover:not-disabled:border-line-strong hover:not-disabled:text-white",
  outline:
    "bg-surface-soft text-text-secondary border-line hover:not-disabled:bg-surface-subtle hover:not-disabled:border-line-strong hover:not-disabled:text-white",
  danger:
    "bg-danger-bg text-danger-text border-danger-border-strong backdrop-blur-sm hover:not-disabled:bg-danger-bg-strong hover:not-disabled:text-white hover:not-disabled:border-danger-border-heavy",
  "danger-ghost":
    "bg-danger-bg text-danger-bright border-danger-border hover:not-disabled:bg-danger-bg-strong hover:not-disabled:text-danger-bright hover:not-disabled:border-danger-border-strong",
  warn: "bg-surface-soft text-text-muted border-line hover:not-disabled:text-warning-bright hover:not-disabled:bg-warning-bg hover:not-disabled:border-warning-border",
  success:
    "bg-success text-white border-transparent shadow-[0_8px_24px_var(--color-success-border)] hover:not-disabled:bg-success-bright hover:not-disabled:shadow-[0_10px_28px_var(--color-success-border-strong)]",
  flat: "bg-transparent text-text-primary border-transparent hover:not-disabled:text-white",
  link: "bg-transparent text-brand-primary border-transparent p-0 hover:not-disabled:underline",
} as const;

const effectClasses = {
  default: "",
  glass:
    "relative overflow-hidden after:pointer-events-none after:absolute after:top-0 after:bottom-0 after:left-[-120%] after:w-1/2 after:skew-x-[-20deg] after:bg-[linear-gradient(90deg,transparent,var(--color-glass-shine),transparent)] after:content-[''] after:transition-[left] after:duration-500 hover:not-disabled:after:left-[140%]",
} as const;

const sizeClasses = {
  xs: "text-xs px-2.5 py-1 rounded-[var(--radius-sm)] gap-1.5",
  sm: "text-sm px-3 py-1.5 rounded-[var(--radius-sm)] gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-[var(--radius-md)] gap-2",
  lg: "text-[0.9rem] px-5 py-3 rounded-[var(--radius-md)] gap-2",
} as const;

type CoreButtonVariant = keyof typeof variantClasses;

export type ButtonVariant = CoreButtonVariant | "glass";
export type ButtonSize = keyof typeof sizeClasses;
export type ButtonEffect = keyof typeof effectClasses;

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
  effect?: ButtonEffect;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "ghost",
      size = "md",
      effect = "default",
      icon,
      iconRight,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const resolvedVariant: CoreButtonVariant =
      variant === "glass" ? "ghost" : variant;
    const resolvedEffect = variant === "glass" ? "glass" : effect;

    return (
      <button
        ref={ref}
        className={cn(
          base,
          variantClasses[resolvedVariant],
          effectClasses[resolvedEffect],
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
