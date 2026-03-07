import { useCallback, useMemo } from "react";
import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";
import { ServerControlBar } from "./ServerControlBar";

export function CompactWindow({
  core,
}: {
  core: ReturnType<typeof useAppCore>;
}) {
  const {
    APP_NAME,
    SERVER_ID,
    catalog,
    sessionStatus,
    lastCheckAt,
    isChecking,
    launcherAppVersion,
    canRenderLogo,
    markLogoAsBroken,
    serverInitial,
    compactPlaying,
    runSyncCycle,
    openLauncherFromCompact,
    openSetupWindow,
    cancelSession,
    settings,
    launchers,
    updateLauncherSelection,
    isApiSourceMode,
    launcherServerControls,
    isServerActionBusy,
    runLauncherServerAction,
  } = core;

  const filteredLaunchers = useMemo(
    () => launchers.filter((candidate) => candidate.id !== "custom"),
    [launchers],
  );

  const handleLauncherChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      void updateLauncherSelection(value);
      if (value === "custom") {
        void openSetupWindow();
      }
    },
    [updateLauncherSelection, openSetupWindow],
  );

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
              <img
                className="compact-server-logo"
                src="/minerelay-logo.svg"
                alt={`${APP_NAME} logo`}
              />
            )}
            <div className="compact-server-meta">
              <div className="compact-app-row">
                <p className="compact-app">{APP_NAME}</p>
                {settings && launchers.length > 0 && (
                  <select
                    className="select compact-launcher-select"
                    value={settings?.selectedLauncherId ?? ""}
                    onChange={handleLauncherChange}
                  >
                    <option value="">Select Launcher</option>
                    {filteredLaunchers.map((candidate) => (
                      <option
                        key={`${candidate.id}:${candidate.path}`}
                        value={candidate.id}
                      >
                        {candidate.name}
                      </option>
                    ))}
                    <option value="custom">Custom path...</option>
                  </select>
                )}
              </div>
              <p
                className="compact-server"
                title={catalog?.serverName ?? `Server ${SERVER_ID}`}
              >
                {catalog?.serverName ?? `Server ${SERVER_ID}`}
              </p>
              <p
                className="compact-version"
                title={`App v${launcherAppVersion ?? "--"} · MC ${catalog?.minecraftVersion ?? "--"} · ${catalog?.loader ?? "fabric"} ${catalog?.loaderVersion ?? "--"}`}
              >
                App v{launcherAppVersion ?? "--"} · MC{" "}
                {catalog?.minecraftVersion ?? "--"} ·{" "}
                {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
              </p>
            </div>
          </div>
        </header>

        <section
          className={`compact-core${isAwaiting ? " is-awaiting" : compactPlaying ? " is-playing" : compactNeedsConnect ? " is-disconnected" : " is-ready"}`}
        >
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
                  className={
                    compactNeedsConnect ? "btn connect" : "btn primary"
                  }
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
              <button
                className="btn ghost"
                onClick={() => void openSetupWindow()}
              >
                Overview
              </button>
            </div>
          </div>
          {canRenderLauncherStatus ? (
            <div className="compact-server-dock">
              <ServerControlBar
                launcherServerControls={launcherServerControls}
                isServerActionBusy={isServerActionBusy}
                runLauncherServerAction={runLauncherServerAction}
              />
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
