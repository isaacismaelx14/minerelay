"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface ListRowProps {
  /** Left slot — typically an `<Avatar>`. */
  leading?: ReactNode;
  /** Primary label. */
  title: string;
  /** Inline metadata rendered next to the title (e.g. `<Tag>` elements). */
  meta?: ReactNode;
  /** Secondary text below the title. */
  description?: string;
  /** Right slot — typically action buttons. */
  trailing?: ReactNode;
  className?: string;
}

export function ListRow({
  leading,
  title,
  meta,
  description,
  trailing,
  className,
}: ListRowProps): ReactElement {
  return (
    <div
      className={cn(
        "bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-xl p-4 flex items-center gap-4 hover:border-[var(--color-brand-primary)]/30 transition-colors",
        className,
      )}
    >
      {leading}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold truncate text-[1rem] m-0 leading-none">
            {title}
          </h4>
          {meta}
        </div>
        {description ? (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1 truncate m-0">
            {description}
          </p>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex items-center gap-3 shrink-0">{trailing}</div>
      ) : null}
    </div>
  );
}
