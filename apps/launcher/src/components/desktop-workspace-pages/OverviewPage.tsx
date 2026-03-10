import { Card, Details, ProgressBar } from "@minerelay/ui";
import { ServerControlBar } from "../ServerControlBar";
import { bytesToHuman, formatEta } from "../../utils";
import type { DesktopWorkspaceCore, DesktopWorkspacePageStyles } from "./types";

export function OverviewPage({
  core,
  styles,
}: {
  core: DesktopWorkspaceCore;
  styles: DesktopWorkspacePageStyles;
}) {
  const {
    blockClass,
    subtitleClass,
    paneGridClass,
    panelCardClass,
    h3Class,
    dataListClass,
    dataItemClass,
    dataLabelClass,
    dataValueClass,
    summaryGridClass,
    summaryItemClass,
    summaryValueClass,
    summaryLabelClass,
    overviewListClass,
    overviewChipClass,
    detailsClass,
    metricsClass,
  } = styles;

  const {
    screen,
    sync,
    hasSyncTotal,
    progressPercent,
    syncHasUnknownTotal,
    syncBytesLabel,
    sessionStatus,
    catalog,
    isApiSourceMode,
    launcherServerControls,
    isServerActionBusy,
    runLauncherServerAction,
    sessionActive,
    hasFancyMenuMod,
    fancyMenuMode,
    hasFancyMenuCustomBundle,
    isChecking,
    sourceLabel,
    settings,
    versionReadiness,
    instance,
  } = core;

  if (screen === "booting") {
    return (
      <div className={blockClass}>
        <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
          Checking Server State
        </h2>
        <p className={subtitleClass}>
          Loading remote profile lock, comparing local manifest, and evaluating
          updates.
        </p>
      </div>
    );
  }

  if (screen === "syncing") {
    return (
      <div className={blockClass}>
        <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
          Applying Sync
        </h2>
        <p className={subtitleClass}>
          {sync.phase === "committing"
            ? "Committing changes..."
            : "Downloading mods..."}
        </p>
        <ProgressBar
          value={progressPercent}
          indeterminate={syncHasUnknownTotal}
          ariaValueText={
            syncHasUnknownTotal ? "Download progress total unknown" : undefined
          }
        />
        <div className={metricsClass}>
          <span>{syncBytesLabel}</span>
          <span>{bytesToHuman(sync.speedBps)}/s</span>
          <span>ETA {formatEta(sync.etaSec)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={blockClass}>
      <div className="flex items-center justify-between gap-3 max-[1080px]:flex-col-reverse max-[1080px]:items-start">
        <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
          {sessionStatus.phase === "playing"
            ? "Playing"
            : catalog?.hasUpdates
              ? "Updates Detected"
              : "Instance Up to Date"}
        </h2>
        {isApiSourceMode && launcherServerControls ? (
          <div className="shrink-0 max-[1080px]:w-full">
            <ServerControlBar
              launcherServerControls={launcherServerControls}
              isServerActionBusy={isServerActionBusy}
              runLauncherServerAction={runLauncherServerAction}
              variant="desktop"
            />
          </div>
        ) : null}
      </div>
      <p className={subtitleClass}>
        {sessionActive
          ? `Live session active in ${sessionStatus.liveMinecraftDir ?? "Minecraft directory"}.`
          : catalog?.hasUpdates
            ? "New server changes were detected. Run Sync to apply updates now."
            : "All mods/resourcepacks/shaders/configs match server profile."}
      </p>
      {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
        <p
          className="text-[0.9rem] leading-[1.5] text-[var(--color-text-secondary)]"
          style={{ color: "#b84e4e" }}
        >
          Profile has no FancyMenu mod. Play-only menu customization will not be
          active.
        </p>
      ) : null}
      {catalog?.fancyMenuEnabled &&
      hasFancyMenuMod &&
      fancyMenuMode === "custom" &&
      !hasFancyMenuCustomBundle ? (
        <p
          className="text-[0.9rem] leading-[1.5] text-[var(--color-text-secondary)]"
          style={{ color: "#b84e4e" }}
        >
          FancyMenu custom mode is enabled, but the custom bundle is missing.
        </p>
      ) : null}
      {isChecking ? (
        <p className="text-[0.9rem] leading-[1.5] text-[var(--color-text-secondary)]">
          Checking server changes...
        </p>
      ) : null}

      <ul className={summaryGridClass}>
        <li className={summaryItemClass}>
          <strong className={summaryValueClass}>
            {catalog?.summary.add ?? 0}
          </strong>
          <span className={summaryLabelClass}>Add</span>
        </li>
        <li className={summaryItemClass}>
          <strong className={summaryValueClass}>
            {catalog?.summary.remove ?? 0}
          </strong>
          <span className={summaryLabelClass}>Remove</span>
        </li>
        <li className={summaryItemClass}>
          <strong className={summaryValueClass}>
            {catalog?.summary.update ?? 0}
          </strong>
          <span className={summaryLabelClass}>Update</span>
        </li>
        <li className={summaryItemClass}>
          <strong className={summaryValueClass}>
            {catalog?.summary.keep ?? 0}
          </strong>
          <span className={summaryLabelClass}>Keep</span>
        </li>
      </ul>

      <div className={paneGridClass}>
        <Card className={panelCardClass}>
          <h3 className={h3Class}>Server Profile</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Endpoint</span>
              <div className={dataValueClass}>
                {catalog?.serverAddress ?? "--"}
              </div>
            </div>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Source</span>
              <div className={dataValueClass}>{sourceLabel}</div>
            </div>
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Environment</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Active Launcher</span>
              <div className={dataValueClass}>
                {settings?.selectedLauncherId ?? "--"}
              </div>
            </div>

            <Details className={detailsClass} summary="Technical Paths">
              <div className={dataItemClass}>
                <span className={dataLabelClass}>Live Minecraft</span>
                <div className={dataValueClass}>
                  {versionReadiness?.liveMinecraftRoot ?? "--"}
                </div>
              </div>
              <div className={dataItemClass}>
                <span className={dataLabelClass}>Managed Sync</span>
                <div className={dataValueClass}>
                  {instance?.minecraftDir ?? "--"}
                </div>
              </div>
              {settings?.customLauncherPath ? (
                <div className={dataItemClass}>
                  <span className={dataLabelClass}>Custom Bin Path</span>
                  <div className={dataValueClass}>
                    {settings.customLauncherPath}
                  </div>
                </div>
              ) : null}
            </Details>
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Mods ({catalog?.mods.length ?? 0})</h3>
          <div className={overviewListClass}>
            {(catalog?.mods ?? []).map((item) => (
              <span key={item} className={overviewChipClass}>
                {item}
              </span>
            ))}
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>
            Resourcepacks ({catalog?.resourcepacks.length ?? 0})
          </h3>
          <div className={overviewListClass}>
            {(catalog?.resourcepacks ?? []).map((item) => (
              <span key={item} className={overviewChipClass}>
                {item}
              </span>
            ))}
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>
            Shaders ({catalog?.shaderpacks.length ?? 0})
          </h3>
          <div className={overviewListClass}>
            {(catalog?.shaderpacks ?? []).map((item) => (
              <span key={item} className={overviewChipClass}>
                {item}
              </span>
            ))}
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Configs ({catalog?.configs.length ?? 0})</h3>
          <div className={overviewListClass}>
            {(catalog?.configs ?? []).map((item) => (
              <span key={item} className={overviewChipClass}>
                {item}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
