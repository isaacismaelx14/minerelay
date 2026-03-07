"use client";

import { memo, type ReactNode } from "react";

export const DataList = memo(function DataList({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex flex-col gap-[24px]">{children}</div>;
});

export const DataItem = memo(function DataItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <span className="font-mono text-[0.75rem] text-[var(--color-text-muted)] uppercase tracking-[0.15em] font-semibold">
        {label}
      </span>
      <span className="font-mono text-[0.88rem] text-[var(--color-text-primary)] bg-black/25 py-[10px] px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line)] break-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
        {value || "-"}
      </span>
    </div>
  );
});
