"use client";

import type { ReactElement } from "react";

export interface InfoRowProps {
  label: string;
  value: string | number;
  highlight?: "success" | "warning";
}

export function InfoRow({
  label,
  value,
  highlight,
}: InfoRowProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg bg-surface-deep-15 border border-line-subtle">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
        {label}
      </span>
      <span
        className={`text-sm font-medium truncate text-right ${
          highlight === "success"
            ? "text-success-bright"
            : highlight === "warning"
              ? "text-warning-bright"
              : "text-text-primary"
        }`}
      >
        {value || "-"}
      </span>
    </div>
  );
}
