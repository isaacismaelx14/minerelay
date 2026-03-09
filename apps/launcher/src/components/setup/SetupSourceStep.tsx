import clsx from "clsx";
import { Badge, Button, Details, TextInput } from "@minerelay/ui";
import {
  actionsRowClassName,
  advancedDetailsClassName,
  wizardButtonClassName,
  wizardDisabledButtonClassName,
  wizardFieldClassName,
  wizardMetaClassName,
  wizardPanelClassName,
  SetupStepIntro,
  type SetupStepProps,
} from "./shared";

export function SetupSourceStep({ core }: SetupStepProps) {
  const {
    profileSourceDraft,
    setProfileSourceDraft,
    beginWizardPathsStep,
    isActionBusy,
  } = core;

  return (
    <div className={wizardPanelClassName}>
      <SetupStepIntro
        title="Step 1: Connect to Server API"
        description={
          <>
            Set your server API URL to load profile metadata, allowed Minecraft
            versions, and sync catalog.
          </>
        }
      />

      <TextInput
        name="api-base-url"
        className={wizardFieldClassName}
        value={profileSourceDraft.apiBaseUrl}
        placeholder="https://api.example.com"
        onChange={(event) =>
          setProfileSourceDraft((current) => ({
            ...current,
            apiBaseUrl: event.target.value,
          }))
        }
      />

      <Details
        className={advancedDetailsClassName}
        open={!!profileSourceDraft.pairingCode || undefined}
        summary="Advanced: Pairing Code"
      >
        <div className="grid gap-2">
          <p className={wizardMetaClassName}>
            Optional one-time code used to enroll this installation for secure
            server control.
          </p>
          <TextInput
            name="pairing-code"
            className={wizardFieldClassName}
            value={profileSourceDraft.pairingCode}
            placeholder="ABCD2345"
            onChange={(event) =>
              setProfileSourceDraft((current) => ({
                ...current,
                pairingCode: event.target.value.toUpperCase(),
              }))
            }
          />
        </div>
      </Details>

      <div className={actionsRowClassName}>
        <Button
          variant="primary"
          size="lg"
          className={wizardButtonClassName}
          onClick={() => void beginWizardPathsStep()}
          disabled={isActionBusy("wizard:beginPaths")}
        >
          {isActionBusy("wizard:beginPaths")
            ? "Loading..."
            : "Continue to Path Setup"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className={clsx(wizardButtonClassName, wizardDisabledButtonClassName)}
          disabled
        >
          Log In
          <Badge
            tone="warning"
            className="text-[0.7rem] tracking-[0.05em] uppercase"
          >
            Coming Soon
          </Badge>
        </Button>
      </div>
    </div>
  );
}
