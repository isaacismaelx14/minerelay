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
        "bg-bg-card border border-line rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150",
        hoverable &&
          "hover:bg-bg-card-hover hover:border-line-strong hover:-translate-y-[2px] hover:shadow-[0_8px_20px_var(--color-shadow-md)]",
        className,
      )}
    >
      {children}
    </article>
  );
}
