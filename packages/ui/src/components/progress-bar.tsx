"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

export interface ProgressBarProps {
  /** 0 – 100 */
  value?: number;
  indeterminate?: boolean;
  className?: string;
}

export function ProgressBar({
  value = 0,
  indeterminate = false,
  className,
}: ProgressBarProps): ReactElement {
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 rounded-full bg-surface-deep-40 overflow-hidden relative shadow-[inset_0_1px_2px_var(--color-shadow-xl)]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-primary),var(--color-brand-accent))] shadow-[0_0_10px_var(--color-brand-primary)] relative",
          "after:content-[''] after:absolute after:inset-0 after:bg-[linear-gradient(90deg,transparent,var(--color-surface-white-shine),transparent)] after:animate-[meterShine_2s_infinite_linear]",
          indeterminate
            ? "!w-1/2 animate-[meterIndeterminate_1.5s_ease-in-out_infinite]"
            : "transition-[width] duration-400 ease-[cubic-bezier(0.1,0.8,0.2,1)]",
        )}
        style={
          indeterminate
            ? undefined
            : { width: `${Math.min(100, Math.max(0, value))}%` }
        }
      />
    </div>
  );
}
