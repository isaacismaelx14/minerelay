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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-sky-400 text-[18px]">
              extension
            </span>
          </div>
          <h3 className="m-0 text-base font-semibold text-white">
            Recent Mods
          </h3>
          <span className="text-xs text-[var(--color-text-muted)] bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">
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
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
          >
            <Avatar src={mod.iconUrl} fallback="M" size="sm" />
            <span className="text-sm font-medium text-white truncate flex-1">
              {mod.name}
            </span>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-black/20 px-2 py-0.5 rounded border border-white/[0.04] shrink-0 uppercase tracking-wider max-w-[100px] truncate">
              {mod.version}
            </span>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <button
            className="text-xs text-[var(--color-text-muted)] hover:text-white mt-1 py-2 text-center rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer border-none bg-transparent"
            onClick={onViewAll}
          >
            +{hiddenCount} more mods...
          </button>
        ) : null}
      </div>
    </div>
  );
}
