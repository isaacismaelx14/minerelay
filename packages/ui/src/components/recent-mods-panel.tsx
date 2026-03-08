"use client";

import type { ReactElement } from "react";
import { Avatar } from "./avatar";
import { Button } from "./button";

export interface RecentModItem {
  key: string;
  name: string;
  version: string;
  iconUrl?: string;
}

export interface RecentModsPanelProps {
  items: RecentModItem[];
  totalCount: number;
  onViewAll: () => void;
}

export function RecentModsPanel({
  items,
  totalCount,
  onViewAll,
}: RecentModsPanelProps): ReactElement {
  const hiddenCount = Math.max(totalCount - items.length, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface-soft p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-info-tint border border-info-border-soft flex items-center justify-center">
            <span className="material-symbols-outlined text-info-bright text-[18px]">
              extension
            </span>
          </div>
          <h3 className="m-0 text-base font-semibold text-white">
            Recent Mods
          </h3>
          <span className="text-xs text-text-muted bg-surface-subtle px-2 py-0.5 rounded-full border border-line">
            {totalCount} total
          </span>
        </div>
        <Button variant="outline" size="xs" onClick={onViewAll}>
          View All
        </Button>
      </div>
      <div className="grid gap-2">
        {items.map((mod) => (
          <div
            key={mod.key}
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-line-subtle bg-surface-soft hover:bg-surface-subtle transition-colors"
          >
            <Avatar src={mod.iconUrl} fallback="M" size="sm" />
            <span className="text-sm font-medium text-white truncate flex-1">
              {mod.name}
            </span>
            <span className="text-[10px] font-mono text-text-muted bg-surface-deep-20 px-2 py-0.5 rounded border border-line-subtle shrink-0 uppercase tracking-wider max-w-[100px] truncate">
              {mod.version}
            </span>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <button
            className="text-xs text-text-muted hover:text-white mt-1 py-2 text-center rounded-lg hover:bg-surface-soft-hover transition-colors cursor-pointer border-none bg-transparent"
            onClick={onViewAll}
          >
            +{hiddenCount} more mods...
          </button>
        ) : null}
      </div>
    </div>
  );
}
