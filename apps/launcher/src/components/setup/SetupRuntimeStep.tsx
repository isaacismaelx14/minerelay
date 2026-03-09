import { Alert, Button, Card, Details } from "@minerelay/ui";
import {
  actionsRowClassName,
  advancedDetailsClassName,
  wizardAlertClassName,
  wizardButtonClassName,
  wizardCardClassName,
  wizardMetaClassName,
  wizardPanelClassName,
  SetupStepIntro,
  type SetupStepProps,
} from "./shared";

export function SetupRuntimeStep({ core }: SetupStepProps) {
  const {
    setWizardStep,
    versionReadiness,
    catalog,
    hasFancyMenuMod,
    fancyMenuMode,
    hasFancyMenuCustomBundle,
    wizardRuntimeStatus,
    installFabricRuntime,
    continueWizardSyncStep,
    isActionBusy,
  } = core;

  return (
    <div className={wizardPanelClassName}>
      <SetupStepIntro
        title="Step 3: Fabric Runtime Readiness"
        description={
          <>
            Target: {versionReadiness?.minecraftVersion ?? "--"} / {" "}
            {versionReadiness?.loader ?? "--"} {" "}
            {versionReadiness?.loaderVersion ?? "--"}
          </>
        }
      />

      <Details
        className={advancedDetailsClassName}
        summary="Advanced: Technical Details"
      >
        <div className="space-y-2">
          <p className={wizardMetaClassName}>
            Live minecraft dir: {versionReadiness?.liveMinecraftRoot ?? "--"}
          </p>
          <p className={wizardMetaClassName}>
            Managed sync dir: {versionReadiness?.managedMinecraftDir ?? "--"}
          </p>
          <p className={wizardMetaClassName}>
            Allowlisted versions: {versionReadiness?.allowedMinecraftVersions.join(", ") || "--"}
          </p>
          <p className={wizardMetaClassName}>
            Fabric target id: {versionReadiness?.expectedFabricVersionId ?? "--"}
          </p>
          <p className={wizardMetaClassName}>
            Managed version target: {versionReadiness?.expectedManagedVersionId ?? "--"} ({versionReadiness?.managedVersionPresent ? "present" : "missing"})
          </p>
        </div>
      </Details>

      <p className={wizardMetaClassName}>
        {versionReadiness?.guidance ?? "Checking runtime compatibility..."}
      </p>

      {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
        <Alert tone="error" className={wizardAlertClassName}>
          FancyMenu mod is missing in server profile. Custom menu will not
          apply.
        </Alert>
      ) : null}

      {catalog?.fancyMenuEnabled && hasFancyMenuMod && fancyMenuMode === "custom" && !hasFancyMenuCustomBundle ? (
        <Alert tone="error" className={wizardAlertClassName}>
          FancyMenu is in custom mode, but the custom bundle is missing in
          profile configs.
        </Alert>
      ) : null}

      {wizardRuntimeStatus ? (
        <Card className={wizardCardClassName}>
          <p className={wizardMetaClassName}>Last runtime action</p>
          <p className={wizardMetaClassName}>
            {wizardRuntimeStatus.presentBefore
              ? `Fabric runtime already present: ${wizardRuntimeStatus.versionId}`
              : `Installed Fabric runtime: ${wizardRuntimeStatus.versionId}`}
          </p>
          <p className={wizardMetaClassName}>
            Managed version ensured: {wizardRuntimeStatus.managedVersionId}
          </p>
          <p className={wizardMetaClassName}>{wizardRuntimeStatus.managedMessage}</p>
        </Card>
      ) : null}

      <div className={actionsRowClassName}>
        <Button
          variant="ghost"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => setWizardStep("paths")}
        >
          Back
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => void installFabricRuntime()}
          disabled={isActionBusy("wizard:installRuntime")}
        >
          {isActionBusy("wizard:installRuntime")
            ? "Installing..."
            : "Install / Ensure Fabric Runtime"}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => void continueWizardSyncStep()}
          disabled={
            !versionReadiness?.allowlisted ||
            !versionReadiness?.foundInMinecraftRootDir ||
            isActionBusy("wizard:continueSync")
          }
        >
          {isActionBusy("wizard:continueSync")
            ? "Loading..."
            : "Continue to Initial Sync"}
        </Button>
      </div>
    </div>
  );
}
