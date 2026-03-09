"use client";

import type { DetailsHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface DetailsProps extends Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  "children"
> {
  summary: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  summaryClassName?: string;
  contentClassName?: string;
  iconClassName?: string;
}

export function Details({
  summary,
  children,
  icon = "▸",
  className,
  summaryClassName,
  contentClassName,
  iconClassName,
  ...rest
}: DetailsProps): ReactElement {
  return (
    <details
      className={cn(
        "group w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-bg-card transition-all duration-200 open:border-brand-primary-shadow open:bg-brand-primary-ring open:shadow-[0_4px_20px_var(--color-brand-primary-shadow-soft)]",
        className,
      )}
      {...rest}
    >
      <summary
        className={cn(
          "flex list-none items-center gap-2.5 bg-surface-soft px-4 py-2.5 text-[0.85rem] font-semibold text-brand-accent transition-all duration-200 select-none cursor-pointer hover:bg-surface-subtle focus-visible:bg-surface-subtle [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "text-[1.1rem] opacity-70 transition-transform duration-200 group-open:rotate-90",
            iconClassName,
          )}
        >
          {icon}
        </span>
        <span>{summary}</span>
      </summary>
      <div
        className={cn(
          "grid gap-(--space-3) border-t border-line px-4 py-3 animate-[fadeIn_0.2s_ease-out]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
