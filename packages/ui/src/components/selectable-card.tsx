"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface SelectableCardProps {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  headerRight?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function SelectableCard({
  selected,
  onClick,
  disabled,
  icon,
  headerRight,
  title,
  description,
  children,
  className,
}: SelectableCardProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[var(--radius-md)] border p-4 text-left cursor-pointer transition-all duration-200 flex flex-col gap-2",
        selected
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
          : "border-[var(--color-line)] bg-black/20 hover:bg-black/30 hover:border-[var(--color-line-strong)]",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-sm font-semibold text-white truncate">
            {title}
          </span>
        </div>
        {headerRight}
      </div>
      {description ? (
        <p className="m-0 text-xs text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      ) : null}
      {children}
    </button>
  );
}
