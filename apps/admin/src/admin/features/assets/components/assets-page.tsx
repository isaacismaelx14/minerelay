"use client";

import { DiscoverModal } from "@/admin/shared/ui/discover-modal";
import React from "react";
import { EmptyState } from "@/admin/shared/ui/empty-state";
import { statusClass } from "@/admin/shared/ui/status";
import { ui } from "@/admin/shared/ui/styles";

import { useAssetsPageModel } from "../hooks/use-assets-page-model";

const MODRINTH_FALLBACK_ICON_URL = "https://modrinth.com/favicon.ico";

function makeDraftKeySet(
  baseline: Array<{ projectId?: string; sha256: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const entry of baseline) {
    keys.add(entry.projectId ?? entry.sha256);
  }
  return keys;
}

function InstalledRow({
  iconUrl,
  name,
  fallback,
  tag1,
  tag2,
  description,
  rightActions,
  isDraft,
}: {
  iconUrl?: string;
  name: string;
  fallback: string;
  tag1?: string;
  tag2?: string;
  description?: string;
  rightActions: React.ReactNode;
  isDraft?: boolean;
}) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-xl p-4 flex items-center gap-4 hover:border-[var(--color-brand-primary)]/30 transition-colors">
      <div className="relative shrink-0 overflow-visible">
        {isDraft ? (
          <span className="absolute -top-2 -right-2 z-20 rounded-full bg-[#f59e0b] px-2 py-0.5 text-[9px] font-bold text-white shadow-lg">
            DRAFT
          </span>
        ) : null}
        <div className="w-12 h-12 bg-black/20 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] border border-[var(--color-line)] shrink-0 overflow-hidden">
          <img
            src={iconUrl || MODRINTH_FALLBACK_ICON_URL}
            alt=""
            className="w-full h-full object-cover"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackApplied === "true") {
                image.style.display = "none";
                image.nextElementSibling?.classList.remove("hidden");
                return;
              }
              image.dataset.fallbackApplied = "true";
              image.src = MODRINTH_FALLBACK_ICON_URL;
            }}
          />
          <span className="font-bold text-xl hidden">{fallback}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold truncate text-[1rem] m-0 leading-none">
            {name}
          </h4>
          {tag1 ? (
            <span className="text-[10px] bg-black/20 border border-[var(--color-line)] px-1.5 py-0.5 rounded text-[var(--color-text-muted)] uppercase font-semibold">
              {tag1}
            </span>
          ) : null}
          {tag2 ? (
            <span className="text-[10px] bg-black/20 border border-[var(--color-line)] px-1.5 py-0.5 rounded text-[var(--color-text-muted)] uppercase font-semibold">
              {tag2}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1 truncate m-0">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">{rightActions}</div>
    </div>
  );
}

function PopularAssetModal({
  type,
  popular,
  loading,
  installingId,
  searchQuery,
  onSearch,
  onClose,
  onInstall,
}: {
  type: "resourcepack" | "shaderpack";
  popular: Array<{
    projectId: string;
    title: string;
    author: string;
    description: string;
    iconUrl?: string;
  }>;
  loading: boolean;
  installingId: string | null;
  searchQuery: string;
  onSearch: (query: string) => void;
  onClose: () => void;
  onInstall: (projectId: string) => Promise<void>;
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
              ? `Search Results for "${searchQuery}"`
              : "Top 12 Popular on Modrinth"}
          </h3>
        </div>
        {loading ? (
          <p className={ui.hint}>Loading...</p>
        ) : popular.length === 0 ? (
          <p className={ui.hint}>No items found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popular.map((entry) => (
              <div
                key={entry.projectId}
                className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-xl p-5 flex flex-col gap-4 hover:border-[var(--color-brand-primary)]/50 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 bg-black/20 rounded-xl flex items-center justify-center border border-[var(--color-line)] shrink-0 overflow-hidden">
                    {entry.iconUrl ? (
                      <img
                        src={entry.iconUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[32px] text-[var(--color-text-muted)]">
                        {type === "resourcepack" ? "texture" : "gradient"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                      ID
                    </span>
                    <span
                      className="text-xs font-medium max-w-[80px] truncate"
                      title={entry.projectId}
                    >
                      {entry.projectId}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg group-hover:text-[var(--color-brand-primary)] transition-colors line-clamp-1 m-0">
                    {entry.title}
                  </h4>
                  <p
                    className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-1 m-0"
                    title={entry.description}
                  >
                    {entry.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-[var(--color-line)]">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                      Author
                    </span>
                    <span className="text-xs font-medium truncate">
                      {entry.author}
                    </span>
                  </div>
                  <button
                    className="bg-[var(--color-brand-primary)]/10 border border-transparent text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={installingId === entry.projectId}
                    onClick={() => void onInstall(entry.projectId)}
                  >
                    {installingId === entry.projectId
                      ? "Installing..."
                      : "Install"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DiscoverModal>
  );
}

export function AssetsPage() {
  const {
    status,
    selectedMods,
    selectedResources,
    selectedShaders,
    baselineMods,
    baselineResources,
    baselineShaders,
    openModsManager,
    modalType,
    popular,
    loadingPopular,
    installingId,
    searchQuery,
    executeSearch,
    openPopularModal,
    closePopularModal,
    installFromPopular,
    removeResource,
    removeShader,
  } = useAssetsPageModel();

  const publishedModKeys = React.useMemo(
    () => makeDraftKeySet(baselineMods),
    [baselineMods],
  );
  const publishedResourceKeys = React.useMemo(
    () => makeDraftKeySet(baselineResources),
    [baselineResources],
  );
  const publishedShaderKeys = React.useMemo(
    () => makeDraftKeySet(baselineShaders),
    [baselineShaders],
  );

  const modPreview = selectedMods.slice(0, 6);
  const hiddenMods = Math.max(selectedMods.length - modPreview.length, 0);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight m-0">Assets</h1>
          <p className="text-[var(--color-text-muted)] mt-1 mb-0 text-sm">
            Manage user-side assets. Mods, resourcepacks, and shaderpacks are
            tracked here.
          </p>
        </div>
      </div>

      {status.text ? (
        <div className={statusClass(status.tone)}>{status.text}</div>
      ) : null}

      <div className="flex flex-col gap-8">
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
            <button
              type="button"
              className="text-sm text-[var(--color-brand-primary)] font-medium hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={openModsManager}
            >
              Open Mods Manager
            </button>
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
                <InstalledRow
                  key={`${entry.projectId ?? entry.sha256}-${entry.versionId ?? "latest"}`}
                  iconUrl={entry.iconUrl}
                  name={entry.name}
                  fallback="M"
                  tag1={entry.side === "both" ? "user + server" : entry.side}
                  description={entry.slug ?? "Managed mod"}
                  isDraft={
                    !publishedModKeys.has(entry.projectId ?? entry.sha256)
                  }
                  rightActions={
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-black/20 border border-[var(--color-line)] text-xs font-bold hover:bg-white/5 transition-colors text-[var(--color-text-secondary)] cursor-pointer"
                      onClick={openModsManager}
                    >
                      Managed in Mods Manager
                    </button>
                  }
                />
              ))
            )}

            {hiddenMods > 0 ? (
              <button
                type="button"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] font-bold text-sm flex items-center justify-center gap-1 w-full mt-2 cursor-pointer bg-transparent border-none"
                onClick={openModsManager}
              >
                View {hiddenMods} more mod(s)
                <span className="material-symbols-outlined text-[16px]">
                  expand_more
                </span>
              </button>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 m-0">
              <span className="material-symbols-outlined text-[#10b981]">
                texture
              </span>
              Resourcepacks
              <span className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded text-xs ml-2">
                {selectedResources.length} Installed
              </span>
            </h3>
            <button
              type="button"
              className="text-sm text-[var(--color-brand-primary)] font-medium hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={() => void openPopularModal("resourcepack")}
            >
              Add Resourcepack
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {selectedResources.length === 0 ? (
              <EmptyState
                title="No resourcepacks found"
                description="Resourcepacks can change the look of blocks, items, and UI. Add some to customize your world."
                icon="texture"
              />
            ) : (
              selectedResources.map((entry) => (
                <InstalledRow
                  key={entry.sha256}
                  iconUrl={entry.iconUrl}
                  name={entry.name}
                  fallback="R"
                  tag1={entry.slug ?? entry.projectId ?? "custom pack"}
                  isDraft={
                    !publishedResourceKeys.has(entry.projectId ?? entry.sha256)
                  }
                  rightActions={
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#e11d48]/10 text-[#f43f5e] text-xs font-bold hover:bg-[#e11d48]/20 transition-colors cursor-pointer border border-transparent"
                      onClick={() =>
                        removeResource(entry.projectId, entry.sha256)
                      }
                    >
                      Remove
                    </button>
                  }
                />
              ))
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 m-0">
              <span className="material-symbols-outlined text-[#a855f7]">
                gradient
              </span>
              Shaderpacks
              <span className="bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#c084fc] px-2 py-0.5 rounded text-xs ml-2">
                {selectedShaders.length} Installed
              </span>
            </h3>
            <button
              type="button"
              className="text-sm text-[var(--color-brand-primary)] font-medium hover:underline cursor-pointer bg-transparent border-none p-0"
              onClick={() => void openPopularModal("shaderpack")}
            >
              Add Shaderpack
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {selectedShaders.length === 0 ? (
              <EmptyState
                title="No shaderpacks installed"
                description="Shaderpacks dramatically improve lighting, shadows, and water. Browse the gallery to find one."
                icon="gradient"
              />
            ) : (
              selectedShaders.map((entry) => (
                <InstalledRow
                  key={entry.sha256}
                  iconUrl={entry.iconUrl}
                  name={entry.name}
                  fallback="S"
                  tag1={entry.slug ?? entry.projectId ?? "custom shader"}
                  isDraft={
                    !publishedShaderKeys.has(entry.projectId ?? entry.sha256)
                  }
                  rightActions={
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#e11d48]/10 text-[#f43f5e] text-xs font-bold hover:bg-[#e11d48]/20 transition-colors cursor-pointer border border-transparent"
                      onClick={() =>
                        removeShader(entry.projectId, entry.sha256)
                      }
                    >
                      Remove
                    </button>
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>

      {modalType ? (
        <PopularAssetModal
          type={modalType}
          popular={popular}
          loading={loadingPopular}
          installingId={installingId}
          searchQuery={searchQuery}
          onSearch={executeSearch}
          onClose={closePopularModal}
          onInstall={installFromPopular}
        />
      ) : null}
    </div>
  );
}
