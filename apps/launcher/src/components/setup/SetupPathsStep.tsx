import clsx from "clsx";
import { Button, Card, Details, ProgressBar, Select, TextInput } from "@minerelay/ui";
import {
  actionsRowClassName,
  advancedDetailsClassName,
  wizardButtonClassName,
  wizardCardClassName,
  wizardFieldClassName,
  wizardMetaClassName,
  wizardPanelClassName,
  SetupStepIntro,
  type SetupStepProps,
} from "./shared";

export function SetupPathsStep({ core }: SetupStepProps) {
  const {
    setWizardStep,
    wizardProgress,
    wizardDetection,
    wizardSelectedLauncherId,
    setWizardSelectedLauncherId,
    wizardManualLauncherPath,
    setWizardManualLauncherPath,
    pickWizardManualLauncherPath,
    wizardMinecraftRootPath,
    setWizardMinecraftRootPath,
    pickWizardMinecraftRootPath,
    startWizardDetection,
    wizardMinecraftRootStatus,
    continueWizardRuntimeStep,
    isActionBusy,
  } = core;

  const detectedLauncherOptions = [
    { value: "", label: "No launcher selected" },
    ...(wizardDetection?.candidates.map((candidate) => ({
      value: candidate.id,
      label: `${candidate.name} (${candidate.path})`,
    })) ?? []),
    { value: "custom", label: "Custom path" },
  ];

  return (
    <div className={wizardPanelClassName}>
      <SetupStepIntro
        title="Step 2: Launcher and Minecraft Directory"
        description={
          <>
            Auto-detect launchers and your default Minecraft directory.
            Microsoft Store installs may appear without a file path. If a
            launcher is missing, choose it manually.
          </>
        }
      />

      <ProgressBar value={wizardProgress} />
      <p className={wizardMetaClassName}>Detection progress: {wizardProgress}%</p>

      <Card className={wizardCardClassName}>
        <p className={wizardMetaClassName}>Detected launchers</p>
        <Select
          name="wizard-launcher"
          className={wizardFieldClassName}
          value={wizardSelectedLauncherId}
          options={detectedLauncherOptions}
          onChange={(event) => setWizardSelectedLauncherId(event.target.value)}
        />

        {wizardSelectedLauncherId === "custom" ? (
          <>
            <TextInput
              name="wizard-manual-launcher-path"
              className={wizardFieldClassName}
              value={wizardManualLauncherPath}
              placeholder="/Applications/Prism Launcher.app or C:\\...\\MinecraftLauncher.exe"
              onChange={(event) => setWizardManualLauncherPath(event.target.value)}
            />
            <Button
              variant="ghost"
              size="lg"
              className={wizardButtonClassName}
              onClick={() => void pickWizardManualLauncherPath()}
              disabled={isActionBusy("wizard:pickLauncherPath")}
            >
              {isActionBusy("wizard:pickLauncherPath") ? "Picking..." : "Pick Launcher Path"}
            </Button>
          </>
        ) : null}
      </Card>

      <Details
        className={advancedDetailsClassName}
        summary="Advanced: Override Minecraft Directory"
        contentClassName="gap-[var(--space-3)]"
      >
        <div className="space-y-4">
          <p className={clsx(wizardMetaClassName, "mb-2")}>
            By default, the sync tool automatically targets the default
            configuration folder of the launcher you selected above. Use this
            option ONLY if you want to override that behavior and force a custom
            absolute data path (like a portable USB drive or multiple specific
            instances).
          </p>
          <TextInput
            name="wizard-minecraft-root-path"
            className={clsx(wizardFieldClassName, "mt-2")}
            value={wizardMinecraftRootPath}
            placeholder="/Users/.../Library/Application Support/minecraft"
            onChange={(event) => setWizardMinecraftRootPath(event.target.value)}
          />
          <div className={actionsRowClassName}>
            <Button
              variant="ghost"
              size="lg"
              className={wizardButtonClassName}
              onClick={() => void pickWizardMinecraftRootPath()}
              disabled={isActionBusy("wizard:pickMinecraftPath")}
            >
              {isActionBusy("wizard:pickMinecraftPath") ? "Picking..." : "Pick Minecraft Dir"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className={wizardButtonClassName}
              onClick={() => void startWizardDetection()}
              disabled={isActionBusy("wizard:detect")}
            >
              {isActionBusy("wizard:detect") ? "Scanning..." : "Rescan"}
            </Button>
          </div>
          <p className={wizardMetaClassName}>
            {wizardMinecraftRootStatus?.exists
              ? "Detected path exists."
              : "Detected path not found. Select manually."}
          </p>
        </div>
      </Details>

      <div className={actionsRowClassName}>
        <Button
          variant="ghost"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => setWizardStep("source")}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => void continueWizardRuntimeStep()}
          disabled={
            wizardProgress < 100 ||
            isActionBusy("wizard:detect") ||
            isActionBusy("wizard:continueRuntime")
          }
        >
          {wizardProgress < 100
            ? "Detecting Launcher..."
            : isActionBusy("wizard:detect")
              ? "Scanning..."
              : isActionBusy("wizard:continueRuntime")
                ? "Loading..."
                : "Continue to Runtime Check"}
        </Button>
      </div>
    </div>
  );
}
