"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AdminMod,
  CoreModPolicy,
  ModVersionsPayload,
} from "@/admin/client/types";
import { requestJson } from "@/admin/client/http";
import { ModalShell } from "@/admin/shared/ui/modal-shell";
import { statusClass } from "@/admin/shared/ui/status";

import { useModManagerPageModel } from "../hooks/use-mod-manager-page-model";
import { useTopBarModel } from "@/admin/features/shell/hooks/use-top-bar-model";

const CART_STORAGE_KEY = "admin-mod-cart";

type CartEntry = {
  projectId: string;
  title: string;
  iconUrl?: string;
  slug?: string;
  deps: Array<{ projectId: string; title: string }>;
};

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
    form,
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasRestoredCart] = useState(() => loadCartFromStorage().length > 0);

  useEffect(() => {
    if (searchResults.length > 0 || localQuery) return;

    const loadPopularMods = async () => {
      const mcVersion = form.minecraftVersion.trim();
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
          }>
        >(`/v1/admin/mods/search?${searchParams}`, "GET");

        setSearchQuery("");
        if (results.length > 0) {
          setPopularResults(results);
        }
      } finally {
        setIsLoadingPopular(false);
      }
    };

    void loadPopularMods();
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

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
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
    <ModalShell onClose={onClose} cardClassName="modal-card wide">
      <div
        className="modal-head"
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ margin: 0 }}>Add Mods</h3>
        <button
          className="modal-close-icon"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {hasRestoredCart && cart.length > 0 ? (
        <div
          style={{
            padding: "8px 20px",
            fontSize: "0.75rem",
            color: "var(--warning)",
            background: "rgba(245,158,11,0.07)",
            borderBottom: "1px solid rgba(245,158,11,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          Cart restored from previous session.
        </div>
      ) : null}

      <div className="add-mods-layout" style={{ flex: 1, minHeight: 0 }}>
        <div className="add-mods-search-pane">
          <div className="add-mods-search-bar">
            <input
              id="addModsSearch"
              value={localQuery}
              onChange={handleQueryChange}
              placeholder="Search Modrinth..."
              style={{ flex: 1 }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  void searchMods();
                }
              }}
            />
            <button
              type="button"
              className="btn ghost"
              style={{ padding: "8px 14px", flexShrink: 0 }}
              onClick={() => void searchMods()}
              disabled={isBusy.search}
            >
              {isBusy.search ? <span className="search-spinner" /> : "Search"}
            </button>
          </div>

          <div
            className={statusClass(statuses.mods.tone)}
            style={{ flexShrink: 0 }}
          >
            {isPopularView
              ? "Most popular mods (by followers)"
              : statuses.mods.text}
          </div>

          <div className="add-mods-search-results">
            {isLoadingPopular ? (
              <p className="hint" style={{ margin: 0 }}>
                Loading popular mods...
              </p>
            ) : displayResults.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                {localQuery
                  ? "No results. Try a different query."
                  : "Search for a mod to get started."}
              </p>
            ) : (
              displayResults.map((result) => {
                const dep = dependencyMap[result.projectId];
                const inCart = cartIds.has(result.projectId);
                const installed = installedIds.has(result.projectId);
                return (
                  <div
                    key={result.projectId}
                    className={`search-result-card${inCart ? " in-cart" : ""}${installed ? " already-installed" : ""}`}
                  >
                    <img
                      src={result.iconUrl || "https://modrinth.com/favicon.ico"}
                      alt={result.title}
                      className="search-result-icon"
                      onError={(event) => {
                        event.currentTarget.src =
                          "https://modrinth.com/favicon.ico";
                      }}
                    />
                    <div className="search-result-info">
                      <div className="search-result-name">
                        <a
                          href={`https://modrinth.com/mod/${result.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="modrinth-title-link"
                          title="View on Modrinth"
                        >
                          {result.title}
                          <ExternalLinkIcon />
                        </a>
                      </div>
                      <div className="search-result-sub">
                        {result.author ? <span>by {result.author}</span> : null}
                        {result.latestVersion ? (
                          <span>{result.latestVersion}</span>
                        ) : null}
                        {dep ? (
                          dep.requiresDependencies ? (
                            <span className="dep-badge has-deps">
                              +{dep.dependencyDetails.length} deps
                            </span>
                          ) : (
                            <span className="dep-badge no-deps">No deps</span>
                          )
                        ) : null}
                        {installed ? (
                          <span style={{ color: "var(--success)" }}>
                            Installed
                          </span>
                        ) : null}
                        {inCart && !installed ? (
                          <span style={{ color: "var(--brand-primary)" }}>
                            In cart
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      {installed ? (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Installed
                        </span>
                      ) : inCart ? (
                        <button
                          type="button"
                          className="btn danger"
                          style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                          onClick={() => removeFromCart(result.projectId)}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                          onClick={() => void addToCart(result)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="add-mods-cart-pane">
          <div className="add-mods-cart-title">
            Queue
            {cart.length > 0 ? (
              <span className="cart-count-badge">{cart.length}</span>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <span style={{ fontSize: "2rem" }}>🧺</span>
              <span>Add mods from search to queue them for install.</span>
            </div>
          ) : (
            <div className="add-mods-cart-list">
              {cart.map((entry) => (
                <div key={entry.projectId} className="cart-item">
                  <img
                    src={entry.iconUrl || "https://modrinth.com/favicon.ico"}
                    alt={entry.title}
                    className="cart-item-icon"
                    onError={(event) => {
                      event.currentTarget.src =
                        "https://modrinth.com/favicon.ico";
                    }}
                  />
                  <div className="cart-item-info" style={{ minWidth: 0 }}>
                    <div className="cart-item-name">
                      <a
                        href={`https://modrinth.com/mod/${entry.slug ?? entry.projectId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="modrinth-title-link"
                        title="View on Modrinth"
                      >
                        {entry.title}
                        <ExternalLinkIcon />
                      </a>
                    </div>
                    {entry.deps.length > 0 ? (
                      <div className="cart-item-deps">
                        +{entry.deps.length} deps
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ padding: "3px 7px", fontSize: "0.7rem" }}
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
      </div>

      <div className="add-mods-footer">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {cart.length > 0 ? (
            <button
              type="button"
              className="btn ghost"
              style={{ color: "var(--danger)" }}
              onClick={clearCart}
            >
              Clear All
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn"
          disabled={cart.length === 0 || isBusy.install}
          onClick={() => onInstall(cart)}
        >
          {isBusy.install
            ? "Installing..."
            : `Install ${cart.length > 0 ? `${String(cart.length)} mod${cart.length !== 1 ? "s" : ""}` : "queue"}`}
        </button>
      </div>
    </ModalShell>
  );
}

function ModGridCardItem({
  mod,
  index = 0,
  selectedModKeys,
  setSelectedModKeys,
  setRemoveTarget,
  coreModPolicy,
  exaroton,
  modVersionOptions,
  actions,
}: {
  mod: AdminMod;
  index: number;
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

  return (
    <div
      className={`mod-grid-card${isLocked ? " core-mod" : ""}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {!isLocked ? (
        <label className="mod-card-check">
          <input
            type="checkbox"
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
      {isLocked ? (
        <span
          className="lock-badge mod-grid-badge"
          style={{ fontSize: "0.6rem", padding: "1px 6px" }}
        >
          Core
        </span>
      ) : null}
      <img
        src={
          mod.iconUrl ||
          (mod.projectId
            ? `https://cdn.modrinth.com/data/${mod.projectId}/icon.png`
            : "https://modrinth.com/favicon.ico")
        }
        alt={mod.name}
        className="mod-grid-icon"
        onError={(event) => {
          event.currentTarget.src = "https://modrinth.com/favicon.ico";
        }}
      />
      <div className="mod-grid-name">{mod.name}</div>
      {mod.versionId ? (
        <div className="mod-grid-meta" title={mod.versionId}>
          {mod.versionId}
        </div>
      ) : null}
      {mod.slug ? (
        <a
          href={`https://modrinth.com/mod/${mod.slug}`}
          target="_blank"
          rel="noreferrer"
          className="modrinth-link"
          title="View on Modrinth"
          style={{ marginBottom: 2 }}
        >
          <ExternalLinkIcon />
        </a>
      ) : null}
      <div className="mod-grid-actions">
        {exaroton.connected ? (
          <select
            value={mod.side || (isFabric ? "both" : "client")}
            style={{
              fontSize: "0.72rem",
              padding: "3px 6px",
              width: "100%",
              marginBottom: 4,
            }}
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
              <option value="client">User</option>
            ) : (
              <>
                <option value="client">User</option>
                <option value="both">User + Server</option>
                <option value="server">Server</option>
              </>
            )}
          </select>
        ) : null}

        {projectId ? (
          <>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: "4px 8px", fontSize: "0.72rem" }}
              onClick={() => void actions.loadModVersions(projectId)}
              disabled={isLocked}
            >
              Versions
            </button>
            {versions.length > 0 ? (
              <select
                value={selectedVersion}
                style={{
                  fontSize: "0.72rem",
                  padding: "3px 6px",
                  width: "100%",
                  marginTop: 2,
                }}
                onChange={(event) =>
                  void actions.applyModVersion(
                    projectId,
                    event.currentTarget.value,
                  )
                }
                disabled={isLocked}
              >
                <option value="">Select version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} ({version.versionType})
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="btn danger"
          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
          disabled={isLocked}
          onClick={() =>
            setRemoveTarget({ projectId, sha256: mod.sha256, name: mod.name })
          }
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function ModManagerPage() {
  const { saveDraft } = useTopBarModel();
  const {
    exaroton,
    modVersionOptions,
    coreModPolicy,
    selectedMods,
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

  const [showAddMods, setShowAddMods] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<"client" | "server" | "both">(
    "both",
  );
  const [selectedModKeys, setSelectedModKeys] = useState<Set<string>>(
    new Set(),
  );
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string;
    sha256: string;
    name: string;
  } | null>(null);

  const coreMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          mod.projectId &&
          coreModPolicy.lockedProjectIds.includes(mod.projectId),
      ),
    [selectedMods, coreModPolicy],
  );
  const userMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          !(
            mod.projectId &&
            coreModPolicy.lockedProjectIds.includes(mod.projectId)
          ),
      ),
    [selectedMods, coreModPolicy],
  );
  const selectableMods = useMemo(
    () =>
      selectedMods.filter(
        (mod) =>
          !coreModPolicy.nonRemovableProjectIds.includes(mod.projectId ?? ""),
      ),
    [selectedMods, coreModPolicy],
  );
  const allSelectableSelected =
    selectableMods.length > 0 &&
    selectableMods.every((mod) =>
      selectedModKeys.has(mod.projectId || mod.sha256),
    );
  const selectedBulkEntries = useMemo(
    () =>
      selectedMods
        .filter((mod) => selectedModKeys.has(mod.projectId || mod.sha256))
        .map((mod) => ({ projectId: mod.projectId, sha256: mod.sha256 })),
    [selectedModKeys, selectedMods],
  );

  return (
    <>
      <section className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Installed Mods</h3>
            <p className="hint" style={{ margin: "4px 0 0" }}>
              {selectedMods.length} mod{selectedMods.length !== 1 ? "s" : ""}{" "}
              installed
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {exaroton.connected ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => void syncExarotonMods()}
                style={{ flexShrink: 0 }}
              >
                Sync Server Mods
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => setShowAddMods(true)}
              style={{ flexShrink: 0 }}
            >
              + Add Mods
            </button>
          </div>
        </div>

        <div className={statusClass(statuses.mods.tone)}>
          {statuses.mods.text}
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <label className="check">
            <input
              type="checkbox"
              checked={allSelectableSelected}
              onChange={(event) => {
                if (!event.currentTarget.checked) {
                  setSelectedModKeys(new Set());
                  return;
                }
                setSelectedModKeys(
                  new Set(
                    selectableMods.map((mod) => mod.projectId || mod.sha256),
                  ),
                );
              }}
            />
            <span>Select all editable mods</span>
          </label>

          {selectedBulkEntries.length > 0 ? (
            <div className="row" style={{ gap: 8 }}>
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
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  >
                    <option value="client">Bulk: User</option>
                    <option value="both">Bulk: User + Server</option>
                    <option value="server">Bulk: Server</option>
                  </select>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      setModsInstallTargetBulk(selectedBulkEntries, bulkTarget)
                    }
                  >
                    Apply Target
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  removeModsBulk(selectedBulkEntries);
                  setSelectedModKeys(new Set());
                }}
              >
                Delete Selected
              </button>
            </div>
          ) : null}
        </div>

        {selectedMods.length === 0 ? (
          <p className="hint" style={{ marginTop: 16 }}>
            No mods installed. Click &quot;Add Mods&quot; to get started.
          </p>
        ) : (
          <>
            {userMods.length > 0 ? (
              <>
                <div className="mods-section-label">
                  User Mods — {userMods.length}
                </div>
                <div className="mods-grid">
                  {userMods.map((mod, index) => (
                    <ModGridCardItem
                      key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                      mod={mod}
                      index={index}
                      selectedModKeys={selectedModKeys}
                      setSelectedModKeys={setSelectedModKeys}
                      setRemoveTarget={setRemoveTarget}
                      coreModPolicy={coreModPolicy}
                      exaroton={exaroton}
                      modVersionOptions={modVersionOptions}
                      actions={{
                        setModInstallTarget,
                        loadModVersions,
                        applyModVersion,
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {coreMods.length > 0 ? (
              <>
                <div className="mods-section-label core">
                  Core Mods — {coreMods.length}
                </div>
                <div className="mods-grid" style={{ marginBottom: 28 }}>
                  {coreMods.map((mod, index) => (
                    <ModGridCardItem
                      key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                      mod={mod}
                      index={index}
                      selectedModKeys={selectedModKeys}
                      setSelectedModKeys={setSelectedModKeys}
                      setRemoveTarget={setRemoveTarget}
                      coreModPolicy={coreModPolicy}
                      exaroton={exaroton}
                      modVersionOptions={modVersionOptions}
                      actions={{
                        setModInstallTarget,
                        loadModVersions,
                        applyModVersion,
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
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

      {removeTarget ? (
        <ModalShell onClose={() => setRemoveTarget(null)}>
          <div
            className="modal-head"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ margin: 0 }}>Remove {removeTarget.name}?</h3>
            <button
              className="modal-close-icon"
              type="button"
              aria-label="Close"
              onClick={() => setRemoveTarget(null)}
            >
              ✕
            </button>
          </div>
          <p className="warning">
            This mod will be removed from the profile draft. This change
            requires a publish to apply to users.
          </p>
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 8 }}
          >
            <button
              className="btn ghost"
              type="button"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                removeMod(removeTarget.projectId, removeTarget.sha256);
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
