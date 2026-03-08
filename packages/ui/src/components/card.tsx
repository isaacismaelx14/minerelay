"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { cn } from "../cn";

export interface CardProps {
  className?: string;
  hoverable?: boolean;
}

export function Card({
  children,
  className,
  hoverable,
}: PropsWithChildren<CardProps>): ReactElement {
  return (
    <article
      className={cn(
        "bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 relative overflow-hidden",
        /* Top gradient line (from launcher panel-card) */
        "before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)]",
        hoverable &&
          "hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {children}
    </article>
  );
}
