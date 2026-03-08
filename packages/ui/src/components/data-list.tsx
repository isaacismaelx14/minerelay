"use client";

import { memo, type ReactNode } from "react";

export interface DataListProps {
  children: ReactNode;
}

export const DataList = memo(function DataList({ children }: DataListProps) {
  return <div className="flex flex-col gap-[24px]">{children}</div>;
});

export interface DataItemProps {
  label: string;
  value: string | number;
}

export const DataItem = memo(function DataItem({
  label,
  value,
}: DataItemProps) {
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
