import type { useAppCore } from "../hooks/useAppCore";
import { bytesToHuman, formatEta, formatTime, formatDateTime } from "../utils";

export function SetupWizard({ core }: { core: ReturnType<typeof useAppCore> }) {
  const {
    APP_NAME, SERVER_ID, catalog, sessionStatus, wizardStep, setWizardStep,
    profileSourceDraft, setProfileSourceDraft, beginWizardPathsStep,
    wizardProgress, wizardDetection, wizardSelectedLauncherId, setWizardSelectedLauncherId,
    wizardManualLauncherPath, setWizardManualLauncherPath, pickWizardManualLauncherPath,
    wizardMinecraftRootPath, setWizardMinecraftRootPath, pickWizardMinecraftRootPath,
    startWizardDetection, wizardMinecraftRootStatus, continueWizardRuntimeStep,
    versionReadiness, hasFancyMenuMod, fancyMenuMode, hasFancyMenuCustomBundle,
    wizardRuntimeStatus, installFabricRuntime, continueWizardSyncStep,
    canRenderLogo, markLogoAsBroken, serverInitial, wizardSyncing, hasSyncTotal,
    progressPercent, syncHasUnknownTotal, sync, syncBytesLabel, completeWizard
  } = core;

    return (
      <div className="wizard-shell">
        <div className="wizard-steps" aria-label="Onboarding steps">
          <span className={wizardStep === "source" ? "step active" : "step"}>
            1. Source
          </span>
          <span className={wizardStep === "paths" ? "step active" : "step"}>
            2. Paths
          </span>
          <span className={wizardStep === "runtime" ? "step active" : "step"}>
            3. Fabric Runtime
          </span>
          <span className={wizardStep === "sync" ? "step active" : "step"}>
            4. Initial Sync
          </span>
        </div>

        {wizardStep === "source" ? (
          <div className="wizard-panel">
            <h2>Step 1: Connect to Server API</h2>
            <p>
              Set your server API URL to load profile metadata, allowed
              Minecraft versions, and sync catalog.
            </p>
            <input
              className="wizard-input"
              type="text"
              value={profileSourceDraft.apiBaseUrl}
              placeholder="https://api.example.com"
              onChange={(event) =>
                setProfileSourceDraft((current) => ({
                  ...current,
                  apiBaseUrl: event.target.value,
                }))
              }
            />
            <details className="advanced-options" open={!!profileSourceDraft.profileLockUrl || undefined}>
              <summary className="advanced-summary">Advanced: Direct Lock URL</summary>
              <div className="advanced-content" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p className="wizard-meta" style={{ margin: 0 }}>
                  Optional. Override the API and fetch the modpack directly from a URL.
                  Useful for static hosting or testing unreleased versions.
                </p>
                <input
                  className="wizard-input"
                  type="text"
                  value={profileSourceDraft.profileLockUrl}
                  placeholder="https://example.com/lock.json"
                  onChange={(event) =>
                    setProfileSourceDraft((current) => ({
                      ...current,
                      profileLockUrl: event.target.value,
                    }))
                  }
                />
              </div>
            </details>
            <div className="actions-row">
              <button
                className="btn primary"
                onClick={() => void beginWizardPathsStep()}
              >
                Continue to Path Setup
              </button>
              <button className="btn disabled" disabled>
                Log In
                <span className="badge">COMING SOON</span>
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "paths" ? (
          <div className="wizard-panel">
            <h2>Step 2: Launcher and Minecraft Directory</h2>
            <p>
              Auto-detect launchers and launcher directory. If missing, choose
              paths manually.
            </p>

            <div
              className="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={wizardProgress}
            >
              <div
                className="meter-fill"
                style={{ width: `${wizardProgress}%` }}
              />
            </div>
            <p className="wizard-meta">Detection progress: {wizardProgress}%</p>

            <div className="wizard-box">
              <p className="small-dark">Detected launchers</p>
              <select
                className="wizard-select"
                value={wizardSelectedLauncherId}
                onChange={(event) =>
                  setWizardSelectedLauncherId(event.target.value)
                }
              >
                <option value="">No launcher selected</option>
                {wizardDetection?.candidates.map((candidate) => (
                  <option
                    key={`${candidate.id}:${candidate.path}`}
                    value={candidate.id}
                  >
                    {candidate.name} ({candidate.path})
                  </option>
                ))}
                <option value="custom">Custom path</option>
              </select>

              {wizardSelectedLauncherId === "custom" ? (
                <>
                  <input
                    className="wizard-input"
                    type="text"
                    value={wizardManualLauncherPath}
                    placeholder="/Applications/Prism Launcher.app or C:\\...\\MinecraftLauncher.exe"
                    onChange={(event) =>
                      setWizardManualLauncherPath(event.target.value)
                    }
                  />
                  <button
                    className="btn ghost"
                    onClick={() => void pickWizardManualLauncherPath()}
                  >
                    Pick Launcher Path
                  </button>
                </>
              ) : null}
            </div>

            <details className="advanced-options">
              <summary className="advanced-summary">Advanced: Override Minecraft Directory</summary>
              <div className="advanced-content" style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <p className="wizard-meta" style={{ marginBottom: '4px', marginTop: 0 }}>
                  By default, the sync tool automatically targets the default configuration folder
                  of the launcher you selected above. Use this option ONLY if you want to override that behavior 
                  and force a custom absolute data path (like a portable USB drive or multiple specific instances).
                </p>
                <input
                  className="wizard-input"
                  type="text"
                  value={wizardMinecraftRootPath}
                  placeholder="/Users/.../Library/Application Support/minecraft"
                  onChange={(event) =>
                    setWizardMinecraftRootPath(event.target.value)
                  }
                />
                <div className="actions-row">
                  <button
                    className="btn ghost"
                    onClick={() => void pickWizardMinecraftRootPath()}
                  >
                    Pick Minecraft Dir
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => void startWizardDetection()}
                  >
                    Rescan
                  </button>
                </div>
                <p className="wizard-meta">
                  {wizardMinecraftRootStatus?.exists
                    ? "Detected path exists."
                    : "Detected path not found. Select manually."}
                </p>
              </div>
            </details>

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("source")}
              >
                Back
              </button>
              <button
                className="btn primary"
                onClick={() => void continueWizardRuntimeStep()}
                disabled={wizardProgress < 100}
              >
                {wizardProgress < 100 ? "Detecting Launcher..." : "Continue to Runtime Check"}
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "runtime" ? (
          <div className="wizard-panel">
            <h2>Step 3: Fabric Runtime Readiness</h2>
            <p>
              Target: {versionReadiness?.minecraftVersion ?? "--"} /{" "}
              {versionReadiness?.loader ?? "--"}{" "}
              {versionReadiness?.loaderVersion ?? "--"}
            </p>

            <details className="advanced-options">
              <summary className="advanced-summary">Advanced: Technical Details</summary>
              <div className="advanced-content">
                <p className="wizard-meta">
                  Live minecraft dir: {versionReadiness?.liveMinecraftRoot ?? "--"}
                </p>
                <p className="wizard-meta">
                  Managed sync dir: {versionReadiness?.managedMinecraftDir ?? "--"}
                </p>
                <p className="wizard-meta">
                  Allowlisted versions:{" "}
                  {versionReadiness?.allowedMinecraftVersions.join(", ") || "--"}
                </p>
                <p className="wizard-meta">
                  Fabric target id:{" "}
                  {versionReadiness?.expectedFabricVersionId ?? "--"}
                </p>
                <p className="wizard-meta">
                  Managed version target:{" "}
                  {versionReadiness?.expectedManagedVersionId ?? "--"} (
                  {versionReadiness?.managedVersionPresent ? "present" : "missing"})
                </p>
              </div>
            </details>

            <p className="wizard-meta">
              {versionReadiness?.guidance ??
                "Checking runtime compatibility..."}
            </p>
            {catalog?.fancyMenuEnabled && !hasFancyMenuMod ? (
              <p className="wizard-meta" style={{ color: "var(--danger)" }}>
                FancyMenu mod is missing in server profile. Custom menu will not
                apply.
              </p>
            ) : null}
            {catalog?.fancyMenuEnabled &&
            hasFancyMenuMod &&
            fancyMenuMode === "custom" &&
            !hasFancyMenuCustomBundle ? (
              <p className="wizard-meta" style={{ color: "var(--danger)" }}>
                FancyMenu is in custom mode, but the custom bundle is missing in
                profile configs.
              </p>
            ) : null}

            {wizardRuntimeStatus ? (
              <div className="wizard-box">
                <p className="small-dark">Last runtime action</p>
                <p className="wizard-meta">
                  {wizardRuntimeStatus.presentBefore
                    ? `Fabric runtime already present: ${wizardRuntimeStatus.versionId}`
                    : `Installed Fabric runtime: ${wizardRuntimeStatus.versionId}`}
                </p>
                <p className="wizard-meta">
                  Managed version ensured:{" "}
                  {wizardRuntimeStatus.managedVersionId}
                </p>
                <p className="wizard-meta">
                  {wizardRuntimeStatus.managedMessage}
                </p>
              </div>
            ) : null}

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("paths")}
              >
                Back
              </button>
              <button
                className="btn ghost"
                onClick={() => void installFabricRuntime()}
              >
                Install / Ensure Fabric Runtime
              </button>
              <button
                className="btn primary"
                onClick={() => void continueWizardSyncStep()}
                disabled={
                  !versionReadiness?.allowlisted ||
                  !versionReadiness?.foundInMinecraftRootDir
                }
              >
                Continue to Initial Sync
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === "sync" ? (
          <div className="wizard-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: '8px' }}>
              {canRenderLogo ? (
                <img
                  className="wizard-logo"
                  src={catalog?.logoUrl}
                  style={{ width: '48px', height: '48px', borderRadius: '12px', margin: 0 }}
                  alt={`${catalog?.serverName ?? SERVER_ID} logo`}
                  onError={() => markLogoAsBroken(catalog?.logoUrl)}
                />
              ) : (
                <div className="wizard-logo logo-fallback" style={{ width: '48px', height: '48px', borderRadius: '12px', fontSize: '1.2rem', margin: 0 }} aria-hidden="true">
                  {serverInitial}
                </div>
              )}
              <div>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>Step 4: Initial Sync</h2>
                <p className="small" style={{ opacity: 0.7 }}>
                  {catalog?.serverName ?? SERVER_ID}
                </p>
              </div>
            </div>

            <p className="wizard-meta" style={{ fontSize: '0.85rem' }}>
              Profile contains <strong>{catalog?.mods.length ?? 0}</strong> mods and <strong>{catalog?.configs.length ?? 0}</strong> configs.
            </p>

            <ul className="summary-grid compact">
              <li>
                <strong>{catalog?.summary.add ?? 0}</strong>
                <span>Add</span>
              </li>
              <li>
                <strong>{catalog?.summary.remove ?? 0}</strong>
                <span>Remove</span>
              </li>
              <li>
                <strong>{catalog?.summary.update ?? 0}</strong>
                <span>Update</span>
              </li>
              <li>
                <strong>{catalog?.summary.keep ?? 0}</strong>
                <span>Keep</span>
              </li>
            </ul>

            {wizardSyncing ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div
                  className="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={hasSyncTotal ? progressPercent : undefined}
                  aria-valuetext={
                    syncHasUnknownTotal
                      ? "Download progress total unknown"
                      : undefined
                  }
                >
                  <div
                    className={`meter-fill${syncHasUnknownTotal ? " indeterminate" : ""}`}
                    style={{
                      width: syncHasUnknownTotal ? "30%" : `${progressPercent}%`,
                    }}
                  />
                </div>
                <p className="wizard-meta" style={{ marginTop: '4px' }}>
                  {sync.currentFile ?? "Applying sync..."}{" "}
                  {hasSyncTotal ? `(${progressPercent}%)` : ""}
                </p>
                <div className="metrics-row" style={{ marginTop: '0' }}>
                  <span>{syncBytesLabel}</span>
                  <span>{bytesToHuman(sync.speedBps)}/s</span>
                  <span>ETA {formatEta(sync.etaSec)}</span>
                </div>
              </div>
            ) : null}

            <div className="actions-row">
              <button
                className="btn ghost"
                onClick={() => setWizardStep("runtime")}
                disabled={wizardSyncing}
              >
                Back
              </button>
              <button
                className="btn primary"
                onClick={() => void completeWizard()}
                disabled={wizardSyncing}
              >
                {wizardSyncing ? "Syncing..." : "Run Sync and Finish Setup"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
}
