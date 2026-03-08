"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

const sizeClasses = {
  xs: "w-6 h-6 text-xs rounded-[var(--radius-sm)]",
  sm: "w-8 h-8 text-sm rounded-[var(--radius-sm)]",
  md: "w-9 h-9 text-sm rounded-[var(--radius-md)]",
  lg: "w-10 h-10 text-base rounded-[var(--radius-md)]",
} as const;

export type IconButtonSize = keyof typeof sizeClasses;

const base =
  "inline-flex items-center justify-center cursor-pointer border border-line bg-surface-subtle text-text-secondary transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.5] shrink-0 hover:not-disabled:bg-surface-subtle-hover hover:not-disabled:border-line-strong hover:not-disabled:text-white";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ size = "md", icon, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, sizeClasses[size], className)}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
