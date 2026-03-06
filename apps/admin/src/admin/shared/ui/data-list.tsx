"use client";

import { memo, type ReactNode } from "react";

export const DataList = memo(function DataList({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="data-list">{children}</div>;
});

export const DataItem = memo(function DataItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="data-item">
      <span className="data-label">{label}</span>
      <span className="data-value">{value || "-"}</span>
    </div>
  );
});
