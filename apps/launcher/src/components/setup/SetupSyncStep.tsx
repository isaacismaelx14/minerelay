import clsx from "clsx";
import { Button, CompactStat, ProgressBar } from "@minerelay/ui";
import { bytesToHuman, formatEta } from "../../utils";
import {
  actionsRowClassName,
  metricsRowClassName,
  summaryGridCompactClassName,
  syncHeaderClassName,
  syncLogoClassName,
  wizardBodyClassName,
  wizardButtonClassName,
  wizardMetaClassName,
  wizardPanelClassName,
  wizardStatClassName,
  wizardTitleClassName,
  type SetupStepProps,
} from "./shared";

export function SetupSyncStep({ core }: SetupStepProps) {
  const {
    APP_NAME,
    SERVER_ID,
    catalog,
    setWizardStep,
    canRenderLogo,
    markLogoAsBroken,
    wizardSyncing,
    hasSyncTotal,
    progressPercent,
    syncHasUnknownTotal,
    sync,
    syncBytesLabel,
    completeWizard,
    isActionBusy,
  } = core;

  return (
    <div className={wizardPanelClassName}>
      <div className={syncHeaderClassName}>
        {canRenderLogo ? (
          <img
            className={syncLogoClassName}
            src={catalog?.logoUrl}
            alt={`${catalog?.serverName ?? SERVER_ID} logo`}
            onError={() => markLogoAsBroken(catalog?.logoUrl)}
          />
        ) : (
          <img
            className={syncLogoClassName}
            src="/minerelay-logo.svg"
            alt={`${APP_NAME} logo`}
          />
        )}
        <div>
          <h2 className={clsx(wizardTitleClassName, "mb-0.5")}>
            Step 4: Initial Sync
          </h2>
          <p className={clsx(wizardBodyClassName, "opacity-70")}>
            {catalog?.serverName ?? SERVER_ID}
          </p>
        </div>
      </div>

      <p className="m-0 text-[0.85rem] leading-normal text-text-secondary">
        Profile contains <strong>{catalog?.mods.length ?? 0}</strong> mods and{" "}
        <strong>{catalog?.configs.length ?? 0}</strong> configs.
      </p>

      <ul className={summaryGridCompactClassName}>
        <li>
          <CompactStat label="Add" value={catalog?.summary.add ?? 0} className={wizardStatClassName} />
        </li>
        <li>
          <CompactStat label="Remove" value={catalog?.summary.remove ?? 0} className={wizardStatClassName} />
        </li>
        <li>
          <CompactStat label="Update" value={catalog?.summary.update ?? 0} className={wizardStatClassName} />
        </li>
        <li>
          <CompactStat label="Keep" value={catalog?.summary.keep ?? 0} className={wizardStatClassName} />
        </li>
      </ul>

      {wizardSyncing ? (
        <div className="grid gap-2">
          <ProgressBar
            value={progressPercent}
            indeterminate={syncHasUnknownTotal}
            ariaValueText={
              syncHasUnknownTotal ? "Download progress total unknown" : undefined
            }
          />
          <p className={clsx(wizardMetaClassName, "mt-1")}>
            {sync.currentFile ?? "Applying sync..."} {hasSyncTotal ? `(${progressPercent}%)` : ""}
          </p>
          <div className={metricsRowClassName}>
            <span>{syncBytesLabel}</span>
            <span>{bytesToHuman(sync.speedBps)}/s</span>
            <span>ETA {formatEta(sync.etaSec)}</span>
          </div>
        </div>
      ) : null}

      <div className={actionsRowClassName}>
        <Button
          variant="ghost"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => setWizardStep("runtime")}
          disabled={wizardSyncing}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => void completeWizard()}
          disabled={wizardSyncing || isActionBusy("wizard:complete")}
        >
          {wizardSyncing || isActionBusy("wizard:complete")
            ? "Syncing..."
            : "Run Sync and Finish Setup"}
        </Button>
      </div>
    </div>
  );
}
