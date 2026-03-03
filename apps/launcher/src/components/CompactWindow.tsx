import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";

export function CompactWindow({ core }: { core: ReturnType<typeof useAppCore> }) {
  const {
    APP_NAME, SERVER_ID, catalog, sessionStatus, lastCheckAt, isChecking,
    canRenderLogo, markLogoAsBroken, serverInitial, compactPlaying,
    runSyncCycle, openLauncherFromCompact, openSetupWindow
  } = core;

    const compactHasServerInfo = catalog !== null;
    const compactNeedsConnect = !compactHasServerInfo;
    const statusTitle = compactPlaying
      ? "Playing"
      : compactNeedsConnect
        ? "Disconnected"
        : "Ready";
    const statusSubtitle = compactPlaying
      ? `Playing in ${sessionStatus.liveMinecraftDir ?? "Minecraft directory"}`
      : compactNeedsConnect
        ? "Server info unavailable. Connect to refresh profile data."
        : `Server ${catalog?.serverName ?? SERVER_ID} is synced and ready.`;

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
                <p className="compact-app">{APP_NAME}</p>
                <p className="compact-server">{catalog?.serverName ?? `Server ${SERVER_ID}`}</p>
                <p className="compact-version">
                  MC {catalog?.minecraftVersion ?? "--"} · {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
                </p>
              </div>
            </div>
          </header>

          <section className={`compact-core${compactPlaying ? " is-playing" : ""}`}>
            <div className="compact-ring" aria-hidden="true">
              <div className="compact-ring-inner" />
            </div>
            <h2>{statusTitle}</h2>
            <p>{statusSubtitle}</p>
            <div className="actions-row compact-actions">
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
              <button className="btn ghost" onClick={() => void openSetupWindow()}>
                Overview
              </button>
            </div>
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
