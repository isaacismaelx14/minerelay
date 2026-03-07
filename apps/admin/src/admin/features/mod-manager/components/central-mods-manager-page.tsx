"use client";

import { useEffect, useRef, useState } from "react";

import { requestJson } from "@/admin/client/http";
import type { AdminMod, SearchResult } from "@/admin/client/types";
import { useTopBarModel } from "@/admin/features/shell/hooks/use-top-bar-model";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";
import { ui } from "@/admin/shared/ui/styles";

import { useModManagerPageModel } from "../hooks/use-mod-manager-page-model";

const mm = {
  page: "grid gap-[20px]",
  hero: `${ui.panel} md:flex md:items-start md:justify-between md:gap-[24px]`,
  kicker:
    "font-mono text-[0.72rem] uppercase tracking-[0.1em] text-[var(--color-brand-accent)] font-medium",
  runtime: "flex flex-wrap gap-[8px]",
  toolbar: `${ui.panel} md:flex md:items-end md:justify-between md:gap-[16px]`,
  toolbarGroup: "flex flex-wrap items-center gap-[8px]",
  toolbarChip:
    "grid gap-[2px] border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[8px_10px] [&>span]:text-[0.72rem] [&>span]:uppercase [&>span]:tracking-[0.08em] [&>span]:text-[var(--color-text-muted)] [&>strong]:text-[0.85rem] [&>strong]:text-white",
  searchBox: "grid gap-[8px] w-full md:max-w-[460px]",
  searchInput:
    "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]",
  layout: "grid grid-cols-1 xl:grid-cols-2 gap-[16px]",
  surface: ui.panel,
  sectionHead: "flex items-start justify-between gap-[12px]",
  sectionCount: "text-[0.8rem] text-[var(--color-text-muted)]",
  empty: ui.hint,
  installedList: "grid gap-[10px]",
  installedRow:
    "border border-[var(--color-line)] bg-black/20 rounded-[var(--radius-md)] p-[12px] flex flex-wrap items-start justify-between gap-[12px]",
  installedRowCore:
    "border-[var(--color-brand-primary)] bg-[rgba(99,102,241,0.06)]",
  installedMain: "flex items-start gap-[12px] min-w-0",
  installedIcon:
    "w-[42px] h-[42px] rounded-[10px] border border-[var(--color-line)] bg-white/5 shrink-0 object-cover",
  installedCopy:
    "grid gap-[4px] min-w-0 [&>p]:m-0 [&>p]:text-[0.85rem] [&>p]:text-[var(--color-text-muted)]",
  installedTitle: "flex items-center gap-[6px] flex-wrap",
  versionBadge:
    "inline-flex items-center rounded-full px-[8px] py-[3px] text-[0.7rem] font-semibold border border-[var(--color-line)] bg-white/5 text-[var(--color-text-secondary)]",
  coreBadge:
    "inline-flex items-center rounded-full px-[8px] py-[3px] text-[0.7rem] font-semibold border border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[#a5b4fc]",
  installedActions: "flex flex-wrap items-center gap-[8px]",
  inlineSelect:
    "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[10px] px-[12px] text-[0.85rem] text-[var(--color-text-primary)]",
  discoveryGrid: "grid grid-cols-1 md:grid-cols-2 gap-[12px]",
  discoveryCard: `${ui.panel} p-[16px]`,
  discoveryCardInstalled:
    "border-[var(--color-brand-primary)] bg-[rgba(99,102,241,0.06)]",
  discoveryTop: "flex items-start justify-between gap-[8px]",
  discoveryIcon:
    "w-[42px] h-[42px] rounded-[10px] border border-[var(--color-line)] bg-white/5 object-cover",
  discoveryBadges: "flex items-center gap-[6px] flex-wrap justify-end",
  miniBadge:
    "inline-flex items-center rounded-full px-[8px] py-[3px] text-[0.68rem] font-semibold border border-[var(--color-line)] bg-white/5 text-[var(--color-text-secondary)]",
  miniBadgeSuccess: "border-[#10b981]/20 bg-[#10b981]/10 text-[#86efac]",
  discoveryBody:
    "grid gap-[8px] [&>h4]:m-0 [&>p]:m-0 [&>p]:text-[0.85rem] [&>p]:text-[var(--color-text-muted)]",
  discoveryMeta:
    "flex items-center gap-[6px] flex-wrap text-[0.75rem] text-[var(--color-text-muted)]",
  categoryBadge:
    "inline-flex items-center rounded-full px-[8px] py-[3px] text-[0.68rem] font-semibold border border-[var(--color-line)] bg-white/5 text-[var(--color-text-secondary)]",
  discoveryActions: "flex items-center justify-end gap-[8px] mt-[4px]",
} as const;

function runtimeChip(label: string, value: string) {
  return (
    <div className={mm.toolbarChip} key={label}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function InstalledModRow({
  mod,
  isCore,
  exarotonConnected,
  versionOptions,
  onRemove,
  onLoadVersions,
  onApplyVersion,
  onSetTarget,
}: {
  mod: AdminMod;
  isCore: boolean;
  exarotonConnected: boolean;
  versionOptions: Array<{
    id: string;
    name: string;
    versionType: "release" | "beta" | "alpha";
    publishedAt: string;
  }>;
  onRemove: (mod: AdminMod) => void;
  onLoadVersions: (projectId: string) => Promise<void>;
  onApplyVersion: (projectId: string, versionId: string) => Promise<void>;
  onSetTarget: (
    projectId: string,
    target: "client" | "server" | "both",
    sha256?: string,
  ) => void;
}) {
  const projectId = mod.projectId ?? "";
  const selectedVersion = versionOptions.some(
    (entry) => entry.id === mod.versionId,
  )
    ? (mod.versionId ?? "")
    : "";
  const iconSrc =
    mod.iconUrl ||
    (projectId
      ? `https://cdn.modrinth.com/data/${projectId}/icon.png`
      : "https://modrinth.com/favicon.ico");

  return (
    <div className={`${mm.installedRow} ${isCore ? mm.installedRowCore : ""}`}>
      <div className={mm.installedMain}>
        <img
          src={iconSrc}
          alt={mod.name}
          className={mm.installedIcon}
          onError={(event) => {
            event.currentTarget.src = "https://modrinth.com/favicon.ico";
          }}
        />
        <div className={mm.installedCopy}>
          <div className={mm.installedTitle}>
            <strong>{mod.name}</strong>
            {mod.versionId ? (
              <span className={mm.versionBadge}>{mod.versionId}</span>
            ) : null}
            {isCore ? <span className={mm.coreBadge}>Core</span> : null}
          </div>
          <p>
            {mod.slug ?? mod.projectId ?? "custom package"} •{" "}
            {mod.side === "both" ? "user + server" : mod.side}
          </p>
        </div>
      </div>

      <div className={mm.installedActions}>
        {exarotonConnected ? (
          <select
            className={mm.inlineSelect}
            value={mod.side || "client"}
            disabled={isCore}
            onChange={(event) =>
              onSetTarget(
                projectId,
                event.currentTarget.value as "client" | "server" | "both",
                mod.sha256,
              )
            }
          >
            <option value="client">User</option>
            <option value="both">User + Server</option>
            <option value="server">Server</option>
          </select>
        ) : null}

        {projectId ? (
          <button
            type="button"
            className={ui.buttonGhost}
            onClick={() => void onLoadVersions(projectId)}
          >
            Versions
          </button>
        ) : null}

        {projectId && versionOptions.length > 0 ? (
          <select
            className={mm.inlineSelect}
            value={selectedVersion}
            disabled={isCore}
            onChange={(event) =>
              void onApplyVersion(projectId, event.currentTarget.value)
            }
          >
            <option value="">Select version</option>
            {versionOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.versionType})
              </option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          className={ui.buttonDanger}
          disabled={isCore}
          onClick={() => onRemove(mod)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function DiscoverCard({
  result,
  installed,
  installing,
  onInstall,
}: {
  result: SearchResult;
  installed: boolean;
  installing: boolean;
  onInstall: (projectId: string) => Promise<void>;
}) {
  return (
    <article
      className={`${mm.discoveryCard} ${installed ? mm.discoveryCardInstalled : ""}`}
    >
      <div className={mm.discoveryTop}>
        <img
          src={result.iconUrl || "https://modrinth.com/favicon.ico"}
          alt={result.title}
          className={mm.discoveryIcon}
          onError={(event) => {
            event.currentTarget.src = "https://modrinth.com/favicon.ico";
          }}
        />
        <div className={mm.discoveryBadges}>
          {result.latestVersion ? (
            <span className={mm.miniBadge}>{result.latestVersion}</span>
          ) : null}
          {installed ? (
            <span className={`${mm.miniBadge} ${mm.miniBadgeSuccess}`}>
              Installed
            </span>
          ) : null}
        </div>
      </div>

      <div className={mm.discoveryBody}>
        <h4>{result.title}</h4>
        <p>{result.description || "No description available."}</p>
        <div className={mm.discoveryMeta}>
          <span>{result.author ? `by ${result.author}` : "Modrinth"}</span>
          {result.categories?.slice(0, 2).map((category) => (
            <span key={category} className={mm.categoryBadge}>
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className={mm.discoveryActions}>
        {result.slug ? (
          <a
            href={`https://modrinth.com/mod/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            className={ui.buttonGhost}
          >
            Open
          </a>
        ) : null}
        <button
          type="button"
          className={ui.buttonPrimary}
          disabled={installed || installing}
          onClick={() => void onInstall(result.projectId)}
        >
          {installed ? "Installed" : installing ? "Installing..." : "Install"}
        </button>
      </div>
    </article>
  );
}

export function CentralModsManagerPage() {
  const { saveDraft } = useTopBarModel();
  const {
    form,
    exaroton,
    isBusy,
    statuses,
    searchResults,
    selectedMods,
    coreModPolicy,
    modVersionOptions,
    setSearchQuery,
    searchMods,
    requestAndConfirmInstall,
    removeMod,
    setModInstallTarget,
    loadModVersions,
    applyModVersion,
    syncExarotonMods,
  } = useModManagerPageModel();
  const [query, setQuery] = useState("");
  const [popularResults, setPopularResults] = useState<SearchResult[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [installingProjectId, setInstallingProjectId] = useState<string | null>(
    null,
  );
  const [removeTarget, setRemoveTarget] = useState<AdminMod | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runtimeVersion = form.minecraftVersion.trim();
  const loaderVersion = form.loaderVersion.trim();
  const installedIds = new Set(
    selectedMods.map((entry) => entry.projectId).filter(Boolean) as string[],
  );
  const coreIds = new Set(coreModPolicy.lockedProjectIds);
  const visibleResults = query.trim() ? searchResults : popularResults;

  async function loadPopularMods() {
    if (!runtimeVersion) {
      return;
    }

    setLoadingPopular(true);
    try {
      const results = await requestJson<SearchResult[]>(
        `/v1/admin/mods/search?query=&minecraftVersion=${encodeURIComponent(runtimeVersion)}`,
        "GET",
      );
      setPopularResults(Array.isArray(results) ? results : []);
    } catch (error) {
      setPopularResults([]);
      console.error("[mods-manager] failed to load popular mods", error);
    } finally {
      setLoadingPopular(false);
    }
  }

  useEffect(() => {
    if (!query.trim()) {
      void loadPopularMods();
    }
  }, [runtimeVersion]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setSearchQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      void loadPopularMods();
      return;
    }

    debounceRef.current = setTimeout(() => {
      void searchMods();
    }, 350);
  };

  const handleInstall = async (projectId: string) => {
    setInstallingProjectId(projectId);
    try {
      await requestAndConfirmInstall(projectId);
    } finally {
      setInstallingProjectId(null);
    }
  };

  const installedCountLabel = `${selectedMods.length} Active`;

  return (
    <>
      <section className={mm.page}>
        <header className={mm.hero}>
          <div>
            <span className={mm.kicker}>Central Mods Management</span>
            <h2>Mods Manager</h2>
            <p className={ui.hint}>
              Manage installed profile mods and discover compatible Modrinth
              packages without leaving the admin console.
            </p>
          </div>

          <div className={mm.runtime}>
            {runtimeChip("Minecraft", runtimeVersion || "Set in Identity")}
            {runtimeChip("Loader", loaderVersion || "Set in Identity")}
            {runtimeChip("Installed", String(selectedMods.length))}
          </div>
        </header>

        <div className={mm.toolbar}>
          <label className={mm.searchBox}>
            <span className={ui.dataLabel}>Search Modrinth</span>
            <input
              className={mm.searchInput}
              value={query}
              onChange={(event) =>
                handleSearchChange(event.currentTarget.value)
              }
              placeholder="Search mods, utilities, optimization..."
            />
          </label>

          <div className={mm.toolbarGroup}>
            <div className={mm.toolbarChip}>
              <span>Source</span>
              <strong>Modrinth</strong>
            </div>
            {exaroton.connected ? (
              <button
                type="button"
                className={ui.buttonGhost}
                onClick={() => void syncExarotonMods()}
              >
                Sync Server Mods
              </button>
            ) : null}
          </div>
        </div>

        <div className={statusClass(statuses.mods.tone)}>
          {statuses.mods.text}
        </div>

        <div className={mm.layout}>
          <section className={mm.surface}>
            <div className={mm.sectionHead}>
              <div>
                <h3>Installed Mods</h3>
                <p className={ui.hint}>
                  Current profile content, including managed core dependencies.
                </p>
              </div>
              <span className={mm.sectionCount}>{installedCountLabel}</span>
            </div>

            {selectedMods.length === 0 ? (
              <p className={mm.empty}>
                No mods installed yet. Use the discovery section to add
                compatible mods from Modrinth.
              </p>
            ) : (
              <div className={mm.installedList}>
                {selectedMods.map((mod) => (
                  <InstalledModRow
                    key={`${mod.projectId ?? mod.sha256}-${mod.versionId ?? "latest"}`}
                    mod={mod}
                    isCore={coreIds.has(mod.projectId ?? "")}
                    exarotonConnected={exaroton.connected}
                    versionOptions={
                      modVersionOptions[mod.projectId ?? ""] ?? []
                    }
                    onRemove={setRemoveTarget}
                    onLoadVersions={loadModVersions}
                    onApplyVersion={applyModVersion}
                    onSetTarget={setModInstallTarget}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={mm.surface}>
            <div className={mm.sectionHead}>
              <div>
                <h3>{query.trim() ? "Search Results" : "Popular Mods"}</h3>
                <p className={ui.hint}>
                  {query.trim()
                    ? "Install matching mods directly into the current draft."
                    : "Top Modrinth packages to seed the profile quickly."}
                </p>
              </div>
              <span className={mm.sectionCount}>
                {loadingPopular && !query.trim()
                  ? "Loading"
                  : `${visibleResults.length} Results`}
              </span>
            </div>

            {loadingPopular && !query.trim() ? (
              <p className={mm.empty}>Loading popular mods...</p>
            ) : visibleResults.length === 0 ? (
              <p className={mm.empty}>
                {query.trim()
                  ? "No mods matched that search. Try a broader term."
                  : "No popular mods available for this runtime."}
              </p>
            ) : (
              <div className={mm.discoveryGrid}>
                {visibleResults.map((result) => (
                  <DiscoverCard
                    key={result.projectId}
                    result={result}
                    installed={installedIds.has(result.projectId)}
                    installing={
                      installingProjectId === result.projectId || isBusy.install
                    }
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {removeTarget ? (
        <ModalShell onClose={() => setRemoveTarget(null)}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-[16px] mb-[8px] shrink-0">
            <h3 style={{ margin: 0 }}>Remove {removeTarget.name}?</h3>
            <button
              className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
              type="button"
              aria-label="Close"
              onClick={() => setRemoveTarget(null)}
            >
              X
            </button>
          </div>
          <p className="p-[12px_16px] rounded-[var(--radius-md)] bg-[#f59e0b]/10 text-[var(--color-warning)] border-l-[3px] border-l-[var(--color-warning)] m-0 text-[0.95rem]">
            This mod will be removed from the current draft and will require a
            publish before it reaches players.
          </p>
          <div
            className="flex items-center gap-[16px]"
            style={{ justifyContent: "flex-end", marginTop: 8 }}
          >
            <button
              className={ui.buttonGhost}
              type="button"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </button>
            <button
              className={ui.buttonDanger}
              type="button"
              onClick={() => {
                removeMod(removeTarget.projectId ?? "", removeTarget.sha256);
                setRemoveTarget(null);
                void saveDraft();
              }}
            >
              Confirm Remove
            </button>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
