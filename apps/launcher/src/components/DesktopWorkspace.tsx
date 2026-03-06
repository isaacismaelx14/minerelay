import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";
import { ServerControlBar } from "./ServerControlBar";

export function DesktopWorkspace({
  core,
}: {
  core: ReturnType<typeof useAppCore>;
}) {
  const {
    APP_NAME,
    SERVER_ID,
    catalog,
    sessionStatus,
    activeView,
    setActiveView,
    lastCheckAt,
    nextCheckAt,
    versionReadiness,
    launcherUpdate,
    launcherAppVersion,
    canRenderLogo,
    markLogoAsBroken,
    serverInitial,
    returnToMainWindow,
    sourceLabel,
    screen,
    isChecking,
    sessionActive,
    hasFancyMenuMod,
    fancyMenuMode,
    hasFancyMenuCustomBundle,
    settings,
    instance,
    saveSettings,
    refreshVersionReadiness,
    profileSourceDraft,
    setProfileSourceDraft,
    saveProfileSource,
    updateLauncherSelection,
    launchers,
    updateCustomPath,
    pickManualLauncherFromSettings,
    pickMinecraftRootFromSettings,
    runSyncCycle,
    launcherUpdateNotice,
    isCheckingLauncherUpdate,
    isInstallingLauncherUpdate,
    checkLauncherUpdate,
    installLauncherUpdate,
    isPlaying,
    sync,
    hasSyncTotal,
    progressPercent,
    syncHasUnknownTotal,
    syncBytesLabel,
    hint,
    error,
    isApiSourceMode,
    launcherServerControls,
    isServerActionBusy,
    runLauncherServerAction,
  } = core;
  const serverControlReady = Boolean(
    launcherServerControls?.enabled &&
    !launcherServerControls.reason &&
    launcherServerControls.permissions.canViewStatus,
  );

  const renderPrimary = () => {
    if (screen === "booting") {
      return (
        <div className="status-block">
          <h2>Checking Server State</h2>
          <p>
            Loading remote profile lock, comparing local manifest, and
            evaluating updates.
          </p>
        </div>
      );
    }

    if (screen === "syncing") {
      return (
        <div className="status-block">
          <h2>Applying Sync</h2>
          <p>{sync.currentFile ?? sync.phase}</p>
          <div
            className="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasSyncTotal ? progressPercent : undefined}
            aria-valuetext={
              syncHasUnknownTotal
                ? "Download progress total unknown"
                : undefined
            }
          >
            <div
              className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
              style={{
                width: syncHasUnknownTotal ? "30%" : `${progressPercent}%`,
              }}
            />
          </div>
          <div className="metrics-row">
            <span>{syncBytesLabel}</span>
            <span>{bytesToHuman(sync.speedBps)}/s</span>
            <span>ETA {formatEta(sync.etaSec)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="status-block">
        <div className="status-title-row">
          <h2>
            {sessionStatus.phase === "playing"
              ? "Playing"
              : catalog?.hasUpdates
                ? "Updates Detected"
                : "Instance Up to Date"}
          </h2>
          {isApiSourceMode && launcherServerControls ? (
            <div className="status-title-control">
              <ServerControlBar
                launcherServerControls={launcherServerControls}
                isServerActionBusy={isServerActionBusy}
                runLauncherServerAction={runLauncherServerAction}
              />
            </div>
          ) : null}
        </div>
        <p>
          {sessionActive
            ? `Live session active in ${sessionStatus.liveMinecraftDir ?? "Minecraft directory"}.`
            : catalog?.hasUpdates
              ? "New server changes were detected. Auto-sync runs every 30 minutes while this app is open."
              : "All mods/resourcepacks/shaders/configs match server profile."}
        </p>
        {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
          <p className="wizard-meta" style={{ color: "#b84e4e" }}>
            Profile has no FancyMenu mod. Play-only menu customization will not
            be active.
          </p>
        ) : null}
        {catalog?.fancyMenuEnabled &&
        hasFancyMenuMod &&
        fancyMenuMode === "custom" &&
        !hasFancyMenuCustomBundle ? (
          <p className="wizard-meta" style={{ color: "#b84e4e" }}>
            FancyMenu custom mode is enabled, but the custom bundle is missing.
          </p>
        ) : null}
        {isChecking ? (
          <p className="wizard-meta">Checking server changes...</p>
        ) : null}

        <ul className="summary-grid">
          <li>
            <strong>{catalog?.summary.add ?? 0}</strong>
            <span>Add</span>
          </li>
          <li>
            <strong>{catalog?.summary.remove ?? 0}</strong>
            <span>Remove</span>
          </li>
          <li>
            <strong>{catalog?.summary.update ?? 0}</strong>
            <span>Update</span>
          </li>
          <li>
            <strong>{catalog?.summary.keep ?? 0}</strong>
            <span>Keep</span>
          </li>
        </ul>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Server Profile</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Endpoint</span>
                <div className="data-value">
                  {catalog?.serverAddress ?? "--"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Source</span>
                <div className="data-value">{sourceLabel}</div>
              </div>
            </div>
          </section>

          <section className="panel-card">
            <h3>Environment</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Active Launcher</span>
                <div className="data-value">
                  {settings?.selectedLauncherId ?? "--"}
                </div>
              </div>

              <details className="advanced-options">
                <summary className="advanced-summary">Technical Paths</summary>
                <div
                  className="advanced-content"
                  style={{ display: "grid", gap: "var(--space-2)" }}
                >
                  <div className="data-item">
                    <span className="data-label">Live Minecraft</span>
                    <div className="data-value">
                      {versionReadiness?.liveMinecraftRoot ?? "--"}
                    </div>
                  </div>
                  <div className="data-item">
                    <span className="data-label">Managed Sync</span>
                    <div className="data-value">
                      {instance?.minecraftDir ?? "--"}
                    </div>
                  </div>
                  {settings?.customLauncherPath && (
                    <div className="data-item">
                      <span className="data-label">Custom Bin Path</span>
                      <div className="data-value">
                        {settings.customLauncherPath}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </section>

          <section className="panel-card">
            <h3>Mods ({catalog?.mods.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.mods ?? []).map((item) => (
                <span key={item} className="overview-chip">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Resourcepacks ({catalog?.resourcepacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.resourcepacks ?? []).map((item) => (
                <span key={item} className="overview-chip">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Shaders ({catalog?.shaderpacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.shaderpacks ?? []).map((item) => (
                <span key={item} className="overview-chip">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Configs ({catalog?.configs.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.configs ?? []).map((item) => (
                <span key={item} className="overview-chip">
                  {item}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderSourcePaths = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Source & Paths</h2>
          <p className="pane-subtitle">
            Configure profile source, launcher executable, and live Minecraft
            root.
          </p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Profile Source</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">API Endpoint</span>
                <input
                  className="input"
                  type="text"
                  value={profileSourceDraft.apiBaseUrl}
                  placeholder="https://api.example.com"
                  onChange={(event) =>
                    setProfileSourceDraft((current) => ({
                      ...current,
                      apiBaseUrl: event.target.value,
                    }))
                  }
                />
              </div>

              <details
                className="advanced-options"
                open={!!profileSourceDraft.profileLockUrl || undefined}
              >
                <summary className="advanced-summary">
                  Advanced: Direct Lock URL
                </summary>
                <div
                  className="advanced-content"
                  style={{ display: "grid", gap: "var(--space-2)" }}
                >
                  <p
                    className="pane-subtitle"
                    style={{ margin: 0, fontSize: "0.75rem" }}
                  >
                    Optional. Override the API and fetch the modpack directly
                    from a URL. Useful for static hosting or testing unreleased
                    versions.
                  </p>
                  <input
                    className="input"
                    type="text"
                    value={profileSourceDraft.profileLockUrl}
                    placeholder="https://example.com/lock.json"
                    onChange={(event) =>
                      setProfileSourceDraft((current) => ({
                        ...current,
                        profileLockUrl: event.target.value,
                      }))
                    }
                  />
                </div>
              </details>

              <button
                className="btn primary"
                onClick={() => void saveProfileSource()}
              >
                Save Source
              </button>
            </div>
          </section>

          {isApiSourceMode ? (
            <section className="panel-card">
              <h3>Server Control Pairing</h3>
              {serverControlReady ? (
                <div className="data-list">
                  <div className="data-item">
                    <span className="data-label">Pairing Status</span>
                    <div className="data-value">Ready</div>
                  </div>
                  <p className="pane-subtitle">
                    This installation is already paired for server control.
                  </p>
                </div>
              ) : (
                <>
                  <p className="pane-subtitle">
                    Pairing is pending. Ask the admin for a one-time pairing
                    code and save it here.
                  </p>
                  <div className="data-list">
                    <div className="data-item">
                      <span className="data-label">Pairing Code</span>
                      <input
                        className="input"
                        type="text"
                        value={profileSourceDraft.pairingCode}
                        placeholder="ABCD2345"
                        onChange={(event) =>
                          setProfileSourceDraft((current) => ({
                            ...current,
                            pairingCode: event.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() => void saveProfileSource()}
                    >
                      Save Pairing Code
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          <section className="panel-card">
            <h3>Launcher</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Application</span>
                <select
                  className="select"
                  value={settings?.selectedLauncherId ?? ""}
                  onChange={(event) =>
                    void updateLauncherSelection(event.target.value)
                  }
                >
                  <option value="">No launcher selected</option>
                  {launchers
                    .filter((candidate) => candidate.id !== "custom")
                    .map((candidate) => (
                      <option
                        key={`${candidate.id}:${candidate.path}`}
                        value={candidate.id}
                      >
                        {candidate.name}
                      </option>
                    ))}
                  <option value="custom">Custom path</option>
                </select>
              </div>

              {settings?.selectedLauncherId === "custom" ? (
                <div className="data-item">
                  <span className="data-label">Custom Bin Path</span>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <input
                      className="input"
                      type="text"
                      value={settings.customLauncherPath ?? ""}
                      placeholder="/Applications/Minecraft.app or C:\\...\\MinecraftLauncher.exe"
                      onChange={(event) =>
                        void updateCustomPath(event.target.value)
                      }
                    />
                    <button
                      className="btn ghost"
                      onClick={() => void pickManualLauncherFromSettings()}
                    >
                      Pick Launcher Path
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel-info-box">
                  <p
                    className="small-dark"
                    style={{ margin: 0, fontSize: "0.8rem" }}
                  >
                    Choosing a managed launcher (like Prism) allows the app to
                    automatically discover your instance directories and handle
                    icon sync.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="panel-card">
            <h3>Paths</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Sync Base Root</span>
                <div className="data-value">
                  {instance?.instanceRoot ?? "--"}
                </div>
              </div>

              <div className="data-item">
                <span className="data-label">Managed Game Dir</span>
                <div className="data-value">
                  {instance?.minecraftDir ?? "--"}
                </div>
              </div>

              <div className="data-item">
                <span className="data-label">Live Game Dir</span>
                <div className="data-value">
                  {versionReadiness?.liveMinecraftRoot ?? "--"}
                </div>
              </div>

              <details className="advanced-options">
                <summary className="advanced-summary">
                  Advanced: Override Live Directory
                </summary>
                <div
                  className="advanced-content"
                  style={{ display: "grid", gap: "var(--space-2)" }}
                >
                  <p
                    className="pane-subtitle"
                    style={{
                      fontSize: "0.75rem",
                      marginBottom: "8px",
                      marginTop: 0,
                    }}
                  >
                    By default, the sync tool targets the standard data folder
                    of your chosen launcher. Specify an absolute path below to
                    force a different live directory.
                  </p>
                  <input
                    className="input"
                    type="text"
                    value={settings?.minecraftRootOverride ?? ""}
                    placeholder="Leave empty for default launcher dir"
                    onChange={(event) =>
                      settings
                        ? void saveSettings({
                            ...settings,
                            minecraftRootOverride:
                              event.target.value.trim() || null,
                          })
                        : undefined
                    }
                  />
                  <div className="actions-row">
                    <button
                      className="btn ghost"
                      onClick={() => void pickMinecraftRootFromSettings()}
                    >
                      Pick Dir
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => void refreshVersionReadiness()}
                    >
                      Refresh
                    </button>
                  </div>
                  <p
                    className="small-dark"
                    style={{ fontSize: "0.7rem", marginTop: "4px" }}
                  >
                    Ready:{" "}
                    {versionReadiness?.foundInMinecraftRootDir ? "YES" : "NO"} |
                    Allowlisted: {versionReadiness?.allowlisted ? "YES" : "NO"}
                  </p>
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderCatalogPane = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Catalog</h2>
          <p className="pane-subtitle">
            Managed content inventory and lockfile version alignment.
          </p>
        </div>
        <div className="pane-grid">
          <section className="panel-card">
            <h3>Content Totals</h3>
            <ul className="summary-grid">
              <li>
                <strong>{catalog?.mods.length ?? 0}</strong>
                <span>Mods</span>
              </li>
              <li>
                <strong>{catalog?.resourcepacks.length ?? 0}</strong>
                <span>Resourcepacks</span>
              </li>
              <li>
                <strong>{catalog?.shaderpacks.length ?? 0}</strong>
                <span>Shaders</span>
              </li>
              <li>
                <strong>{catalog?.configs.length ?? 0}</strong>
                <span>Configs</span>
              </li>
            </ul>
          </section>

          <section className="panel-card">
            <h3>Lock Versions</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Installed Version</span>
                <div className="data-value">
                  {instance?.installedVersion ?? "none"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Remote Lock</span>
                <div className="data-value">
                  {catalog?.profileVersion ?? "--"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Local Snapshot</span>
                <div className="data-value">
                  {catalog?.localVersion ?? "--"}
                </div>
              </div>
            </div>
          </section>

          <section className="panel-card">
            <h3>Runtime Targets</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Loader</span>
                <div className="data-value">
                  {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Minecraft</span>
                <div className="data-value">
                  {catalog?.minecraftVersion ?? "--"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Allowlisted Versions</span>
                <div className="data-value">
                  {versionReadiness?.allowedMinecraftVersions.join(", ") ||
                    "--"}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderActivityPane = () => {
    return (
      <div className="workspace-pane">
        <div className="pane-head">
          <h2>Activity</h2>
          <p className="pane-subtitle">
            Sync schedule, telemetry, and operator messages.
          </p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Schedule</h3>
            <div className="data-list">
              <div className="panel-info-box">
                <p
                  className="small-dark"
                  style={{ margin: 0, fontSize: "0.8rem" }}
                >
                  Auto-apply every 30 minutes while the app is open.
                </p>
              </div>
              <div className="data-item">
                <span className="data-label">Last Check</span>
                <div className="data-value">{formatTime(lastCheckAt)}</div>
              </div>
              <div className="data-item">
                <span className="data-label">Next Check</span>
                <div className="data-value">{formatTime(nextCheckAt)}</div>
              </div>
              <button
                className="btn ghost"
                onClick={() => void runSyncCycle(true)}
                disabled={sessionActive}
              >
                Run Check + Auto Apply
              </button>
            </div>
          </section>

          <section className="panel-card">
            <h3>Launcher Updates</h3>
            <div className="data-list">
              <div className="data-item">
                <span className="data-label">Current Version</span>
                <div className="data-value">
                  {launcherUpdate?.currentVersion ?? "--"}
                </div>
              </div>
              <div className="data-item">
                <span className="data-label">Status</span>
                <div className="data-value">
                  {launcherUpdate?.available
                    ? "Update available"
                    : launcherUpdate
                      ? "Up to date"
                      : "Not checked"}
                </div>
              </div>
              {launcherUpdate?.available && (
                <div className="data-item">
                  <span className="data-label">Latest Release</span>
                  <div className="data-value">
                    {launcherUpdate.latestVersion}
                  </div>
                </div>
              )}
              <p
                className="small-dark"
                style={{ fontSize: "0.75rem", marginTop: "4px" }}
              >
                {launcherUpdateNotice ??
                  "Updater checks run at startup and every 30 minutes."}
              </p>
              <div className="actions-row">
                <button
                  className="btn ghost"
                  onClick={() => void checkLauncherUpdate(false)}
                  disabled={
                    isCheckingLauncherUpdate || isInstallingLauncherUpdate
                  }
                >
                  {isCheckingLauncherUpdate ? "Checking..." : "Check Updates"}
                </button>
                {launcherUpdate?.available ? (
                  <button
                    className="btn ghost"
                    onClick={() =>
                      void installLauncherUpdate(
                        launcherUpdate.latestVersion ?? undefined,
                      )
                    }
                    disabled={isInstallingLauncherUpdate || isPlaying}
                  >
                    {isInstallingLauncherUpdate
                      ? "Installing..."
                      : "Download & Install"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel-card">
            <h3>Current Session</h3>
            <p className="small-dark">
              Phase: {sessionStatus.phase.replaceAll("_", " ")}
            </p>
            <p className="small-dark">
              Live dir: {sessionStatus.liveMinecraftDir ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Current Transfer</h3>
            <p className="small-dark">{sync.currentFile ?? sync.phase}</p>
            <div
              className="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hasSyncTotal ? progressPercent : undefined}
              aria-valuetext={
                syncHasUnknownTotal
                  ? "Download progress total unknown"
                  : undefined
              }
            >
              <div
                className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
                style={{
                  width: syncHasUnknownTotal ? "30%" : `${progressPercent}%`,
                }}
              />
            </div>
            <div className="metrics-row">
              <span>{syncBytesLabel}</span>
              <span>{bytesToHuman(sync.speedBps)}/s</span>
              <span>ETA {formatEta(sync.etaSec)}</span>
            </div>
          </section>

          <section className="panel-card">
            <h3>Messages</h3>
            <p className="small-dark">{hint ?? "No recent hints."}</p>
            <p className="small-dark">{error ?? "No active errors."}</p>
          </section>
        </div>
      </div>
    );
  };

  const renderWorkspace = () => {
    if (activeView === "sourcePaths") return renderSourcePaths();
    if (activeView === "catalog") return renderCatalogPane();
    if (activeView === "activity") return renderActivityPane();
    return renderPrimary();
  };

  return (
    <main className="desktop-shell">
      <aside className="desktop-nav">
        <div className="nav-brand">
          <p className="eyebrow">Desktop Sync Console</p>
          <h1>{APP_NAME}</h1>
          <p className="small-dark">Source: {sourceLabel}</p>
        </div>

        <nav className="nav-groups" aria-label="Workspace sections">
          <button
            className={
              activeView === "overview" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveView("overview")}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Overview</span>
          </button>
          <button
            className={
              activeView === "sourcePaths" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveView("sourcePaths")}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
            <span>Source & Paths</span>
          </button>
          <button
            className={
              activeView === "catalog" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveView("catalog")}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 8V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"></path>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
            <span>Catalog</span>
          </button>
          <button
            className={
              activeView === "activity" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveView("activity")}
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span>Activity</span>
          </button>
        </nav>

        <section className="nav-status">
          <p className="small-dark">Last check: {formatTime(lastCheckAt)}</p>
          <p className="small-dark">Next check: {formatTime(nextCheckAt)}</p>
          <p className="small-dark">
            Runtime:{" "}
            {versionReadiness?.foundInMinecraftRootDir
              ? "configured"
              : "pending"}
          </p>
          <p className="small-dark">
            Lock drift: {catalog?.hasUpdates ? "detected" : "none"}
          </p>
          <p className="small-dark">
            App update:{" "}
            {launcherUpdate?.available
              ? `v${launcherUpdate.latestVersion ?? "new"} ready`
              : "none"}
          </p>
          <p className="small-dark">
            Launcher version: v{launcherAppVersion ?? "--"}
          </p>
          <p className="small-dark">
            Session: {sessionStatus.phase.replaceAll("_", " ")}
          </p>
          {sessionStatus.liveMinecraftDir ? (
            <p className="small-dark">
              Playing dir: {sessionStatus.liveMinecraftDir}
            </p>
          ) : null}
        </section>
      </aside>

      <section className="desktop-workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            {canRenderLogo ? (
              <img
                className="server-logo"
                src={catalog?.logoUrl}
                alt={`${catalog?.serverName ?? SERVER_ID} logo`}
                onError={() => markLogoAsBroken(catalog?.logoUrl)}
              />
            ) : (
              <img
                className="server-logo"
                src="/minerelay-logo.svg"
                alt={`${APP_NAME} logo`}
              />
            )}
            <div>
              <span className="eyebrow">MineRelay</span>
              <h2>{catalog?.serverName ?? `Server ${SERVER_ID}`}</h2>
              {sessionStatus.phase === "playing" ? (
                <p className="playing-status">
                  Playing in{" "}
                  {sessionStatus.liveMinecraftDir ?? "Minecraft directory"}
                </p>
              ) : null}
            </div>
          </div>
          <div className="workspace-header-actions">
            <div className="version-pill">
              v{launcherAppVersion ?? "--"} | {catalog?.loader ?? "fabric"}{" "}
              {catalog?.loaderVersion ?? "--"} | MC{" "}
              {catalog?.minecraftVersion ?? "--"}
            </div>
            <button
              className="btn ghost"
              onClick={() => void returnToMainWindow()}
            >
              Back to Launcher
            </button>
          </div>
        </header>

        {renderWorkspace()}
      </section>
    </main>
  );
}
