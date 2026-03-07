"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

import type {
  AdminMod,
  CoreModPolicy,
  ModVersionsPayload,
} from "@/admin/client/types";
import { requestJson } from "@/admin/client/http";
import { Button } from "@/admin/shared/ui/button";
import { DiscoverModal } from "@/admin/shared/ui/discover-modal";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";
import { Tooltip } from "@/admin/shared/ui/tooltip";

import { useModManagerPageModel } from "../hooks/use-mod-manager-page-model";
import { useTopBarModel } from "@/admin/features/shell/hooks/use-top-bar-model";

const CART_STORAGE_KEY = "admin-mod-cart";
const MODRINTH_FALLBACK_ICON_URL = "https://modrinth.com/favicon.ico";

type CartEntry = {
  projectId: string;
  title: string;
  iconUrl?: string;
  slug?: string;
  deps: Array<{ projectId: string; title: string }>;
};

type SideSupport = "required" | "optional" | "unsupported";

function normalizeSideSupport(value: unknown): SideSupport | undefined {
  if (value === "required" || value === "optional" || value === "unsupported") {
    return value;
  }
  return undefined;
}

function sideBadgeStyle(side?: SideSupport): {
  bg: string;
  dot: string;
  label: string;
} {
  if (side === "required") {
    return {
      bg: "bg-[#10b981]/10 border-[#10b981]/25",
      dot: "bg-[#10b981]",
      label: "text-[#34d399]",
    };
  }
  if (side === "unsupported") {
    return {
      bg: "bg-[#ef4444]/8 border-[#ef4444]/20",
      dot: "bg-[#ef4444]",
      label: "text-[#f87171]",
    };
  }
  return {
    bg: "bg-white/[0.03] border-white/10",
    dot: "bg-[var(--color-text-muted)]",
    label: "text-[var(--color-text-muted)]",
  };
}

function sideTooltipText(env: "Client" | "Server", side?: SideSupport): string {
  if (side === "required") {
    return `This mod must be installed on the ${env.toLowerCase()} to work.`;
  }
  if (side === "unsupported") {
    return `This mod does not run on the ${env.toLowerCase()}.`;
  }
  return `This mod can optionally be installed on the ${env.toLowerCase()}.`;
}

function serverRequirementHint(input: {
  clientSide?: SideSupport;
  serverSide?: SideSupport;
}): string | null {
  if (input.clientSide === "unsupported") {
    return "Not supported on client";
  }
  if (input.serverSide === "required") {
    return "Required in server";
  }
  if (input.serverSide === "optional") {
    return "Can install on server";
  }
  return null;
}

function installedHint(
  mod: AdminMod,
  hasServerIntegration: boolean,
): string | null {
  if (hasServerIntegration) {
    return null;
  }
  return serverRequirementHint({
    clientSide: normalizeSideSupport(mod.clientSide),
    serverSide: normalizeSideSupport(mod.serverSide),
  });
}

function loadCartFromStorage(): CartEntry[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartEntry[]) : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(cart: CartEntry[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignore
  }
}

function handleInstalledIconError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") {
    image.style.display = "none";
    image.nextElementSibling?.classList.remove("hidden");
    return;
  }
  image.dataset.fallbackApplied = "true";
  image.src = MODRINTH_FALLBACK_ICON_URL;
}

const ExternalLinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="13"
    height="13"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

function UiIcon({
  name,
  className,
}: {
  name:
    | "search"
    | "trending_up"
    | "explore"
    | "info"
    | "extension"
    | "check_circle"
    | "open_in_new"
    | "sync"
    | "grid_view"
    | "view_list"
    | "package_2";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }
  if (name === "trending_up") {
    return (
      <svg {...common}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  if (name === "explore") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <polygon points="10 10 16 8 14 14 8 16 10 10" />
      </svg>
    );
  }
  if (name === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="10" x2="12" y2="16" />
        <line x1="12" y1="7" x2="12.01" y2="7" />
      </svg>
    );
  }
  if (name === "extension") {
    return (
      <svg {...common}>
        <path d="M20 12h-2a2 2 0 1 0-2-2V8a2 2 0 1 0-4 0v2a2 2 0 1 0-2 2H8a2 2 0 1 0 0 4h2v2a2 2 0 1 0 4 0v-2h2a2 2 0 1 0 0-4z" />
      </svg>
    );
  }
  if (name === "check_circle") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    );
  }
  if (name === "open_in_new") {
    return (
      <svg {...common}>
        <path d="M14 3h7v7" />
        <path d="M10 14L21 3" />
        <path d="M21 14v7h-7" />
        <path d="M3 10V3h7" />
      </svg>
    );
  }
  if (name === "sync") {
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 0 0-15.5-6.36" />
        <polyline points="3 4 6 4 6 7" />
        <path d="M3 12a9 9 0 0 0 15.5 6.36" />
        <polyline points="18 20 18 17 21 17" />
      </svg>
    );
  }
  if (name === "grid_view") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (name === "view_list") {
    return (
      <svg {...common}>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function AddModsModal({
  onClose,
  onInstall,
}: {
  onClose: () => void;
  onInstall: (cart: CartEntry[]) => void;
}) {
  const {
    searchResults,
    dependencyMap,
    selectedMods,
    statuses,
    setStatus,
    form,
    exaroton,
    isBusy,
    setSearchQuery,
    searchMods,
    analyzeDeps,
  } = useModManagerPageModel();
  const [cart, setCart] = useState<CartEntry[]>(loadCartFromStorage);
  const [localQuery, setLocalQuery] = useState("");
  const [isLoadingPopular, setIsLoadingPopular] = useState(false);
  const [popularResults, setPopularResults] = useState<typeof searchResults>(
    [],
  );
  const loadedPopularKeyRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasRestoredCart] = useState(() => loadCartFromStorage().length > 0);

  useEffect(() => {
    if (searchResults.length > 0 || localQuery) return;

    const mcVersion = form.minecraftVersion.trim();
    if (!mcVersion) return;

    const currentKey = `popular:${mcVersion}`;
    if (loadedPopularKeyRef.current === currentKey) return;
    loadedPopularKeyRef.current = currentKey;

    let cancelled = false;

    const loadPopularMods = async () => {
      setIsLoadingPopular(true);

      const searchParams = new URLSearchParams({
        query: "",
        minecraftVersion: mcVersion,
      });

      try {
        const results = await requestJson<
          Array<{
            projectId: string;
            slug: string;
            title: string;
            description: string;
            author: string;
            iconUrl?: string;
            categories?: string[];
            latestVersion?: string;
            clientSide?: SideSupport;
            serverSide?: SideSupport;
          }>
        >(`/v1/admin/mods/search?${searchParams}`, "GET");

        if (cancelled) return;

        setSearchQuery("");
        if (results.length > 0) {
          setPopularResults(results);
        }
      } finally {
        if (cancelled) return;
        setIsLoadingPopular(false);
      }
    };

    void loadPopularMods();
    return () => {
      cancelled = true;
    };
  }, [form.minecraftVersion, localQuery, searchResults.length, setSearchQuery]);

  const displayResults = localQuery
    ? searchResults
    : searchResults.length > 0
      ? searchResults
      : popularResults;
  const isPopularView =
    !localQuery && searchResults.length === 0 && popularResults.length > 0;

  const installedIds = useMemo(
    () =>
      new Set(
        selectedMods.map((mod) => mod.projectId).filter(Boolean) as string[],
      ),
    [selectedMods],
  );
  const cartIds = useMemo(
    () => new Set(cart.map((entry) => entry.projectId)),
    [cart],
  );

  const handleQueryChange = (value: string) => {
    setLocalQuery(value);
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        void searchMods();
      }
    }, 500);
  };

  const addToCart = async (result: (typeof searchResults)[number]) => {
    if (cartIds.has(result.projectId) || installedIds.has(result.projectId)) {
      return;
    }

    let deps: Array<{ projectId: string; title: string }> = [];
    const fromCache = dependencyMap[result.projectId];
    if (fromCache) {
      deps = fromCache.dependencyDetails;
    } else if (form.minecraftVersion.trim()) {
      const analysis = await analyzeDeps(result.projectId);
      deps = analysis?.dependencyDetails ?? [];
    }

    const entry: CartEntry = {
      projectId: result.projectId,
      title: result.title,
      iconUrl: result.iconUrl,
      slug: result.slug,
      deps,
    };
    setCart((prev) => {
      const next = [...prev, entry];
      saveCartToStorage(next);
      return next;
    });

    if (!exaroton.connected) {
      const hint = serverRequirementHint({
        clientSide: normalizeSideSupport(result.clientSide),
        serverSide: normalizeSideSupport(result.serverSide),
      });
      if (hint) {
        setStatus(
          "mods",
          `Warning: ${result.title} - ${hint}. Without server integration, installs are client-only.`,
          "error",
        );
      }
    }
  };

  const removeFromCart = (projectId: string) => {
    setCart((prev) => {
      const next = prev.filter((entry) => entry.projectId !== projectId);
      saveCartToStorage(next);
      return next;
    });
  };

  const clearCart = () => {
    setCart([]);
    saveCartToStorage([]);
  };

  return (
    <DiscoverModal
      title="Add Mods"
      icon="explore"
      searchPlaceholder="Search Modrinth for mods..."
      searchQuery={localQuery}
      onSearchQueryChange={handleQueryChange}
      onClose={onClose}
      sidebar={
        <div className="flex flex-col gap-[16px]">
          <div className="font-bold text-[1.1rem] text-[var(--color-text-primary)] flex items-center justify-between border-b border-[var(--color-line)] pb-[12px] m-0">
            Queue
            {cart.length > 0 ? (
              <span className="bg-[var(--color-brand-primary)] text-white text-[0.8rem] py-[2px] px-[8px] rounded-full">
                {cart.length}
              </span>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-[12px] text-[0.9rem] text-[var(--color-text-muted)] opacity-70 p-[24px]">
              <span style={{ fontSize: "2rem" }}>🧺</span>
              <span>Add mods from search to queue them for install.</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-[8px]">
              {cart.map((entry) => (
                <div
                  key={entry.projectId}
                  className="flex items-center gap-[12px] bg-black/10 p-[10px_12px] rounded-lg border border-[var(--color-line)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.iconUrl || "https://modrinth.com/favicon.ico"}
                    alt={entry.title}
                    className="w-[28px] h-[28px] rounded shrink-0 object-contain shadow-sm"
                    onError={(event) => {
                      event.currentTarget.src =
                        "https://modrinth.com/favicon.ico";
                    }}
                  />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-[var(--color-text-primary)]">
                      <a
                        href={`https://modrinth.com/mod/${entry.slug ?? entry.projectId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-text-primary)] no-underline inline-flex items-center gap-[6px] transition-colors duration-150 hover:text-[var(--color-brand-primary)]"
                        title="View on Modrinth"
                      >
                        {entry.title}
                        <ExternalLinkIcon />
                      </a>
                    </div>
                    {entry.deps.length > 0 ? (
                      <div className="text-[10px] uppercase font-bold text-[#f59e0b]">
                        +{entry.deps.length} deps
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors border border-transparent shrink-0"
                    onClick={() => removeFromCart(entry.projectId)}
                    title="Remove from cart"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
      footer={
        <>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            {cart.length > 0 ? (
              <Button variant="danger" size="md" onClick={clearCart}>
                Clear All
              </Button>
            ) : null}
          </div>
          <Button
            variant="primary"
            size="md"
            disabled={cart.length === 0 || isBusy.install}
            onClick={() => onInstall(cart)}
          >
            {isBusy.install
              ? "Installing..."
              : `Install ${cart.length > 0 ? `${String(cart.length)} mod${cart.length !== 1 ? "s" : ""}` : "queue"}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold flex items-center gap-2 m-0">
            <UiIcon
              className="w-[18px] h-[18px] text-[var(--color-text-muted)]"
              name={
                localQuery
                  ? "search"
                  : isPopularView
                    ? "trending_up"
                    : "explore"
              }
            />
            {localQuery
              ? `Search Results`
              : isPopularView
                ? "Most popular mods (by followers)"
                : statuses.mods.text || "Mods"}
          </h3>
          {isBusy.search || isLoadingPopular ? (
            <span className="text-[0.8rem] text-[var(--color-text-muted)] animate-pulse font-medium">
              Loading...
            </span>
          ) : null}
        </div>

        {hasRestoredCart && cart.length > 0 ? (
          <div className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 p-3 rounded-xl text-sm font-semibold flex items-center gap-2">
            <UiIcon className="w-[18px] h-[18px]" name="info" />
            Cart restored from previous session.
          </div>
        ) : null}

        {!exaroton.connected ? (
          <div className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/25 p-3 rounded-xl text-sm font-semibold flex items-center gap-2">
            <UiIcon className="w-[18px] h-[18px]" name="info" />
            No server integration connected. Installs are client-only.
          </div>
        ) : null}

        {displayResults.length === 0 && !isLoadingPopular && !isBusy.search ? (
          <p className="text-[0.9rem] text-[var(--color-text-muted)] leading-[1.5] m-0">
            {localQuery
              ? "No results. Try a different query."
              : "Search for a mod to get started."}
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
            {displayResults.map((result) => {
              const dep = dependencyMap[result.projectId];
              const inCart = cartIds.has(result.projectId);
              const installed = installedIds.has(result.projectId);
              const clientSide = normalizeSideSupport(result.clientSide);
              const serverSide = normalizeSideSupport(result.serverSide);
              const serverHint = serverRequirementHint({
                clientSide,
                serverSide,
              });
              return (
                <div
                  key={result.projectId}
                  className={`bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-xl p-5 flex flex-col gap-4 transition-all group ${inCart ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5" : "hover:border-[var(--color-brand-primary)]/50"} ${installed ? "opacity-60 grayscale" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-black/20 rounded-xl flex items-center justify-center border border-[var(--color-line)] shrink-0 overflow-hidden shadow-inner p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          result.iconUrl || "https://modrinth.com/favicon.ico"
                        }
                        alt={result.title}
                        className="w-full h-full object-contain"
                        onError={(event) => {
                          event.currentTarget.src =
                            "https://modrinth.com/favicon.ico";
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                        ID
                      </span>
                      <span
                        className="text-xs font-medium max-w-[80px] truncate"
                        title={result.projectId}
                      >
                        {result.projectId}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-lg group-hover:text-[var(--color-brand-primary)] transition-colors line-clamp-1 m-0">
                      <a
                        href={`https://modrinth.com/mod/${result.slug || result.projectId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-text-primary)] no-underline inline-flex items-center gap-[6px] transition-colors duration-150 group-hover:text-[var(--color-brand-primary)]"
                        title="View on Modrinth"
                      >
                        {result.title}
                        <ExternalLinkIcon />
                      </a>
                    </h4>
                    <p
                      className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-1 m-0"
                      title={result.description}
                    >
                      {result.description}
                    </p>

                    {(dep && dep.requiresDependencies) || installed ? (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {dep && dep.requiresDependencies ? (
                          <Tooltip
                            content={
                              <>
                                <span className="font-bold text-[#fbbf24]">
                                  {dep.dependencyDetails.length} dependencies
                                </span>{" "}
                                will be auto-installed:{" "}
                                {dep.dependencyDetails
                                  .map((d) => d.title)
                                  .join(", ")}
                              </>
                            }
                          >
                            <span className="px-2.5 py-1 rounded-lg bg-[#f59e0b]/8 text-[#fbbf24] text-[10px] font-bold border border-[#f59e0b]/20 flex items-center gap-1.5 backdrop-blur-sm cursor-default">
                              <UiIcon
                                className="w-[11px] h-[11px]"
                                name="extension"
                              />
                              {dep.dependencyDetails.length} deps
                            </span>
                          </Tooltip>
                        ) : null}
                        {installed ? (
                          <Tooltip content="This mod is already in your profile.">
                            <span className="px-2.5 py-1 rounded-lg bg-[#10b981]/10 text-[#34d399] text-[10px] font-bold border border-[#10b981]/20 flex items-center gap-1.5 backdrop-blur-sm cursor-default">
                              <UiIcon
                                className="w-[11px] h-[11px]"
                                name="check_circle"
                              />
                              Installed
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                    ) : null}
                    {(() => {
                      const cs = sideBadgeStyle(clientSide);
                      const ss = sideBadgeStyle(serverSide);
                      return (
                        <div className="flex items-center gap-2 mt-2.5">
                          <Tooltip
                            content={sideTooltipText("Client", clientSide)}
                          >
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-default ${cs.bg}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${cs.dot} shrink-0`}
                              />
                              <span className={cs.label}>Client</span>
                            </span>
                          </Tooltip>
                          <Tooltip
                            content={sideTooltipText("Server", serverSide)}
                          >
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-default ${ss.bg}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${ss.dot} shrink-0`}
                              />
                              <span className={ss.label}>Server</span>
                            </span>
                          </Tooltip>
                          {!exaroton.connected && serverHint ? (
                            <span className="text-[10px] text-[#f87171] font-medium ml-0.5">
                              {serverHint}
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-[var(--color-line)]">
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
                        Author
                      </span>
                      <span className="text-xs font-medium truncate">
                        {result.author || "Unknown"}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {installed ? null : inCart ? (
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-xs font-bold hover:bg-[var(--color-danger)]/20 cursor-pointer border border-transparent hover:border-[var(--color-danger)]/30 transition-colors"
                          onClick={() => removeFromCart(result.projectId)}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)] hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-transparent hover:border-[var(--color-brand-primary)]/30"
                          onClick={() => void addToCart(result)}
                        >
                          Add to Queue
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DiscoverModal>
  );
}

function InstalledModRow({
  mod,
  isDraft,
  selectedModKeys,
  setSelectedModKeys,
  setRemoveTarget,
  coreModPolicy,
  exaroton,
  modVersionOptions,
  actions,
}: {
  mod: AdminMod;
  isDraft: boolean;
  selectedModKeys: Set<string>;
  setSelectedModKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRemoveTarget: React.Dispatch<
    React.SetStateAction<{
      projectId: string;
      sha256: string;
      name: string;
    } | null>
  >;
  coreModPolicy: CoreModPolicy;
  exaroton: {
    connected: boolean;
  };
  modVersionOptions: Record<string, ModVersionsPayload["versions"]>;
  actions: {
    setModInstallTarget: (
      projectId: string,
      target: "client" | "server" | "both",
      sha256?: string,
    ) => void;
    loadModVersions: (projectId: string) => Promise<void>;
    applyModVersion: (projectId: string, versionId: string) => Promise<void>;
  };
}) {
  const projectId = mod.projectId ?? "";
  const modKey = projectId || mod.sha256;
  const isLocked = coreModPolicy.nonRemovableProjectIds.includes(projectId);
  const isFabric = projectId === coreModPolicy.fabricApiProjectId;
  const isFancy = projectId === coreModPolicy.fancyMenuProjectId;
  const versions = projectId ? (modVersionOptions[projectId] ?? []) : [];
  const selectedVersion = versions.some((v) => v.id === mod.versionId)
    ? mod.versionId
    : "";
  const compatibilityHint = installedHint(mod, exaroton.connected);

  return (
    <div
      className={`bg-black/10 border border-[var(--color-line)] rounded-[var(--radius-xl)] p-4 flex items-center gap-4 relative transition-all duration-200 ${isLocked ? "bg-white/5 border-[var(--color-brand-primary)]/20" : "hover:border-[var(--color-brand-primary)]/50"}`}
    >
      {!isLocked ? (
        <label className="absolute top-[18px] left-[14px] cursor-pointer z-10">
          <input
            type="checkbox"
            className="w-4 h-4 cursor-pointer accent-[var(--color-brand-primary)]"
            checked={selectedModKeys.has(modKey)}
            onChange={(event) => {
              const isChecked = event.currentTarget.checked;
              setSelectedModKeys((current) => {
                const next = new Set(current);
                if (isChecked) {
                  next.add(modKey);
                } else {
                  next.delete(modKey);
                }
                return next;
              });
            }}
          />
        </label>
      ) : null}

      <div
        className={`relative shrink-0 overflow-visible ${!isLocked && "ml-6"}`}
      >
        {isLocked ? (
          <span className="absolute -top-2 -right-2 z-20 rounded-full bg-[var(--color-brand-primary)] px-2 py-0.5 text-[9px] font-bold text-white shadow-lg hidden sm:block">
            CORE
          </span>
        ) : isDraft ? (
          <span className="absolute -top-2 -right-2 z-20 rounded-full bg-[#f59e0b] px-2 py-0.5 text-[9px] font-bold text-white shadow-lg hidden sm:block">
            DRAFT
          </span>
        ) : null}
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center border overflow-hidden p-[2px] shadow-inner ${isLocked ? "bg-[var(--color-brand-primary)]/10 border-[var(--color-brand-primary)]/30 text-[var(--color-brand-primary)]" : "bg-black/20 border-[var(--color-line)]"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mod.iconUrl || MODRINTH_FALLBACK_ICON_URL}
            alt={mod.name}
            className="w-full h-full object-contain rounded-md"
            onError={handleInstalledIconError}
          />
          <UiIcon className="w-[28px] h-[28px] hidden" name="extension" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-[1rem] m-0 text-[var(--color-text-primary)] truncate">
            {mod.name}
          </h4>
          {mod.versionId ? (
            <span className="text-[10px] bg-black/30 border border-[var(--color-line)] px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)] hidden sm:block tracking-tight">
              {mod.versionId}
            </span>
          ) : null}
          {mod.slug ? (
            <a
              href={`https://modrinth.com/mod/${mod.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] shrink-0 flex items-center"
              title="View on Modrinth"
            >
              <UiIcon className="w-[16px] h-[16px]" name="open_in_new" />
            </a>
          ) : null}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] truncate m-0 mt-0.5 max-w-lg font-mono tracking-tight opacity-70">
          {projectId || mod.sha256}
        </p>
        {compatibilityHint ? (
          <p className="text-[10px] font-semibold text-[var(--color-danger)] m-0 mt-1">
            {compatibilityHint}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 shrink-0 sm:pl-4 sm:border-l border-[var(--color-line)]">
        {exaroton.connected ? (
          <div className="flex flex-col items-end sm:mr-2">
            <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] hidden sm:block">
              Target
            </span>
            <select
              value={mod.side || (isFabric ? "both" : "client")}
              className="bg-transparent border-none text-xs sm:text-sm p-0 m-0 text-right focus:ring-0 cursor-pointer text-[var(--color-brand-primary)] font-medium"
              disabled={(isLocked && !isFabric) || isFancy}
              onChange={(event) =>
                actions.setModInstallTarget(
                  projectId,
                  event.currentTarget.value as "client" | "server" | "both",
                  mod.sha256,
                )
              }
              title={isFancy ? "FancyMenu is User only" : "Install target"}
            >
              {isFancy ? (
                <option value="client" className="bg-[#1e1e1e]">
                  User
                </option>
              ) : (
                <>
                  <option value="client" className="bg-[#1e1e1e]">
                    User
                  </option>
                  <option value="both" className="bg-[#1e1e1e]">
                    User + Server
                  </option>
                  <option value="server" className="bg-[#1e1e1e]">
                    Server
                  </option>
                </>
              )}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {projectId ? (
            <>
              {versions.length > 0 ? (
                <select
                  value={selectedVersion}
                  className="bg-black/20 border border-[var(--color-line)] rounded-lg text-xs font-bold px-2 py-1 focus:border-[var(--color-brand-primary)] outline-none"
                  onChange={(event) =>
                    void actions.applyModVersion(
                      projectId,
                      event.currentTarget.value,
                    )
                  }
                  disabled={isLocked}
                >
                  <option value="">Update...</option>
                  {versions.map((version) => (
                    <option
                      key={version.id}
                      value={version.id}
                      className="bg-[#1e1e1e]"
                    >
                      {version.versionType === "release" ? "🚀" : "🧪"}{" "}
                      {version.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  className="px-3 py-1.5 rounded-lg bg-black/20 border border-[var(--color-line)] text-xs font-bold hover:bg-black/40 hover:text-white transition-colors"
                  onClick={() => void actions.loadModVersions(projectId)}
                  disabled={isLocked}
                >
                  Find Updates
                </button>
              )}
            </>
          ) : null}

          <button
            className="px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-xs font-bold hover:bg-[var(--color-danger)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[var(--color-danger)]/30"
            disabled={isLocked}
            onClick={() =>
              setRemoveTarget({ projectId, sha256: mod.sha256, name: mod.name })
            }
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ModGridCardItem({
  mod,
  isDraft,
  selectedModKeys,
  setSelectedModKeys,
  setRemoveTarget,
  coreModPolicy,
  exaroton,
  modVersionOptions,
  actions,
}: {
  mod: AdminMod;
  isDraft: boolean;
  selectedModKeys: Set<string>;
  setSelectedModKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRemoveTarget: React.Dispatch<
    React.SetStateAction<{
      projectId: string;
      sha256: string;
      name: string;
    } | null>
  >;
  coreModPolicy: CoreModPolicy;
  exaroton: { connected: boolean };
  modVersionOptions: Record<string, ModVersionsPayload["versions"]>;
  actions: {
    setModInstallTarget: (
      projectId: string,
      target: "client" | "server" | "both",
      sha256?: string,
    ) => void | Promise<void>;
    loadModVersions: (projectId: string) => Promise<void>;
    applyModVersion: (projectId: string, versionId: string) => Promise<void>;
  };
}) {
  const isLocked = Boolean(
    mod.projectId && coreModPolicy.lockedProjectIds.includes(mod.projectId),
  );
  const isFabric = mod.projectId === coreModPolicy.fabricApiProjectId;
  const isFancy = mod.projectId === coreModPolicy.fancyMenuProjectId;
  const modKey = mod.projectId || mod.sha256 || "";
  const isSelected = selectedModKeys.has(modKey);
  const projectId = mod.projectId ?? "";

  const versions = projectId ? (modVersionOptions[projectId] ?? []) : [];
  const selectedVersion = versions.some((v) => v.id === mod.versionId)
    ? (mod.versionId ?? "")
    : "";
  const compatibilityHint = installedHint(mod, exaroton.connected);

  return (
    <div
      className={`bg-[var(--color-bg-card)] border ${isSelected ? "border-[var(--color-brand-primary)]" : "border-[var(--color-line)]"} rounded-xl p-5 flex flex-col gap-4 relative transition-colors ${!isLocked ? "cursor-pointer hover:border-[var(--color-brand-primary)]/50" : ""}`}
      onClick={() => {
        if (isLocked) return;
        setSelectedModKeys((prev) => {
          const next = new Set(prev);
          if (next.has(modKey)) next.delete(modKey);
          else next.add(modKey);
          return next;
        });
      }}
    >
      <div className="flex justify-between items-start">
        <div className="relative shrink-0 overflow-visible">
          {isLocked ? (
            <div className="absolute -top-2 -right-2 bg-[var(--color-brand-primary)] px-1.5 py-0.5 text-[8px] font-bold text-white rounded-full opacity-90 z-20 hidden sm:block shadow-lg">
              CORE
            </div>
          ) : isDraft ? (
            <div className="absolute -top-2 -right-2 bg-[#f59e0b] px-1.5 py-0.5 text-[8px] font-bold text-white rounded-full opacity-90 z-20 hidden sm:block shadow-lg">
              DRAFT
            </div>
          ) : null}
          <div
            className={`w-14 h-14 rounded-lg flex items-center justify-center border overflow-hidden p-[2px] shadow-inner ${isLocked ? "bg-[var(--color-brand-primary)]/10 border-[var(--color-brand-primary)]/30 text-[var(--color-brand-primary)]" : "bg-black/20 border-[var(--color-line)]"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mod.iconUrl || MODRINTH_FALLBACK_ICON_URL}
              alt={mod.name}
              className="w-full h-full object-contain rounded-[4px]"
              onError={handleInstalledIconError}
            />
            <UiIcon className="w-[28px] h-[28px] hidden" name="extension" />
          </div>
        </div>
        {!isLocked && (
          <input
            type="checkbox"
            className="w-4 h-4 cursor-pointer accent-[var(--color-brand-primary)] shrink-0 mt-1"
            checked={isSelected}
            readOnly
          />
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 justify-between">
          <h4 className="font-bold text-[0.95rem] m-0 text-[var(--color-text-primary)] truncate flex-1">
            {mod.name}
          </h4>
          {mod.slug ? (
            <a
              href={`https://modrinth.com/mod/${mod.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] shrink-0 flex items-center transition-colors"
              title="View on Modrinth"
              onClick={(e) => e.stopPropagation()}
            >
              <UiIcon className="w-[18px] h-[18px]" name="open_in_new" />
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {mod.versionId ? (
            <span className="text-[10px] bg-black/30 border border-[var(--color-line)] px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)] max-w-[120px] truncate">
              {mod.versionId}
            </span>
          ) : null}
          <span className="text-[9px] text-[var(--color-text-muted)] truncate font-mono tracking-tight opacity-70">
            {projectId ||
              (mod.sha256 ? mod.sha256.substring(0, 12) + "..." : "Unknown ID")}
          </span>
          {compatibilityHint ? (
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[9px] font-bold border border-[var(--color-danger)]/20">
              {compatibilityHint}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex flex-col gap-3 pt-4 border-t border-[var(--color-line)]"
        onClick={(e) => e.stopPropagation()}
      >
        {exaroton.connected ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              Environment
            </span>
            <select
              value={mod.side || (isFabric ? "both" : "client")}
              disabled={isLocked && !isFabric}
              title={isFancy ? "FancyMenu is User only" : "Install target"}
              className="bg-black/20 border border-[var(--color-line)] rounded-lg text-xs font-bold px-2 py-1.5 w-full focus:border-[var(--color-brand-primary)] outline-none"
              onChange={(event) =>
                void actions.setModInstallTarget(
                  projectId,
                  event.currentTarget.value as "client" | "server" | "both",
                  mod.sha256,
                )
              }
            >
              {isFancy ? (
                <option value="client" className="bg-[#1e1e1e]">
                  User
                </option>
              ) : (
                <>
                  <option value="client" className="bg-[#1e1e1e]">
                    User
                  </option>
                  <option value="both" className="bg-[#1e1e1e]">
                    User + Server
                  </option>
                  <option value="server" className="bg-[#1e1e1e]">
                    Server
                  </option>
                </>
              )}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2 mt-auto">
          {projectId ? (
            <div className="flex-1 min-w-0">
              {versions.length > 0 ? (
                <select
                  value={selectedVersion}
                  className="bg-black/20 border border-[var(--color-line)] rounded-lg text-[11px] font-bold px-2 py-1.5 focus:border-[var(--color-brand-primary)] outline-none w-full cursor-pointer hover:bg-black/30 transition-colors"
                  onChange={(event) =>
                    void actions.applyModVersion(
                      projectId,
                      event.currentTarget.value,
                    )
                  }
                  disabled={isLocked}
                >
                  <option value="">Update...</option>
                  {versions.map((version) => (
                    <option
                      key={version.id}
                      value={version.id}
                      className="bg-[#1e1e1e]"
                    >
                      {version.versionType === "release" ? "🚀" : "🧪"}{" "}
                      {version.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  className="w-full px-2 py-1.5 rounded-lg bg-black/20 border border-[var(--color-line)] text-[11px] font-bold hover:bg-black/40 hover:text-white transition-colors text-center cursor-pointer"
                  onClick={() => void actions.loadModVersions(projectId)}
                  disabled={isLocked}
                >
                  Updates
                </button>
              )}
            </div>
          ) : null}

          <button
            className="px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[11px] font-bold hover:bg-[var(--color-danger)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-[var(--color-danger)]/30 shrink-0 cursor-pointer"
            disabled={isLocked}
            onClick={() =>
              setRemoveTarget({
                projectId,
                sha256: mod.sha256,
                name: mod.name,
              })
            }
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModManagerPage() {
  const { saveDraft } = useTopBarModel();
  const {
    exaroton,
    modVersionOptions,
    effectiveCorePolicy,
    selectedMods,
    baselineMods,
    statuses,
    requestAndConfirmInstall,
    removeMod,
    removeModsBulk,
    setModInstallTarget,
    setModsInstallTargetBulk,
    loadModVersions,
    applyModVersion,
    syncExarotonMods,
  } = useModManagerPageModel();

  const publishedModKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const mod of baselineMods) {
      keys.add(mod.projectId ?? mod.sha256);
    }
    return keys;
  }, [baselineMods]);

  const [showAddMods, setShowAddMods] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<"client" | "server" | "both">(
    "both",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedModKeys, setSelectedModKeys] = useState<Set<string>>(
    new Set(),
  );
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string;
    sha256: string;
    name: string;
  } | null>(null);
  const [showBulkRemove, setShowBulkRemove] = useState(false);

  const coreMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          mod.projectId &&
          effectiveCorePolicy.lockedProjectIds.includes(mod.projectId),
      ),
    [selectedMods, effectiveCorePolicy],
  );
  const userMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          !(
            mod.projectId &&
            effectiveCorePolicy.lockedProjectIds.includes(mod.projectId)
          ),
      ),
    [selectedMods, effectiveCorePolicy],
  );
  const selectableMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          !effectiveCorePolicy.nonRemovableProjectIds.includes(
            mod.projectId ?? "",
          ),
      ),
    [selectedMods, effectiveCorePolicy],
  );
  const allSelectableSelected =
    selectableMods.length > 0 &&
    selectableMods.every((mod) =>
      selectedModKeys.has(mod.projectId || mod.sha256),
    );
  const selectedBulkEntries = useMemo(
    () =>
      selectedMods
        .filter((mod) =>
          selectedModKeys.has((mod.projectId || mod.sha256) as string),
        )
        .map((mod) => ({
          projectId: mod.projectId,
          sha256: mod.sha256 as string,
        })),
    [selectedModKeys, selectedMods],
  );

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight m-0">
            Central Mods Manager
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1 mb-0 text-sm">
            Manage, install, and update server-side and client-side
            modifications across the instance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="ml-auto flex items-center gap-2">
            {exaroton.connected ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => void syncExarotonMods()}
                icon={<UiIcon className="w-[18px] h-[18px]" name="sync" />}
              >
                Sync Server Mods
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowAddMods(true)}
              icon={<UiIcon className="w-[18px] h-[18px]" name="explore" />}
            >
              Find Mods
            </Button>
          </div>
        </div>
      </div>

      {statuses.mods.text ? (
        <div className={statusClass(statuses.mods.tone)}>
          {statuses.mods.text}
        </div>
      ) : null}

      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2 m-0 bg-transparent text-[var(--color-text-primary)]">
            <UiIcon
              className="w-[18px] h-[18px] text-[var(--color-success)]"
              name="check_circle"
            />
            Installed Mods
            <span className="bg-[var(--color-success)]/10 text-[var(--color-success)] px-2 py-0.5 rounded text-xs border border-[var(--color-success)]/20 ml-2">
              {selectedMods.length} Active
            </span>
          </h3>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-black/20 p-1 rounded-lg border border-[var(--color-line)]">
              <button
                type="button"
                className={`w-8 h-8 rounded shrink-0 flex items-center justify-center transition-colors cursor-pointer border-none ${viewMode === "grid" ? "bg-white/10 text-white shadow-sm" : "bg-transparent text-[var(--color-text-muted)] hover:text-white"}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <UiIcon className="w-[18px] h-[18px]" name="grid_view" />
              </button>
              <button
                type="button"
                className={`w-8 h-8 rounded shrink-0 flex items-center justify-center transition-colors cursor-pointer border-none ${viewMode === "list" ? "bg-white/10 text-white shadow-sm" : "bg-transparent text-[var(--color-text-muted)] hover:text-white"}`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <UiIcon className="w-[18px] h-[18px]" name="view_list" />
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-[0.85rem] text-[var(--color-text-primary)] font-medium transition-colors hover:text-white border-l border-[var(--color-line)] pl-4">
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer accent-[var(--color-brand-primary)]"
                checked={allSelectableSelected}
                onChange={(event) => {
                  if (!event.currentTarget.checked) {
                    setSelectedModKeys(new Set());
                    return;
                  }
                  setSelectedModKeys(
                    new Set(
                      selectableMods.map(
                        (mod) => (mod.projectId || mod.sha256) as string,
                      ),
                    ),
                  );
                }}
              />
              Select All
            </label>

            {selectedBulkEntries.length > 0 ? (
              <div className="flex items-center gap-2 pl-4 border-l border-[var(--color-line)]">
                {exaroton.connected ? (
                  <>
                    <select
                      value={bulkTarget}
                      onChange={(event) =>
                        setBulkTarget(
                          event.currentTarget.value as
                            | "client"
                            | "server"
                            | "both",
                        )
                      }
                      className="bg-black/20 border border-[var(--color-line)] rounded-lg text-xs font-bold px-2 py-1 outline-none text-[var(--color-text-primary)]"
                    >
                      <option value="client" className="bg-[#1e1e1e]">
                        Bulk: User
                      </option>
                      <option value="both" className="bg-[#1e1e1e]">
                        Bulk: User + Server
                      </option>
                      <option value="server" className="bg-[#1e1e1e]">
                        Bulk: Server
                      </option>
                    </select>
                    <Button
                      variant="outline"
                      size="xs"
                      className="!text-[var(--color-brand-primary)] !bg-[var(--color-brand-primary)]/10 hover:not-disabled:!border-[var(--color-brand-primary)]/30 hover:not-disabled:!bg-[var(--color-brand-primary)]/20"
                      onClick={() =>
                        setModsInstallTargetBulk(
                          selectedBulkEntries,
                          bulkTarget,
                        )
                      }
                    >
                      Apply Target
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => setShowBulkRemove(true)}
                >
                  Delete Selected
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {selectedMods.length === 0 ? (
          <div className="border border-[var(--color-line)] border-dashed bg-black/10 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-center transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-[var(--color-line)] mb-2 shadow-inner">
              <UiIcon
                className="w-[32px] h-[32px] text-[var(--color-text-muted)]"
                name="package_2"
              />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <h4 className="m-0 text-base font-bold text-[var(--color-text-primary)]">
                No mods loader
              </h4>
              <p className="m-0 text-[13px] text-[var(--color-text-muted)] max-w-sm leading-relaxed">
                Your server is currently vanilla. Click &apos;Find Mods&apos; to
                enhance your gameplay experience.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {userMods.length > 0 ? (
              <>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-2 mb-1 pl-1 border-b border-[var(--color-line)] pb-2 flex items-center justify-between">
                  <span>Community Mods</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-full">
                    {userMods.length}
                  </span>
                </div>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "flex flex-col gap-3"
                  }
                >
                  {userMods.map((mod) =>
                    viewMode === "grid" ? (
                      <ModGridCardItem
                        key={`user-grid-${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                        mod={mod}
                        isDraft={
                          !publishedModKeys.has(mod.projectId ?? mod.sha256)
                        }
                        selectedModKeys={selectedModKeys}
                        setSelectedModKeys={setSelectedModKeys}
                        setRemoveTarget={setRemoveTarget}
                        coreModPolicy={effectiveCorePolicy}
                        exaroton={exaroton}
                        modVersionOptions={modVersionOptions}
                        actions={{
                          setModInstallTarget,
                          loadModVersions,
                          applyModVersion,
                        }}
                      />
                    ) : (
                      <InstalledModRow
                        key={`user-row-${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                        mod={mod}
                        isDraft={
                          !publishedModKeys.has(mod.projectId ?? mod.sha256)
                        }
                        selectedModKeys={selectedModKeys}
                        setSelectedModKeys={setSelectedModKeys}
                        setRemoveTarget={setRemoveTarget}
                        coreModPolicy={effectiveCorePolicy}
                        exaroton={exaroton}
                        modVersionOptions={modVersionOptions}
                        actions={{
                          setModInstallTarget,
                          loadModVersions,
                          applyModVersion,
                        }}
                      />
                    ),
                  )}
                </div>
              </>
            ) : null}

            {coreMods.length > 0 ? (
              <>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-4 mb-1 pl-1 border-b border-[var(--color-line)] pb-2 flex items-center justify-between">
                  <span>Core System Mods</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-full">
                    {coreMods.length}
                  </span>
                </div>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "flex flex-col gap-3"
                  }
                >
                  {coreMods.map((mod) =>
                    viewMode === "grid" ? (
                      <ModGridCardItem
                        key={`core-grid-${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                        mod={mod}
                        isDraft={
                          !publishedModKeys.has(mod.projectId ?? mod.sha256)
                        }
                        selectedModKeys={selectedModKeys}
                        setSelectedModKeys={setSelectedModKeys}
                        setRemoveTarget={setRemoveTarget}
                        coreModPolicy={effectiveCorePolicy}
                        exaroton={exaroton}
                        modVersionOptions={modVersionOptions}
                        actions={{
                          setModInstallTarget,
                          loadModVersions,
                          applyModVersion,
                        }}
                      />
                    ) : (
                      <InstalledModRow
                        key={`core-row-${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                        mod={mod}
                        isDraft={
                          !publishedModKeys.has(mod.projectId ?? mod.sha256)
                        }
                        selectedModKeys={selectedModKeys}
                        setSelectedModKeys={setSelectedModKeys}
                        setRemoveTarget={setRemoveTarget}
                        coreModPolicy={effectiveCorePolicy}
                        exaroton={exaroton}
                        modVersionOptions={modVersionOptions}
                        actions={{
                          setModInstallTarget,
                          loadModVersions,
                          applyModVersion,
                        }}
                      />
                    ),
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>

      {showAddMods ? (
        <AddModsModal
          onClose={() => setShowAddMods(false)}
          onInstall={(cart) => {
            void (async () => {
              for (const entry of cart) {
                await requestAndConfirmInstall(entry.projectId);
              }
              saveCartToStorage([]);
              setShowAddMods(false);
            })();
          }}
        />
      ) : null}

      {showBulkRemove && selectedBulkEntries.length > 0 ? (
        <ModalShell onClose={() => setShowBulkRemove(false)}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] p-[16px_20px] shrink-0">
            <h3 className="m-0 text-lg">
              Remove {selectedBulkEntries.length} mod
              {selectedBulkEntries.length !== 1 ? "s" : ""}?
            </h3>
            <button
              className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
              type="button"
              aria-label="Close"
              onClick={() => setShowBulkRemove(false)}
            >
              ✕
            </button>
          </div>
          <div className="p-5 overflow-y-auto flex flex-col gap-4">
            <p className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] p-4 rounded-xl text-sm leading-relaxed m-0">
              The following mods will be removed from the profile draft. This
              change requires a publish to apply to users.
            </p>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5 max-h-60 overflow-y-auto">
              {selectedMods
                .filter((mod) =>
                  selectedModKeys.has((mod.projectId || mod.sha256) as string),
                )
                .map((mod) => (
                  <li
                    key={mod.projectId || mod.sha256}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/20 border border-[var(--color-line)]"
                  >
                    <img
                      src={mod.iconUrl || MODRINTH_FALLBACK_ICON_URL}
                      alt=""
                      className="w-7 h-7 rounded shrink-0 object-contain"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (image.dataset.fallbackApplied === "true") {
                          image.style.display = "none";
                          return;
                        }
                        image.dataset.fallbackApplied = "true";
                        image.src = MODRINTH_FALLBACK_ICON_URL;
                      }}
                    />
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {mod.name}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-3 bg-black/10 shrink-0">
            <Button
              variant="flat"
              size="md"
              onClick={() => setShowBulkRemove(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              className="!bg-[var(--color-danger)] !text-white hover:not-disabled:!bg-[var(--color-danger)]/90 shadow-lg shadow-[var(--color-danger)]/20"
              onClick={() => {
                removeModsBulk(selectedBulkEntries);
                setSelectedModKeys(new Set());
                setShowBulkRemove(false);
                void saveDraft();
              }}
            >
              Confirm Remove
            </Button>
          </div>
        </ModalShell>
      ) : null}

      {removeTarget ? (
        <ModalShell onClose={() => setRemoveTarget(null)}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] p-[16px_20px] shrink-0">
            <h3 className="m-0 text-lg">Remove {removeTarget.name}?</h3>
            <button
              className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
              type="button"
              aria-label="Close"
              onClick={() => setRemoveTarget(null)}
            >
              ✕
            </button>
          </div>
          <div className="p-5 overflow-y-auto">
            <p className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] p-4 rounded-xl text-sm leading-relaxed m-0">
              This mod will be removed from the profile draft. This change
              requires a publish to apply to users.
            </p>
          </div>
          <div className="p-4 border-t border-[var(--color-line)] flex items-center justify-end gap-3 bg-black/10 shrink-0">
            <Button
              variant="flat"
              size="md"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              className="!bg-[var(--color-danger)] !text-white hover:not-disabled:!bg-[var(--color-danger)]/90 shadow-lg shadow-[var(--color-danger)]/20"
              onClick={() => {
                removeMod(removeTarget.projectId, removeTarget.sha256);
                setRemoveTarget(null);
                void saveDraft();
              }}
            >
              Confirm Remove
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
