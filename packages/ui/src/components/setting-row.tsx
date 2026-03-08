"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface SettingRowProps {
  title: string;
  description: string;
  control: ReactNode;
  className?: string;
}

export function SettingRow({
  title,
  description,
  control,
  className,
}: SettingRowProps): ReactElement {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface-deep-20 p-4 mt-1",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <span className="text-xs text-text-muted">{description}</span>
      </div>
      {control}
    </div>
  );
}
