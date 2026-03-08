"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

export interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-[var(--radius-md)] border border-line bg-surface-deep-10 gap-3",
        className,
      )}
    >
      <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center border border-line mb-2 shadow-inner">
        <span className="material-symbols-outlined text-[32px] text-text-muted">
          {icon}
        </span>
      </div>
      <div className="flex flex-col gap-1 items-center">
        <h4 className="m-0 text-base font-bold text-text-primary">{title}</h4>
        <p className="m-0 text-[13px] text-text-muted max-w-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
