"use client";

import { Button, DiscoverItemCard, DiscoverModal, ui } from "@minerelay/ui";
import Image from "next/image";
import React from "react";

import type { SearchResult } from "@/admin/client/types";

type AssetType = "resourcepack" | "shaderpack";

export function PopularAssetModal({
  type,
  popular,
  loading,
  installingId,
  searchQuery,
  onSearch,
  onClose,
  onInstall,
  installedModProjectIds,
  installedAssetProjectIds,
}: {
  type: AssetType;
  popular: SearchResult[];
  loading: boolean;
  installingId: string | null;
  searchQuery: string;
  onSearch: (query: string) => void;
  onClose: () => void;
  onInstall: (projectId: string) => Promise<void>;
  installedModProjectIds: Set<string>;
  installedAssetProjectIds: Set<string>;
}) {
  const title = type === "resourcepack" ? "Add Resourcepack" : "Add Shaderpack";
  const [localQuery, setLocalQuery] = React.useState(searchQuery);
  const triggerSearch = React.useEffectEvent(onSearch);
  const lastSubmittedRef = React.useRef(searchQuery);

  React.useEffect(() => {
    setLocalQuery(searchQuery);
    lastSubmittedRef.current = searchQuery;
  }, [searchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (lastSubmittedRef.current === localQuery) return;
      lastSubmittedRef.current = localQuery;
      triggerSearch(localQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [localQuery]);

  return (
    <DiscoverModal
      title={title}
      icon={type === "resourcepack" ? "texture" : "gradient"}
      searchPlaceholder={`Search ${type === "resourcepack" ? "resourcepacks" : "shaderpacks"} on Modrinth...`}
      searchQuery={localQuery}
      onSearchQueryChange={setLocalQuery}
      onClose={onClose}
    >
      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold flex items-center gap-2 m-0">
            <span className="material-symbols-outlined text-[var(--color-text-muted)]">
              {searchQuery ? "search" : "explore"}
            </span>
            {searchQuery
              ? `Search Results for \"${searchQuery}\"`
              : "Top 12 Popular on Modrinth"}
          </h3>
        </div>
        {loading ? (
          <p className={ui.hint}>Loading...</p>
        ) : popular.length === 0 ? (
          <p className={ui.hint}>No items found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popular.map((entry) => {
              const normalizedProjectId = entry.projectId.trim();
              const installedAsAsset =
                installedAssetProjectIds.has(normalizedProjectId);
              const installedAsMod =
                installedModProjectIds.has(normalizedProjectId);

              const isInstalling = installingId === entry.projectId;

              return (
                <DiscoverItemCard
                  key={entry.projectId}
                  media={
                    <div className="w-14 h-14 bg-black/20 rounded-xl flex items-center justify-center border border-[var(--color-line)] shrink-0 overflow-hidden">
                      {entry.iconUrl ? (
                        <Image
                          src={entry.iconUrl}
                          alt=""
                          width={56}
                          height={56}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[32px] text-[var(--color-text-muted)]">
                          {type === "resourcepack" ? "texture" : "gradient"}
                        </span>
                      )}
                    </div>
                  }
                  idLabel={
                    <>
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                        ID
                      </span>
                      <span
                        className="text-xs font-medium max-w-[80px] truncate"
                        title={entry.projectId}
                      >
                        {entry.projectId}
                      </span>
                    </>
                  }
                  title={entry.title}
                  description={entry.description}
                  footerLabel="Author"
                  footerValue={entry.author}
                  actionButton={
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-[var(--color-brand-primary)] border-transparent bg-[var(--color-brand-primary)]/10 hover:bg-[var(--color-brand-primary)] hover:text-white"
                      disabled={
                        isInstalling || installedAsAsset || installedAsMod
                      }
                      onClick={() => void onInstall(entry.projectId)}
                    >
                      {isInstalling
                        ? "Installing..."
                        : installedAsAsset
                          ? "Installed"
                          : installedAsMod
                            ? "Installed as Mod"
                            : "Install"}
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </DiscoverModal>
  );
}
