import { Button, Card } from "@minerelay/ui";
import { bytesToHuman, formatEta, formatTime } from "../../utils";
import type { DesktopWorkspaceCore, DesktopWorkspacePageStyles } from "./types";

export function ActivityPage({
  core,
  styles,
}: {
  core: DesktopWorkspaceCore;
  styles: DesktopWorkspacePageStyles;
}) {
  const {
    blockClass,
    paneHeadClass,
    subtitleClass,
    paneGridClass,
    panelCardClass,
    h3Class,
    dataListClass,
    dataItemClass,
    dataLabelClass,
    dataValueClass,
    actionsRowClass,
    ghostButtonClass,
    meterClass,
    metricsClass,
  } = styles;

  const {
    lastCheckAt,
    nextCheckAt,
    runSyncCycle,
    sessionActive,
    isChecking,
    launcherUpdate,
    launcherUpdateNotice,
    isCheckingLauncherUpdate,
    isInstallingLauncherUpdate,
    checkLauncherUpdate,
    installLauncherUpdate,
    isPlaying,
    sessionStatus,
    sync,
    hasSyncTotal,
    progressPercent,
    syncHasUnknownTotal,
    syncBytesLabel,
    hint,
    error,
  } = core;

  return (
    <div className={blockClass}>
      <div className={paneHeadClass}>
        <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
          Activity
        </h2>
        <p className={subtitleClass}>
          Sync schedule, telemetry, and operator messages.
        </p>
      </div>

      <div className={paneGridClass}>
        <Card className={panelCardClass}>
          <h3 className={h3Class}>Schedule</h3>
          <div className={dataListClass}>
            <div className="border-l-brand-indigo rounded-md border-l-[3px] bg-[rgba(255,255,255,0.03)] p-3">
              <p
                className={subtitleClass}
                style={{ margin: 0, fontSize: "0.8rem" }}
              >
                Auto-apply every 30 minutes while the app is open.
              </p>
            </div>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Last Check</span>
              <div className={dataValueClass}>{formatTime(lastCheckAt)}</div>
            </div>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Next Check</span>
              <div className={dataValueClass}>{formatTime(nextCheckAt)}</div>
            </div>
            <Button
              className={ghostButtonClass}
              onClick={() => void runSyncCycle(true)}
              disabled={sessionActive || isChecking}
            >
              {isChecking ? "Running..." : "Run Check + Auto Apply"}
            </Button>
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Launcher Updates</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Current Version</span>
              <div className={dataValueClass}>
                {launcherUpdate?.currentVersion ?? "--"}
              </div>
            </div>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Status</span>
              <div className={dataValueClass}>
                {launcherUpdate?.available
                  ? "Update available"
                  : launcherUpdate
                    ? "Up to date"
                    : "Not checked"}
              </div>
            </div>
            {launcherUpdate?.available ? (
              <div className={dataItemClass}>
                <span className={dataLabelClass}>Latest Release</span>
                <div className={dataValueClass}>
                  {launcherUpdate.latestVersion}
                </div>
              </div>
            ) : null}
            <p
              className={subtitleClass}
              style={{ fontSize: "0.75rem", marginTop: "4px" }}
            >
              {launcherUpdateNotice ??
                "Updater checks run at startup and every 30 minutes."}
            </p>
            <div className={actionsRowClass}>
              <Button
                className={ghostButtonClass}
                onClick={() => void checkLauncherUpdate(false)}
                disabled={
                  isCheckingLauncherUpdate || isInstallingLauncherUpdate
                }
              >
                {isCheckingLauncherUpdate ? "Checking..." : "Check Updates"}
              </Button>
              {launcherUpdate?.available ? (
                <Button
                  className={ghostButtonClass}
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
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Current Session</h3>
          <p className={subtitleClass}>
            Phase: {sessionStatus.phase.replaceAll("_", " ")}
          </p>
          <p className={subtitleClass}>
            Live dir: {sessionStatus.liveMinecraftDir ?? "--"}
          </p>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Current Transfer</h3>
          <p className={subtitleClass}>{sync.currentFile ?? sync.phase}</p>
          <div
            className={meterClass}
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
              className={`relative h-full rounded-[999px] bg-[linear-gradient(90deg,var(--color-brand-indigo),var(--color-brand-accent))] shadow-[0_0_10px_var(--color-brand-indigo-shadow)] transition-[width] duration-400 ease-[cubic-bezier(0.1,0.8,0.2,1)] after:absolute after:inset-0 after:animate-[meterShine_2s_infinite_linear] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]${
                syncHasUnknownTotal
                  ? " w-1/2! animate-[meterIndeterminate_1.5s_ease-in-out_infinite]"
                  : ""
              }`}
              style={{
                width: syncHasUnknownTotal ? "30%" : `${progressPercent}%`,
              }}
            />
          </div>
          <div className={metricsClass}>
            <span>{syncBytesLabel}</span>
            <span>{bytesToHuman(sync.speedBps)}/s</span>
            <span>ETA {formatEta(sync.etaSec)}</span>
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Messages</h3>
          <p className={subtitleClass}>{hint ?? "No recent hints."}</p>
          <p className={subtitleClass}>{error ?? "No active errors."}</p>
        </Card>
      </div>
    </div>
  );
}
