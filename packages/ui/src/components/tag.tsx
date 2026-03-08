"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface TagProps {
  children: ReactNode;
  className?: string;
}

export function Tag({ children, className }: TagProps): ReactElement {
  return (
    <span
      className={cn(
        "text-[10px] bg-black/20 border border-[var(--color-line)] px-1.5 py-0.5 rounded text-[var(--color-text-muted)] uppercase font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
