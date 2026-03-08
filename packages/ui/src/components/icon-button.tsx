"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

const sizeClasses = {
  xs: "w-6 h-6 text-xs rounded-lg",
  sm: "w-8 h-8 text-sm rounded-lg",
  md: "w-9 h-9 text-sm rounded-xl",
  lg: "w-10 h-10 text-base rounded-xl",
} as const;

export type IconButtonSize = keyof typeof sizeClasses;

const base =
  "inline-flex items-center justify-center cursor-pointer border border-white/[0.06] bg-white/5 text-[var(--color-text-secondary)] transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.5] shrink-0 hover:not-disabled:bg-white/10 hover:not-disabled:border-white/[0.12] hover:not-disabled:text-white";

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
