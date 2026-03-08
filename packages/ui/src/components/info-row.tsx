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
    <div className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg bg-black/15 border border-white/[0.04]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
        {label}
      </span>
      <span
        className={`text-sm font-medium truncate text-right ${
          highlight === "success"
            ? "text-emerald-400"
            : highlight === "warning"
              ? "text-amber-400"
              : "text-[var(--color-text-primary)]"
        }`}
      >
        {value || "-"}
      </span>
    </div>
  );
}
