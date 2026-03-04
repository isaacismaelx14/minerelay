import type { LauncherServerControlsState } from "../types";

type Props = {
  launcherServerControls: LauncherServerControlsState;
  isServerActionBusy: boolean;
  runLauncherServerAction: (action: "start" | "stop" | "restart") => Promise<void>;
  shellClassName?: string;
  labelClassName?: string;
  controlsClassName?: string;
  iconActionsClassName?: string;
  iconButtonClassName?: string;
};

export function ServerControlBar({
  launcherServerControls,
  isServerActionBusy,
  runLauncherServerAction,
  shellClassName = "compact-server-shell",
  labelClassName = "launcher-server-section-label compact-server-section-label",
  controlsClassName = "launcher-server-controls compact-server-controls",
  iconActionsClassName = "compact-server-icon-actions",
  iconButtonClassName = "compact-server-icon-btn",
}: Props) {
  const statusToneClass = (() => {
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
  const disableStartByStatus = [1, 2, 3, 4, 6].includes(
    launcherServerStatus ?? -1,
  );
  const disableStopByStatus = [0, 2, 3, 4, 6].includes(
    launcherServerStatus ?? -1,
  );
  const disableRestartByStatus = [0, 2, 3, 4, 6].includes(
    launcherServerStatus ?? -1,
  );

  return (
    <div className={shellClassName}>
      <span className={labelClassName}>Live Server Control</span>
      <section className={controlsClassName}>
        <span className={`launcher-server-badge ${statusToneClass}`}>
          {launcherServerControls.selectedServer?.statusLabel ??
            (launcherServerControls.enabled ? "Unknown" : "Unavailable")}
        </span>

        {launcherServerControls.reason ? (
          <span className="compact-server-online">{launcherServerControls.reason}</span>
        ) : launcherServerControls.permissions.canViewOnlinePlayers &&
          launcherServerControls.selectedServer ? (
          <span className="compact-server-online">
            {launcherServerControls.selectedServer.players.count}/
            {launcherServerControls.selectedServer.players.max} online
          </span>
        ) : null}

        {(launcherServerControls.permissions.canStartServer ||
          launcherServerControls.permissions.canStopServer ||
          launcherServerControls.permissions.canRestartServer) && (
          <div className={iconActionsClassName}>
            {launcherServerControls.permissions.canStartServer && (
              <button
                className={iconButtonClassName}
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
                className={iconButtonClassName}
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
                className={iconButtonClassName}
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
  );
}
