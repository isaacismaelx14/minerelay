"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  description,
  className,
}: SectionHeaderProps): ReactElement {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="shrink-0 mt-0.5 w-9 h-9 rounded-[var(--radius-sm)] bg-brand-primary/10 border border-brand-primary/20 grid place-items-center text-brand-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-tight tracking-tight m-0">
          {title}
        </h3>
        <p className="m-0 mt-1 text-sm text-text-muted leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
}
