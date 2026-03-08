import clsx from "clsx";
import { memo, useCallback } from "react";
import type { LauncherServerControlsState } from "../types";

type StatusTone =
  | "online"
  | "offline"
  | "busy"
  | "error"
  | "disabled"
  | "unknown";

const defaultStatusBadgeToneClassNames: Record<StatusTone, string> = {
  online: "is-online",
  offline: "is-offline",
  busy: "is-busy",
  error: "is-error",
  disabled: "is-disabled",
  unknown: "is-unknown",
};

type Props = {
  launcherServerControls: LauncherServerControlsState;
  isServerActionBusy: boolean;
  runLauncherServerAction: (
    action: "start" | "stop" | "restart",
  ) => Promise<void>;
  shellClassName?: string;
  labelClassName?: string;
  controlsClassName?: string;
  statusBadgeClassName?: string;
  statusBadgeToneClassNames?: Partial<Record<StatusTone, string>>;
  statusTextClassName?: string;
  iconActionsClassName?: string;
  iconButtonClassName?: string;
};

export const ServerControlBar = memo(function ServerControlBar({
  launcherServerControls,
  isServerActionBusy,
  runLauncherServerAction,
  shellClassName = "compact-server-shell",
  labelClassName = "launcher-server-section-label compact-server-section-label",
  controlsClassName = "launcher-server-controls compact-server-controls",
  statusBadgeClassName = "launcher-server-badge",
  statusBadgeToneClassNames = defaultStatusBadgeToneClassNames,
  statusTextClassName = "compact-server-online",
  iconActionsClassName = "compact-server-icon-actions",
  iconButtonClassName = "compact-server-icon-btn",
}: Props) {
  const handleStart = useCallback(
    () => void runLauncherServerAction("start"),
    [runLauncherServerAction],
  );
  const handleRestart = useCallback(
    () => void runLauncherServerAction("restart"),
    [runLauncherServerAction],
  );
  const handleStop = useCallback(
    () => void runLauncherServerAction("stop"),
    [runLauncherServerAction],
  );

  const statusTone: StatusTone = (() => {
    if (!launcherServerControls?.enabled) {
      return "disabled";
    }

    const status = launcherServerControls.selectedServer?.status;
    if (status === 1) return "online";
    if (status === 0) return "offline";
    if (status === 7) return "error";
    if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status ?? -1)) return "busy";
    return "unknown";
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
        <span
          className={clsx(
            statusBadgeClassName,
            statusBadgeToneClassNames[statusTone],
          )}
        >
          {launcherServerControls.selectedServer?.statusLabel ??
            (launcherServerControls.enabled ? "Unknown" : "Unavailable")}
        </span>

        {launcherServerControls.reason ? (
          <span className={statusTextClassName}>
            {launcherServerControls.reason}
          </span>
        ) : launcherServerControls.permissions.canViewOnlinePlayers &&
          launcherServerControls.selectedServer ? (
          <span className={statusTextClassName}>
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
                onClick={handleStart}
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
                onClick={handleRestart}
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
                onClick={handleStop}
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
});
