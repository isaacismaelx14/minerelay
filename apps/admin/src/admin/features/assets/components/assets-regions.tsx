"use client";

import { Avatar, Button, EmptyState, ListRow, Tag } from "@minerelay/ui";
import type {
  AdminMod,
  AdminResourcePack,
  AdminShaderPack,
} from "@/admin/client/types";

export const DRAFT_OVERLAY = (
  <span className="absolute -top-2 -right-2 z-20 rounded-full bg-[#f59e0b] px-2 py-0.5 text-[9px] font-bold text-white shadow-lg">
    DRAFT
  </span>
);

export function ModsRegion({
  selectedMods,
  publishedModKeys,
  onOpenModsManager,
}: {
  selectedMods: AdminMod[];
  publishedModKeys: Set<string>;
  onOpenModsManager: () => void;
}) {
  const modPreview = selectedMods.slice(0, 6);
  const hiddenMods = Math.max(selectedMods.length - modPreview.length, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2 m-0">
          <span className="material-symbols-outlined text-[var(--color-brand-primary)]">
            package
          </span>
          Mods
          <span className="bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 text-[var(--color-brand-primary)] px-2 py-0.5 rounded text-xs ml-2">
            {selectedMods.length} Installed
          </span>
        </h3>
        <Button variant="link" size="sm" onClick={onOpenModsManager}>
          Open Mods Manager
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {modPreview.length === 0 ? (
          <EmptyState
            title="No mods loaded"
            description="Your server is currently vanilla. Add mods to enhance your gameplay experience."
            icon="package_2"
          />
        ) : (
          modPreview.map((entry) => (
            <ListRow
              key={`${entry.projectId ?? entry.sha256}-${entry.versionId ?? "latest"}`}
              leading={
                <Avatar
                  src={entry.iconUrl}
                  fallback="M"
                  overlay={
                    !publishedModKeys.has(entry.projectId ?? entry.sha256)
                      ? DRAFT_OVERLAY
                      : undefined
                  }
                />
              }
              title={entry.name}
              meta={
                <Tag>
                  {entry.side === "both" ? "user + server" : entry.side}
                </Tag>
              }
              description={entry.slug ?? "Managed mod"}
              trailing={
                <Button variant="outline" size="xs" onClick={onOpenModsManager}>
                  Managed in Mods Manager
                </Button>
              }
            />
          ))
        )}

        {hiddenMods > 0 ? (
          <button
            type="button"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] font-bold text-sm flex items-center justify-center gap-1 w-full mt-2 cursor-pointer bg-transparent border-none"
            onClick={onOpenModsManager}
          >
            View {hiddenMods} more mod(s)
            <span className="material-symbols-outlined text-[16px]">
              expand_more
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function AssetRegion({
  title,
  icon,
  iconClassName,
  installedClassName,
  count,
  addLabel,
  onAdd,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  entries,
  publishedKeys,
  fallbackLetter,
  defaultTag,
  onRemove,
}: {
  title: string;
  icon: string;
  iconClassName: string;
  installedClassName: string;
  count: number;
  addLabel: string;
  onAdd: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: string;
  entries: Array<AdminResourcePack | AdminShaderPack>;
  publishedKeys: Set<string>;
  fallbackLetter: string;
  defaultTag: string;
  onRemove: (projectId?: string, sha256?: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2 m-0">
          <span className={`material-symbols-outlined ${iconClassName}`}>
            {icon}
          </span>
          {title}
          <span
            className={`${installedClassName} px-2 py-0.5 rounded text-xs ml-2`}
          >
            {count} Installed
          </span>
        </h3>
        <Button variant="link" size="sm" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {entries.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon}
          />
        ) : (
          entries.map((entry) => (
            <ListRow
              key={entry.sha256}
              leading={
                <Avatar
                  src={entry.iconUrl}
                  fallback={fallbackLetter}
                  overlay={
                    !publishedKeys.has(entry.projectId ?? entry.sha256)
                      ? DRAFT_OVERLAY
                      : undefined
                  }
                />
              }
              title={entry.name}
              meta={<Tag>{entry.slug ?? entry.projectId ?? defaultTag}</Tag>}
              trailing={
                <Button
                  variant="danger-ghost"
                  size="xs"
                  onClick={() => onRemove(entry.projectId, entry.sha256)}
                >
                  Remove
                </Button>
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
