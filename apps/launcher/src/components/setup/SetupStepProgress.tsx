import clsx from "clsx";
import {
  wizardStepActiveClassName,
  wizardStepClassName,
  wizardStepCompleteClassName,
  wizardSteps,
  wizardStepsClassName,
  type SetupWizardCore,
} from "./shared";

type SetupStepProgressProps = {
  step: SetupWizardCore["wizardStep"];
};

export function SetupStepProgress({ step }: SetupStepProgressProps) {
  const activeWizardStepIndex = wizardSteps.indexOf(step);

  return (
    <div className={wizardStepsClassName} aria-label="Onboarding steps">
      {wizardSteps.map((wizardStep, index) => (
        <span
          key={wizardStep}
          className={clsx(
            wizardStepClassName,
            index < activeWizardStepIndex && wizardStepCompleteClassName,
            index === activeWizardStepIndex && wizardStepActiveClassName,
          )}
          aria-label={`Step ${index + 1}: ${wizardStep}`}
        >
          <span className="sr-only">{`Step ${index + 1}: ${wizardStep}`}</span>
        </span>
      ))}
    </div>
  );
}
