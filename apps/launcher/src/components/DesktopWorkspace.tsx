import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";

export function DesktopWorkspace({ core }: { core: ReturnType<typeof useAppCore> }) {
  const {
    APP_NAME, SERVER_ID, catalog, sessionStatus, activeView, setActiveView,
    lastCheckAt, nextCheckAt, versionReadiness, launcherUpdate,
    canRenderLogo, markLogoAsBroken, serverInitial, returnToMainWindow, sourceLabel,
    screen, isChecking, sessionActive, hasFancyMenuMod, fancyMenuMode, hasFancyMenuCustomBundle,
    settings, instance, saveSettings, refreshVersionReadiness,
    profileSourceDraft, setProfileSourceDraft, saveProfileSource, updateLauncherSelection,
    launchers, updateCustomPath, pickManualLauncherFromSettings, pickMinecraftRootFromSettings,
    runSyncCycle, launcherUpdateNotice, isCheckingLauncherUpdate, isInstallingLauncherUpdate,
    checkLauncherUpdate, installLauncherUpdate, isPlaying, sync, hasSyncTotal, progressPercent,
    syncHasUnknownTotal, syncBytesLabel, hint, error
  } = core;

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
              syncHasUnknownTotal ? "Download progress total unknown" : undefined
            }
          >
            <div
              className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
              style={{ width: syncHasUnknownTotal ? "30%" : `${progressPercent}%` }}
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
        <h2>
          {sessionStatus.phase === "playing"
            ? "Playing"
            : catalog?.hasUpdates
              ? "Updates Detected"
              : "Instance Up to Date"}
        </h2>
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
            <p className="small-dark">Name: {catalog?.serverName ?? "--"}</p>
            <p className="small-dark">Server URL: {catalog?.serverAddress ?? "--"}</p>
            <p className="small-dark">Source URL: {sourceLabel}</p>
            <p className="small-dark">
              Runtime target: {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC {catalog?.minecraftVersion ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Current Settings</h3>
            <p className="small-dark">Launcher: {settings?.selectedLauncherId ?? "--"}</p>
            <p className="small-dark">Custom launcher path: {settings?.customLauncherPath ?? "--"}</p>
            <p className="small-dark">Live minecraft root: {versionReadiness?.liveMinecraftRoot ?? "--"}</p>
            <p className="small-dark">Managed sync dir: {instance?.minecraftDir ?? "--"}</p>
          </section>

          <section className="panel-card">
            <h3>Mods ({catalog?.mods.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.mods ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Resourcepacks ({catalog?.resourcepacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.resourcepacks ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Shaders ({catalog?.shaderpacks.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.shaderpacks ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <h3>Configs ({catalog?.configs.length ?? 0})</h3>
            <div className="overview-list">
              {(catalog?.configs ?? []).map((item) => (
                <span key={item} className="overview-chip">{item}</span>
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
            Configure profile source, launcher executable, and live Minecraft root.
          </p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Profile Source</h3>
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
            <input
              className="input"
              type="text"
              value={profileSourceDraft.profileLockUrl}
              placeholder="Optional direct lock URL"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  profileLockUrl: event.target.value,
                }))
              }
            />
            <button className="btn primary" onClick={() => void saveProfileSource()}>
              Save Source
            </button>
          </section>

          <section className="panel-card">
            <h3>Launcher</h3>
            <select
              className="select"
              value={settings?.selectedLauncherId ?? ""}
              onChange={(event) => void updateLauncherSelection(event.target.value)}
            >
              <option value="">No launcher selected</option>
              {launchers
                .filter((candidate) => candidate.id !== "custom")
                .map((candidate) => (
                  <option key={`${candidate.id}:${candidate.path}`} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              <option value="custom">Custom path</option>
            </select>
            {settings?.selectedLauncherId === "custom" ? (
              <>
                <input
                  className="input"
                  type="text"
                  value={settings.customLauncherPath ?? ""}
                  placeholder="/Applications/Minecraft.app or C:\\...\\MinecraftLauncher.exe"
                  onChange={(event) => void updateCustomPath(event.target.value)}
                />
                <button
                  className="btn ghost"
                  onClick={() => void pickManualLauncherFromSettings()}
                >
                  Pick Launcher Path
                </button>
              </>
            ) : null}
          </section>

          <section className="panel-card">
            <h3>Live Minecraft Root</h3>
            <input
              className="input"
              type="text"
              value={settings?.minecraftRootOverride ?? ""}
              placeholder="Leave empty for default launcher dir"
              onChange={(event) =>
                settings
                  ? void saveSettings({
                      ...settings,
                      minecraftRootOverride: event.target.value.trim() || null,
                    })
                  : undefined
              }
            />
            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => void pickMinecraftRootFromSettings()}
              >
                Pick Minecraft Dir
              </button>
              <button className="btn ghost" onClick={() => void refreshVersionReadiness()}>
                Refresh Readiness
              </button>
            </div>
            <p className="small-dark">
              Readiness:{" "}
              {versionReadiness?.foundInMinecraftRootDir
                ? "runtime found"
                : "runtime missing"}
            </p>
            <p className="small-dark">
              Allowlisted: {versionReadiness?.allowlisted ? "yes" : "no"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Instance Paths</h3>
            <p className="small-dark">Root: {instance?.instanceRoot ?? "--"}</p>
            <p className="small-dark">Managed game dir: {instance?.minecraftDir ?? "--"}</p>
            <p className="small-dark">
              Live game dir: {versionReadiness?.liveMinecraftRoot ?? "--"}
            </p>
            <p className="small-dark">
              Sync writes only to managed game dir. Live Minecraft files are swapped during active play sessions.
            </p>
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
            <p className="small-dark">
              Installed lock version: {instance?.installedVersion ?? "none"}
            </p>
            <p className="small-dark">
              Remote lock version: {catalog?.profileVersion ?? "--"}
            </p>
            <p className="small-dark">
              Local lock version: {catalog?.localVersion ?? "--"}
            </p>
          </section>

          <section className="panel-card">
            <h3>Runtime Targets</h3>
            <p className="small-dark">
              {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC{" "}
              {catalog?.minecraftVersion ?? "--"}
            </p>
            <p className="small-dark">
              Allowed MC versions:{" "}
              {versionReadiness?.allowedMinecraftVersions.join(", ") || "--"}
            </p>
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
          <p className="pane-subtitle">Sync schedule, telemetry, and operator messages.</p>
        </div>

        <div className="pane-grid">
          <section className="panel-card">
            <h3>Schedule</h3>
            <p className="small-dark">
              Auto-apply every 30 minutes while the app is open.
            </p>
            <p className="small-dark">Last check: {formatTime(lastCheckAt)}</p>
            <p className="small-dark">Next check: {formatTime(nextCheckAt)}</p>
            <button
              className="btn ghost"
              onClick={() => void runSyncCycle(true)}
              disabled={sessionActive}
            >
              Run Check + Auto Apply
            </button>
          </section>

          <section className="panel-card">
            <h3>Launcher Updates</h3>
            <p className="small-dark">
              Current version: {launcherUpdate?.currentVersion ?? "--"}
            </p>
            <p className="small-dark">
              Latest release: {launcherUpdate?.latestVersion ?? "--"}
            </p>
            <p className="small-dark">
              Published: {formatDateTime(launcherUpdate?.pubDate ?? null)}
            </p>
            <p className="small-dark">
              Status:{" "}
              {launcherUpdate?.available
                ? "update available"
                : launcherUpdate
                  ? "up to date"
                  : "not checked"}
            </p>
            <p className="small-dark">
              {launcherUpdateNotice ??
                "Updater checks run at startup and every 30 minutes."}
            </p>
            {launcherUpdate?.body ? (
              <p className="small-dark">{launcherUpdate.body}</p>
            ) : null}
            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => void checkLauncherUpdate(false)}
                disabled={isCheckingLauncherUpdate || isInstallingLauncherUpdate}
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
                syncHasUnknownTotal ? "Download progress total unknown" : undefined
              }
            >
              <div
                className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
                style={{ width: syncHasUnknownTotal ? "30%" : `${progressPercent}%` }}
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
            className={activeView === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("overview")}
          >
            Overview
          </button>
          <button
            className={activeView === "sourcePaths" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("sourcePaths")}
          >
            Source & Paths
          </button>
          <button
            className={activeView === "catalog" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("catalog")}
          >
            Catalog
          </button>
          <button
            className={activeView === "activity" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveView("activity")}
          >
            Activity
          </button>
        </nav>

        <section className="nav-status">
          <p className="small-dark">Last check: {formatTime(lastCheckAt)}</p>
          <p className="small-dark">Next check: {formatTime(nextCheckAt)}</p>
          <p className="small-dark">
            Runtime:{" "}
            {versionReadiness?.foundInMinecraftRootDir ? "configured" : "pending"}
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
            Session: {sessionStatus.phase.replaceAll("_", " ")}
          </p>
          {sessionStatus.liveMinecraftDir ? (
            <p className="small-dark">Playing dir: {sessionStatus.liveMinecraftDir}</p>
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
              <div className="server-logo logo-fallback" aria-hidden="true">
                {serverInitial}
              </div>
            )}
            <div>
            <span className="eyebrow">MSS+ Client Center</span>
            <h2>{catalog?.serverName ?? `Server ${SERVER_ID}`}</h2>
            {sessionStatus.phase === "playing" ? (
              <p className="playing-status">
                Playing in {sessionStatus.liveMinecraftDir ?? "Minecraft directory"}
              </p>
            ) : null}
            </div>
          </div>
          <div className="workspace-header-actions">
            <div className="version-pill">
              {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"} | MC{" "}
              {catalog?.minecraftVersion ?? "--"}
            </div>
            <button className="btn ghost" onClick={() => void returnToMainWindow()}>
              Back to Launcher
            </button>
          </div>
        </header>

        {renderWorkspace()}
      </section>
    </main>
  );
}
