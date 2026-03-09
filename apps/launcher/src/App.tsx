import { lazy, Suspense } from "react";
import { ToastProvider } from "@minerelay/ui";
import { ToastContainer } from "./components/ToastContainer";
import { CloseModal } from "./components/CloseModal";
import { CompactWindow } from "./components/CompactWindow";
import { useAppCore } from "./hooks/useAppCore";

const SetupWizard = lazy(() =>
  import("./components/SetupWizard").then((m) => ({ default: m.SetupWizard })),
);
const DesktopWorkspace = lazy(() =>
  import("./components/DesktopWorkspace").then((m) => ({
    default: m.DesktopWorkspace,
  })),
);

export default function App() {
  const core = useAppCore();
  const {
    isCompactWindow,
    isSetupWindow,
    wizardActive,
    toasts,
    APP_NAME,
    isWindows,
    isApiSourceMode,
    launcherStreamStatus,
    launcherStreamRetryCount,
    launcherStreamRetryCountdownSec,
    retryLauncherServerStreamNow,
    contextMenu,
    handleContextMenuRefresh,
    closeModalOpen,
    closeModalVariant,
    handleCloseModalQuit,
    handleCloseModalKeepInBackground,
    handleCloseModalCancel,
  } = core;

  const showLauncherStreamBadge =
    isApiSourceMode && launcherStreamStatus !== "connected";

  if (isCompactWindow) {
    return (
      <ToastProvider>
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
        {contextMenu ? (
          <div
            className="app-context-menu"
            role="menu"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          >
            <button
              className="app-context-menu-item"
              role="menuitem"
              onClick={() => handleContextMenuRefresh()}
            >
              Refresh
            </button>
          </div>
        ) : null}
        {closeModalOpen ? (
          <CloseModal
            variant={closeModalVariant}
            onQuit={handleCloseModalQuit}
            onKeepInBackground={handleCloseModalKeepInBackground}
            onCancel={handleCloseModalCancel}
          />
        ) : null}
      </ToastProvider>
    );
  }

  if (isSetupWindow && wizardActive) {
    return (
      <ToastProvider>
        <main
          className={`setup-onboarding-shell flex h-screen min-h-0 flex-col bg-[radial-gradient(circle_at_top_left,var(--color-brand-primary-ring),transparent_42%),radial-gradient(circle_at_bottom_right,var(--color-brand-secondary),transparent_48%),var(--color-bg-base)] px-4 py-5 ${isWindows ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          <header className="mx-auto grid w-full max-w-3xl shrink-0 gap-2 text-center">
            <p className="text-brand-accent m-0 font-mono text-[0.75rem] font-medium tracking-widest uppercase">
              First-time setup
            </p>
            <h1 className="from-brand-primary to-brand-secondary m-0 bg-linear-to-r bg-clip-text text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1] font-bold tracking-[-0.02em] text-transparent">
              {APP_NAME}
            </h1>
            <p className="text-text-secondary m-0 text-[0.9rem] leading-normal">
              Complete onboarding to continue.
            </p>
          </header>

          <Suspense>
            <SetupWizard core={core} />
          </Suspense>

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
          {contextMenu ? (
            <div
              className="app-context-menu"
              role="menu"
              style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            >
              <button
                className="app-context-menu-item"
                role="menuitem"
                onClick={() => handleContextMenuRefresh()}
              >
                Refresh
              </button>
            </div>
          ) : null}
          {closeModalOpen ? (
            <CloseModal
              variant={closeModalVariant}
              onQuit={handleCloseModalQuit}
              onKeepInBackground={handleCloseModalKeepInBackground}
              onCancel={handleCloseModalCancel}
            />
          ) : null}
        </main>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Suspense>
        <DesktopWorkspace core={core} />
      </Suspense>
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
      {contextMenu ? (
        <div
          className="app-context-menu"
          role="menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          <button
            className="app-context-menu-item"
            role="menuitem"
            onClick={() => handleContextMenuRefresh()}
          >
            Refresh
          </button>
        </div>
      ) : null}
      {closeModalOpen ? (
        <CloseModal
          variant={closeModalVariant}
          onQuit={handleCloseModalQuit}
          onKeepInBackground={handleCloseModalKeepInBackground}
          onCancel={handleCloseModalCancel}
        />
      ) : null}
    </ToastProvider>
  );
}
