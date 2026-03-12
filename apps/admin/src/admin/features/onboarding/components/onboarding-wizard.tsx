"use client";

import { Alert, Card } from "@minerelay/ui";
import { useOnboardingModel } from "../hooks/use-onboarding-model";
import { MineRelayLogo } from "@/admin/shared/ui/minerelay-logo";
import { StepVersion } from "./step-version";
import { StepIdentity } from "./step-identity";
import { StepComplete } from "./step-complete";

const STEPS = [
  { label: "Version" },
  { label: "Identity" },
  { label: "Done" },
] as const;

const STEP_INDEX: Record<string, number> = {
  version: 0,
  identity: 1,
  complete: 2,
};

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center gap-[0px] mb-[32px]">
      {STEPS.map((s, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={s.label} className="flex items-center group">
            <div
              className={`flex flex-col items-center gap-[6px] transition-all duration-300 ${isActive ? "scale-105" : "scale-100 opacity-70"}`}
            >
              <div
                className={`flex h-[32px] w-[32px] items-center justify-center rounded-full text-[0.875rem] font-semibold transition-all duration-300 ease-out shadow-sm ${
                  isDone
                    ? "bg-[var(--color-brand-primary)] text-white shadow-[0_0_12px_var(--color-brand-primary-ring)]"
                    : isActive
                      ? "bg-[var(--color-brand-primary)]/10 border-[2px] border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] ring-[4px] ring-[var(--color-brand-primary)]/20"
                      : "bg-[var(--color-bg-surface-elevated)] border border-[var(--color-line-soft)] text-[var(--color-text-muted)] group-hover:border-[var(--color-text-secondary)] group-hover:bg-line-soft"
                }`}
              >
                {isDone ? (
                  <span className="material-symbols-outlined text-[16px]">
                    check
                  </span>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[0.75rem] font-medium tracking-wide uppercase transition-colors duration-300 ${
                  isActive
                    ? "text-[var(--color-text-primary)] font-bold text-shadow-sm"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-[2px] w-[56px] mx-[12px] mb-[22px] rounded-full transition-all duration-500 ease-out ${
                  isDone
                    ? "bg-[var(--color-brand-primary)] shadow-[0_0_8px_var(--color-brand-primary-ring)]"
                    : "bg-[var(--color-line-strong)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingWizard() {
  const model = useOnboardingModel();
  const stepIndex = STEP_INDEX[model.step] ?? 0;
  const isCompleteStep = model.step === "complete";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand-primary)]/10 blur-[120px]" />

      <div
        className={`w-full transition-all duration-500 ease-in-out ${isCompleteStep ? "max-w-[1120px]" : "max-w-[760px]"}`}
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <MineRelayLogo size={42} />
            <div className="text-left">
              <span className="block text-[1.5rem] font-semibold tracking-tight text-white">
                MineRelay
              </span>
              {!isCompleteStep && (
                <p className="m-0 text-sm text-text-secondary">Admin Setup</p>
              )}
            </div>
          </div>
          {!isCompleteStep && (
            <p className="m-0 max-w-xl text-sm leading-6 text-text-secondary">
              Set the runtime, define the server identity, and publish a clean
              first profile without leaving the admin flow.
            </p>
          )}
        </div>

        <Card
          surface="strong"
          className="gap-8 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)] border-[var(--color-line-strong)] sm:p-10 relative overflow-hidden"
        >
          {/* Subtle inner highlight */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-line-soft)] to-transparent" />
          {model.step !== "complete" && (
            <StepIndicator currentIndex={stepIndex} />
          )}

          {model.error && (
            <Alert tone="error" icon="error">
              {model.error}
            </Alert>
          )}

          {model.step === "version" && (
            <StepVersion
              mcVersion={model.form.mcVersion}
              loaderVersion={model.form.loaderVersion}
              loaderLatestStable={model.form.loaderLatestStable}
              mcVersions={model.mcVersions}
              isLoadingVersions={model.isLoadingVersions}
              onSelectMcVersion={model.selectMcVersion}
              onNext={model.nextStep}
              onFetchVersions={model.fetchMinecraftVersions}
            />
          )}

          {model.step === "identity" && (
            <StepIdentity
              displayName={model.form.displayName}
              serverAddress={model.form.serverAddress}
              logoPreview={model.form.logoPreview}
              bgPreview={model.form.bgPreview}
              isSubmitting={model.isSubmitting}
              onDisplayNameChange={(v) => model.setField("displayName", v)}
              onServerAddressChange={(v) => model.setField("serverAddress", v)}
              onLogoChange={(f) => model.setImageFile("logo", f)}
              onBgChange={(f) => model.setImageFile("bg", f)}
              onBack={model.prevStep}
              onComplete={model.completeSetup}
            />
          )}

          {model.step === "complete" && (
            <StepComplete
              completed={model.completed}
              fallbackServerName={model.form.displayName}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
