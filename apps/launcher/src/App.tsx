import { ToastContainer } from "./components/ToastContainer";
import { CompactWindow } from "./components/CompactWindow";
import { SetupWizard } from "./components/SetupWizard";
import { DesktopWorkspace } from "./components/DesktopWorkspace";
import { useAppCore } from "./hooks/useAppCore";

export default function App() {
  const core = useAppCore();
  const { isCompactWindow, isSetupWindow, wizardActive, toasts, APP_NAME } = core;

  if (isCompactWindow) {
    return (
      <>
        <CompactWindow core={core} />
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

        <ToastContainer toasts={toasts} />
      </main>
    );
  }

  return (
    <>
      <DesktopWorkspace core={core} />
      <ToastContainer toasts={toasts} />
    </>
  );
}
