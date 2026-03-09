import clsx from "clsx";
import { useCallback, useMemo } from "react";
import { Button, CompactStat, Select } from "@minerelay/ui";
import type { useAppCore } from "../hooks/useAppCore";
import { formatTime } from "../utils";
import { ServerControlBar } from "./ServerControlBar";

export function CompactWindow({
  core,
}: {
  core: ReturnType<typeof useAppCore>;
}) {
  const {
    APP_NAME,
    SERVER_ID,
    catalog,
    sessionStatus,
    lastCheckAt,
    isChecking,
    launcherAppVersion,
    canRenderLogo,
    markLogoAsBroken,
    serverInitial,
    compactPlaying,
    runSyncCycle,
    openLauncherFromCompact,
    openSetupWindow,
    cancelSession,
    settings,
    launchers,
    updateLauncherSelection,
    isApiSourceMode,
    launcherServerControls,
    isServerActionBusy,
    runLauncherServerAction,
    isActionBusy,
  } = core;

  const filteredLaunchers = useMemo(
    () => launchers.filter((candidate) => candidate.id !== "custom"),
    [launchers],
  );
  const launcherOptions = useMemo(
    () => [
      { value: "", label: "Select Launcher" },
      ...filteredLaunchers.map((candidate) => ({
        value: candidate.id,
        label: candidate.name,
      })),
      { value: "custom", label: "Custom path..." },
    ],
    [filteredLaunchers],
  );

  const handleLauncherChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      void updateLauncherSelection(value);
      if (value === "custom") {
        void openSetupWindow();
      }
    },
    [updateLauncherSelection, openSetupWindow],
  );

  const compactHasServerInfo = catalog !== null;
  const compactNeedsConnect = !compactHasServerInfo;
  const isLaunching = isActionBusy("launcher:open");
  const isOpeningOverview = isActionBusy("window:openSetup");
  const isCancellingLaunch = isActionBusy("session:cancel");
  const isAwaiting = sessionStatus.phase === "awaiting_game_start";
  const statusTitle = isAwaiting
    ? "Awaiting Launch"
    : compactPlaying
      ? "Playing"
      : compactNeedsConnect
        ? "Disconnected"
        : "Ready";
  const statusSubtitle = isAwaiting
    ? "Waiting for the game process to be detected..."
    : compactPlaying
      ? "Game session is currently active."
      : compactNeedsConnect
        ? "Server info unavailable. Connect to refresh profile data."
        : `Server ${catalog?.serverName ?? SERVER_ID} is synced and ready.`;
  const canRenderLauncherStatus =
    isApiSourceMode &&
    launcherServerControls !== null &&
    launcherServerControls.permissions.canViewStatus;
  const compactCoreClassName = clsx(
    "border-line bg-surface-deep-20 relative flex min-h-0 flex-1 flex-col items-center justify-start gap-3 overflow-hidden rounded-[var(--radius-lg)] border px-4 pt-4 pb-[92px] text-center",
    compactPlaying &&
      "border-success-border-strong bg-success-bg shadow-[inset_0_0_30px_var(--color-success-shadow-soft)] after:pointer-events-none after:absolute after:inset-0 after:animate-[pulseGlow_3s_infinite] after:bg-[radial-gradient(circle_at_top,var(--color-success-shadow-soft),transparent_72%)] after:content-['']",
    isAwaiting &&
      "border-info-border bg-info-tint shadow-[inset_0_0_30px_var(--color-info-tint)] after:pointer-events-none after:absolute after:inset-0 after:animate-[pulseGlow_1.5s_infinite] after:bg-[radial-gradient(circle_at_top,var(--color-info-tint),transparent_72%)] after:content-['']",
    compactNeedsConnect && "border-warning-border bg-warning-bg",
  );

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--color-brand-primary-ring),transparent_48%),radial-gradient(circle_at_bottom_right,var(--color-info-tint),transparent_55%),var(--color-bg-base)] p-2.5">
      <div className="border-line-strong bg-bg-surface flex h-full max-h-full w-full max-w-[406px] flex-col gap-3.5 rounded-[var(--radius-xl)] border p-4 shadow-[0_24px_60px_var(--color-shadow-xl),inset_0_1px_1px_var(--color-line-strong)] backdrop-blur-[20px]">
        <header className="flex shrink-0 flex-col items-stretch gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {canRenderLogo ? (
              <img
                className="border-line-strong bg-bg-card h-[52px] w-[52px] shrink-0 rounded-[12px] border object-cover shadow-[0_4px_12px_var(--color-shadow-lg)]"
                src={catalog?.logoUrl}
                alt={`${catalog?.serverName ?? SERVER_ID} logo`}
                onError={() => markLogoAsBroken(catalog?.logoUrl)}
              />
            ) : (
              <img
                className="border-line-strong bg-bg-card h-[52px] w-[52px] shrink-0 rounded-[12px] border object-cover shadow-[0_4px_12px_var(--color-shadow-lg)]"
                src="/minerelay-logo.svg"
                alt={`${APP_NAME} logo`}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-brand-accent font-mono text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
                  {APP_NAME}
                </p>
                {settings && launchers.length > 0 && (
                  <Select
                    name="compact-launcher"
                    variant="compact"
                    className="max-w-[11rem] shrink-0"
                    value={settings?.selectedLauncherId ?? ""}
                    options={launcherOptions}
                    onChange={handleLauncherChange}
                  />
                )}
              </div>
              <p
                className="truncate text-[1.15rem] leading-[1.1] font-bold text-white"
                title={catalog?.serverName ?? `Server ${SERVER_ID}`}
              >
                {catalog?.serverName ?? `Server ${SERVER_ID}`}
              </p>
              <p
                className="text-text-muted mt-0.5 truncate text-[0.75rem]"
                title={`App v${launcherAppVersion ?? "--"} · MC ${catalog?.minecraftVersion ?? "--"} · ${catalog?.loader ?? "fabric"} ${catalog?.loaderVersion ?? "--"}`}
              >
                App v{launcherAppVersion ?? "--"} · MC{" "}
                {catalog?.minecraftVersion ?? "--"} ·{" "}
                {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
              </p>
            </div>
          </div>
        </header>

        <section className={compactCoreClassName}>
          <div className="relative z-10 my-auto flex w-full flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <span
                className={clsx(
                  "relative h-2.5 w-2.5 rounded-full",
                  compactPlaying &&
                    "bg-success animate-[pulseGlow_2s_infinite] shadow-[0_0_8px_var(--color-success)]",
                  isAwaiting &&
                    "bg-brand-accent animate-[pulseGlow_1.5s_infinite] shadow-[0_0_8px_var(--color-brand-accent-glow)]",
                  compactNeedsConnect &&
                    "bg-warning animate-[pulseGlow_3s_infinite] shadow-[0_0_8px_var(--color-warning)]",
                  !compactPlaying &&
                    !isAwaiting &&
                    !compactNeedsConnect &&
                    "bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-glow)]",
                )}
              ></span>
              <h2>{statusTitle}</h2>
            </div>
            <p className="text-text-secondary m-0 text-[0.8rem] leading-[1.3]">
              {statusSubtitle}
            </p>
            <div className="mt-1 flex w-full flex-col items-center justify-center gap-2">
              {isAwaiting ? (
                <Button
                  variant="danger"
                  size="md"
                  className="w-full text-[0.95rem]"
                  onClick={() => void cancelSession()}
                  disabled={isCancellingLaunch}
                >
                  {isCancellingLaunch ? "Cancelling..." : "Cancel Launch"}
                </Button>
              ) : (
                <Button
                  variant={compactNeedsConnect ? "success" : "primary"}
                  effect="glass"
                  size="md"
                  className="w-full text-[0.95rem]"
                  onClick={() =>
                    compactNeedsConnect
                      ? void runSyncCycle(false)
                      : void openLauncherFromCompact()
                  }
                  disabled={
                    compactNeedsConnect
                      ? isChecking
                      : compactPlaying || isLaunching
                  }
                >
                  {compactNeedsConnect
                    ? isChecking
                      ? "Connecting..."
                      : "Connect"
                    : isLaunching
                      ? "Launching..."
                      : compactPlaying
                        ? "Playing"
                        : "Play"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="md"
                className="w-full text-[0.95rem]"
                onClick={() => void openSetupWindow()}
                disabled={isOpeningOverview}
              >
                {isOpeningOverview ? "Opening..." : "Overview"}
              </Button>
            </div>
          </div>
          {canRenderLauncherStatus ? (
            <div className="absolute inset-x-4 bottom-3 z-10">
              <ServerControlBar
                launcherServerControls={launcherServerControls}
                isServerActionBusy={isServerActionBusy}
                runLauncherServerAction={runLauncherServerAction}
                variant="compact"
              />
            </div>
          ) : null}
        </section>

        <section className="grid shrink-0 grid-cols-4 gap-2">
          <CompactStat
            label="Keep"
            value={catalog?.summary.keep ?? 0}
            className="[&_strong]:text-brand-accent"
          />
          <CompactStat
            label="Add"
            value={catalog?.summary.add ?? 0}
            className="[&_strong]:text-brand-accent"
          />
          <CompactStat
            label="Remove"
            value={catalog?.summary.remove ?? 0}
            className="[&_strong]:text-brand-accent"
          />
          <CompactStat
            label="Update"
            value={catalog?.summary.update ?? 0}
            className="[&_strong]:text-brand-accent"
          />
        </section>

        <footer className="text-text-muted flex shrink-0 items-center justify-between gap-2 font-mono text-[0.75rem]">
          <p>Session: {sessionStatus.phase.replaceAll("_", " ")}</p>
          <p>Last check: {formatTime(lastCheckAt)}</p>
        </footer>
      </div>
    </main>
  );
}
