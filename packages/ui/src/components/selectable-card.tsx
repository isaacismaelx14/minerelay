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
          ? "border-brand-primary bg-success-bg shadow-[0_0_0_1px_var(--color-success-border)]"
          : "border-line bg-surface-deep-20 hover:bg-surface-deep-30 hover:border-line-strong",
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
        <p className="m-0 text-xs text-text-muted leading-relaxed">
          {description}
        </p>
      ) : null}
      {children}
    </button>
  );
}
