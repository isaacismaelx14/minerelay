import clsx from "clsx";
import type { ComponentType } from "react";
import type { useAppCore } from "../hooks/useAppCore";
import { SetupPathsStep } from "./setup/SetupPathsStep";
import { SetupRuntimeStep } from "./setup/SetupRuntimeStep";
import { SetupSourceStep } from "./setup/SetupSourceStep";
import { SetupStepProgress } from "./setup/SetupStepProgress";
import { SetupSyncStep } from "./setup/SetupSyncStep";
import {
  wizardShellClassName,
  wizardShellInnerScrollClassName,
  wizardShellOuterScrollClassName,
  type SetupStepProps,
} from "./setup/shared";

const setupStepComponents: Record<
  ReturnType<typeof useAppCore>["wizardStep"],
  ComponentType<SetupStepProps>
> = {
  source: SetupSourceStep,
  paths: SetupPathsStep,
  runtime: SetupRuntimeStep,
  sync: SetupSyncStep,
};

export function SetupWizard({ core }: { core: ReturnType<typeof useAppCore> }) {
  const ActiveStep = setupStepComponents[core.wizardStep];

  return (
    <div
      className={clsx(
        wizardShellClassName,
        core.isWindows
          ? wizardShellOuterScrollClassName
          : wizardShellInnerScrollClassName,
      )}
    >
      <SetupStepProgress step={core.wizardStep} />
      <ActiveStep core={core} />
    </div>
  );
}
