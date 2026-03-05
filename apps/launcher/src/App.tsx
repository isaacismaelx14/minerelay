import { ToastContainer } from "./components/ToastContainer";
import { CompactWindow } from "./components/CompactWindow";
import { SetupWizard } from "./components/SetupWizard";
import { DesktopWorkspace } from "./components/DesktopWorkspace";
import { useAppCore } from "./hooks/useAppCore";

export default function App() {
  const core = useAppCore();
  const {
    isCompactWindow,
    isSetupWindow,
    wizardActive,
    toasts,
    APP_NAME,
    isApiSourceMode,
    launcherStreamStatus,
    launcherStreamRetryCount,
    launcherStreamRetryCountdownSec,
    retryLauncherServerStreamNow,
  } = core;

  const showLauncherStreamBadge =
    isApiSourceMode && launcherStreamStatus !== "connected";

  if (isCompactWindow) {
    return (
      <>
        <CompactWindow core={core} />
        {showLauncherStreamBadge ? (
          <div
            className="launcher-stream-indicator"
            role="status"
            aria-live="polite"
          >
            <span
              className="launcher-stream-indicator-dot"
              aria-hidden="true"
            />
            <span className="launcher-stream-indicator-text">
              {launcherStreamStatus === "retrying"
                ? `Lost connection · retrying in ${launcherStreamRetryCountdownSec}s (${launcherStreamRetryCount}/3)`
                : "Lost connection · auto retry stopped"}
            </span>
            {launcherStreamStatus === "disconnected" ? (
              <button
                className="launcher-stream-indicator-btn"
                onClick={() => retryLauncherServerStreamNow()}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (isSetupWindow && wizardActive) {
    return (
      <main className="setup-onboarding-shell">
        <header className="setup-onboarding-head">
          <p className="eyebrow">First-time setup</p>
          <h1>{APP_NAME}</h1>
          <p className="small-dark">Complete onboarding to continue.</p>
        </header>

        <SetupWizard core={core} />

        {showLauncherStreamBadge ? (
          <div
            className="launcher-stream-indicator"
            role="status"
            aria-live="polite"
          >
            <span
              className="launcher-stream-indicator-dot"
              aria-hidden="true"
            />
            <span className="launcher-stream-indicator-text">
              {launcherStreamStatus === "retrying"
                ? `Lost connection · retrying in ${launcherStreamRetryCountdownSec}s (${launcherStreamRetryCount}/3)`
                : "Lost connection · auto retry stopped"}
            </span>
            {launcherStreamStatus === "disconnected" ? (
              <button
                className="launcher-stream-indicator-btn"
                onClick={() => retryLauncherServerStreamNow()}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
        <ToastContainer toasts={toasts} />
      </main>
    );
  }

  return (
    <>
      <DesktopWorkspace core={core} />
      {showLauncherStreamBadge ? (
        <div
          className="launcher-stream-indicator"
          role="status"
          aria-live="polite"
        >
          <span className="launcher-stream-indicator-dot" aria-hidden="true" />
          <span className="launcher-stream-indicator-text">
            {launcherStreamStatus === "retrying"
              ? `Lost connection · retrying in ${launcherStreamRetryCountdownSec}s (${launcherStreamRetryCount}/3)`
              : "Lost connection · auto retry stopped"}
          </span>
          {launcherStreamStatus === "disconnected" ? (
            <button
              className="launcher-stream-indicator-btn"
              onClick={() => retryLauncherServerStreamNow()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <ToastContainer toasts={toasts} />
    </>
  );
}
