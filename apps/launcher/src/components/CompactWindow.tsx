import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";

export function CompactWindow({ core }: { core: ReturnType<typeof useAppCore> }) {
  const {
    APP_NAME, SERVER_ID, catalog, sessionStatus, lastCheckAt, isChecking,
    canRenderLogo, markLogoAsBroken, serverInitial, compactPlaying,
    runSyncCycle, openLauncherFromCompact, openSetupWindow, cancelSession,
    settings, launchers, updateLauncherSelection,
    isApiSourceMode, launcherServerControls, isServerActionBusy, runLauncherServerAction
  } = core;

    const compactHasServerInfo = catalog !== null;
    const compactNeedsConnect = !compactHasServerInfo;
    const isAwaiting = sessionStatus.phase === "awaiting_game_start";
    const statusTitle = isAwaiting
      ? "Awaiting Launch"
      : compactPlaying
      ? "Playing"
      : compactNeedsConnect
        ? "Disconnected"
        : "Ready";
    const statusSubtitle = isAwaiting
      ? "Waiting for the game process to be detected..."
      : compactPlaying
      ? "Game session is currently active."
      : compactNeedsConnect
        ? "Server info unavailable. Connect to refresh profile data."
        : `Server ${catalog?.serverName ?? SERVER_ID} is synced and ready.`;
    const canRenderLauncherStatus =
      isApiSourceMode &&
      launcherServerControls !== null &&
      launcherServerControls.permissions.canViewStatus;
    const compactServerStatusToneClass = (() => {
      if (!launcherServerControls?.enabled) {
        return "is-disabled";
      }

      const status = launcherServerControls.selectedServer?.status;
      if (status === 1) return "is-online";
      if (status === 0) return "is-offline";
      if (status === 7) return "is-error";
      if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status ?? -1)) return "is-busy";
      return "is-unknown";
    })();
    const launcherServerStatus = launcherServerControls?.selectedServer?.status;
    const disableStartByStatus = [1, 2, 3, 4, 6].includes(launcherServerStatus ?? -1);
    const disableStopByStatus = [0, 2, 3, 4, 6].includes(launcherServerStatus ?? -1);
    const disableRestartByStatus = [0, 2, 3, 4, 6].includes(launcherServerStatus ?? -1);

    return (
      <main className="compact-shell">
        <div className="compact-frame">
          <header className="compact-head">
            <div className="compact-server-row">
              {canRenderLogo ? (
                <img
                  className="compact-server-logo"
                  src={catalog?.logoUrl}
                  alt={`${catalog?.serverName ?? SERVER_ID} logo`}
                  onError={() => markLogoAsBroken(catalog?.logoUrl)}
                />
              ) : (
                <div className="compact-server-logo logo-fallback" aria-hidden="true">
                  {serverInitial}
                </div>
              )}
              <div className="compact-server-meta">
                <div className="compact-app-row">
                  <p className="compact-app">{APP_NAME}</p>
                  {settings && launchers.length > 0 && (
                    <select
                      className="select compact-launcher-select"
                      value={settings?.selectedLauncherId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        void updateLauncherSelection(value);
                        if (value === "custom") {
                          void openSetupWindow();
                        }
                      }}
                    >
                      <option value="">Select Launcher</option>
                      {launchers
                        .filter((candidate) => candidate.id !== "custom")
                        .map((candidate) => (
                          <option key={`${candidate.id}:${candidate.path}`} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      <option value="custom">Custom path...</option>
                    </select>
                  )}
                </div>
                <p className="compact-server" title={catalog?.serverName ?? `Server ${SERVER_ID}`}>
                  {catalog?.serverName ?? `Server ${SERVER_ID}`}
                </p>
                <p className="compact-version" title={`MC ${catalog?.minecraftVersion ?? "--"} · ${catalog?.loader ?? "fabric"} ${catalog?.loaderVersion ?? "--"}`}>
                  MC {catalog?.minecraftVersion ?? "--"} · {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
                </p>
              </div>
            </div>
          </header>

          <section className={`compact-core${isAwaiting ? " is-awaiting" : compactPlaying ? " is-playing" : compactNeedsConnect ? " is-disconnected" : " is-ready"}`}>
            <div className="compact-main-content">
              <div className="status-header">
                <span className="status-dot"></span>
                <h2>{statusTitle}</h2>
              </div>
              <p>{statusSubtitle}</p>
              <div className="actions-row compact-actions">
                {isAwaiting ? (
                  <button
                    className="btn cancel-session"
                    onClick={() => void cancelSession()}
                  >
                    Cancel Launch
                  </button>
                ) : (
                  <button
                    className={compactNeedsConnect ? "btn connect" : "btn primary"}
                    onClick={() =>
                      compactNeedsConnect
                        ? void runSyncCycle(false)
                        : void openLauncherFromCompact()
                    }
                    disabled={compactNeedsConnect ? isChecking : compactPlaying}
                  >
                    {compactNeedsConnect
                      ? isChecking
                        ? "Connecting..."
                        : "Connect"
                      : compactPlaying
                        ? "Playing"
                        : "Play"}
                  </button>
                )}
                <button className="btn ghost" onClick={() => void openSetupWindow()}>
                  Overview
                </button>
              </div>
            </div>
            {canRenderLauncherStatus ? (
              <div className="compact-server-dock">
                <div className="compact-server-shell">
                  <span className="launcher-server-section-label compact-server-section-label">Live Server Control</span>
                  <section className="launcher-server-controls compact-server-controls">
                  <span
                    className={`launcher-server-badge ${compactServerStatusToneClass}`}
                  >
                    {launcherServerControls.selectedServer?.statusLabel ??
                      (launcherServerControls.enabled ? "Unknown" : "Unavailable")}
                  </span>

                  {launcherServerControls.permissions.canViewOnlinePlayers &&
                  launcherServerControls.selectedServer ? (
                    <span className="compact-server-online">
                      {launcherServerControls.selectedServer.players.count}/
                      {launcherServerControls.selectedServer.players.max} online
                    </span>
                  ) : null}

                  {(launcherServerControls.permissions.canStartServer ||
                    launcherServerControls.permissions.canStopServer ||
                    launcherServerControls.permissions.canRestartServer) && (
                    <div className="compact-server-icon-actions">
                      {launcherServerControls.permissions.canStartServer && (
                        <button
                          className="compact-server-icon-btn"
                          onClick={() => void runLauncherServerAction("start")}
                          disabled={isServerActionBusy || disableStartByStatus}
                          title="Start server"
                          aria-label="Start server"
                        >
                          ▶
                        </button>
                      )}
                      {launcherServerControls.permissions.canRestartServer && (
                        <button
                          className="compact-server-icon-btn"
                          onClick={() => void runLauncherServerAction("restart")}
                          disabled={isServerActionBusy || disableRestartByStatus}
                          title="Restart server"
                          aria-label="Restart server"
                        >
                          ↻
                        </button>
                      )}
                      {launcherServerControls.permissions.canStopServer && (
                        <button
                          className="compact-server-icon-btn"
                          onClick={() => void runLauncherServerAction("stop")}
                          disabled={isServerActionBusy || disableStopByStatus}
                          title="Stop server"
                          aria-label="Stop server"
                        >
                          ■
                        </button>
                      )}
                    </div>
                  )}
                </section>
                </div>
              </div>
            ) : null}
          </section>

          <section className="compact-stats">
            <article>
              <strong>{catalog?.summary.keep ?? 0}</strong>
              <span>Keep</span>
            </article>
            <article>
              <strong>{catalog?.summary.add ?? 0}</strong>
              <span>Add</span>
            </article>
            <article>
              <strong>{catalog?.summary.remove ?? 0}</strong>
              <span>Remove</span>
            </article>
            <article>
              <strong>{catalog?.summary.update ?? 0}</strong>
              <span>Update</span>
            </article>
          </section>

          <footer className="compact-foot">
            <p>Session: {sessionStatus.phase.replaceAll("_", " ")}</p>
            <p>Last check: {formatTime(lastCheckAt)}</p>
          </footer>
        </div>
      </main>
    );
}
