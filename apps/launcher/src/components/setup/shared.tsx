import type { ReactNode } from "react";
import type { useAppCore } from "../../hooks/useAppCore";

export type SetupWizardCore = ReturnType<typeof useAppCore>;
export type SetupStepProps = {
  core: SetupWizardCore;
};

export const wizardSteps = ["source", "paths", "runtime", "sync"] as const;

export const wizardShellClassName =
  "grid w-full content-start gap-[var(--space-4)] rounded-[var(--radius-xl)] border border-line bg-surface-deep-20 p-4 shadow-[0_24px_80px_var(--color-shadow-xl)] animate-[fadeIn_var(--transition-smooth)_0.1s_both] sm:p-6";

export const wizardShellInnerScrollClassName =
  "overflow-y-auto";

export const wizardShellOuterScrollClassName = "shrink-0";

export const wizardStepsClassName =
  "mb-[var(--space-4)] grid grid-cols-4 gap-[var(--space-2)]";

export const wizardStepClassName =
  "relative h-1 overflow-hidden rounded-full bg-white/10 transition-all duration-300";

export const wizardStepActiveClassName = "!bg-brand-primary shadow-[0_0_10px_var(--color-brand-primary)]";

export const wizardStepCompleteClassName = "!bg-brand-primary-glow";

export const wizardPanelClassName = "grid content-start gap-[var(--space-4)]";

export const wizardTitleClassName =
  "m-0 text-[1.1rem] font-semibold tracking-[0.01em] text-white";

export const wizardBodyClassName =
  "m-0 text-[0.9rem] leading-[1.5] text-text-secondary";

export const wizardMetaClassName =
  "m-0 text-[0.9rem] leading-[1.5] text-text-secondary";

export const advancedDetailsClassName = "mt-3";

export const actionsRowClassName = "flex flex-wrap gap-[var(--space-3)]";

export const metricsRowClassName =
  "flex justify-between gap-[var(--space-2)] font-mono text-[0.85rem] text-text-muted";

export const summaryGridCompactClassName =
  "grid list-none grid-cols-4 gap-[var(--space-2)] p-0";

export const syncHeaderClassName = "mb-2 flex items-center gap-[var(--space-3)]";

export const syncLogoClassName =
  "m-0 h-12 w-12 rounded-[12px] border border-line-strong bg-bg-card object-cover shadow-[0_8px_24px_var(--color-shadow-lg)]";

export const wizardFieldClassName = "w-full";

export const wizardButtonClassName = "min-h-[48px]";

export const wizardDisabledButtonClassName =
  "pointer-events-none text-text-secondary";

export const wizardCardClassName = "content-start";

export const wizardStatClassName = "[&_strong]:text-white";

export const wizardAlertClassName = "py-3 px-4";

type SetupStepIntroProps = {
  title: string;
  description: ReactNode;
};

export function SetupStepIntro({
  title,
  description,
}: SetupStepIntroProps) {
  return (
    <>
      <h2 className={wizardTitleClassName}>{title}</h2>
      <p className={wizardBodyClassName}>{description}</p>
    </>
  );
}
