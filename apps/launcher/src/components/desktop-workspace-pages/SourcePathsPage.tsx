import { Button, Card, Details } from "@minerelay/ui";
import type { DesktopWorkspaceCore, DesktopWorkspacePageStyles } from "./types";

export function SourcePathsPage({
  core,
  styles,
}: {
  core: DesktopWorkspaceCore;
  styles: DesktopWorkspacePageStyles;
}) {
  const {
    blockClass,
    paneHeadClass,
    subtitleClass,
    paneGridClass,
    panelCardClass,
    h3Class,
    dataListClass,
    dataItemClass,
    dataLabelClass,
    dataValueClass,
    actionsRowClass,
    primaryButtonClass,
    ghostButtonClass,
    inputBaseClass,
    selectClass,
    detailsClass,
  } = styles;

  const {
    profileSourceDraft,
    setProfileSourceDraft,
    saveProfileSource,
    isActionBusy,
    isApiSourceMode,
    launcherServerControls,
    settings,
    updateLauncherSelection,
    launchers,
    updateCustomPath,
    pickManualLauncherFromSettings,
    instance,
    versionReadiness,
    saveSettings,
    pickMinecraftRootFromSettings,
    refreshVersionReadiness,
  } = core;

  const serverControlReady = Boolean(
    launcherServerControls?.enabled &&
    !launcherServerControls.reason &&
    launcherServerControls.permissions.canViewStatus,
  );

  return (
    <div className={blockClass}>
      <div className={paneHeadClass}>
        <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
          Source & Paths
        </h2>
        <p className={subtitleClass}>
          Configure profile source, launcher executable, and live Minecraft
          root.
        </p>
      </div>

      <div className={paneGridClass}>
        <Card className={panelCardClass}>
          <h3 className={h3Class}>Profile Source</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>API Endpoint</span>
              <input
                className={inputBaseClass}
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
            </div>

            <Details
              className={detailsClass}
              summary="Advanced: Direct Lock URL"
              open={!!profileSourceDraft.profileLockUrl || undefined}
            >
              <p
                className={subtitleClass}
                style={{ margin: 0, fontSize: "0.75rem" }}
              >
                Optional. Override the API and fetch the modpack directly from a
                URL. Useful for static hosting or testing unreleased versions.
              </p>
              <input
                className={inputBaseClass}
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
            </Details>

            <Button
              className={primaryButtonClass}
              onClick={() => void saveProfileSource()}
              disabled={isActionBusy("source:save")}
            >
              {isActionBusy("source:save") ? "Saving..." : "Save Source"}
            </Button>
          </div>
        </Card>

        {isApiSourceMode ? (
          <Card className={panelCardClass}>
            <h3 className={h3Class}>Server Control Pairing</h3>
            {serverControlReady ? (
              <div className={dataListClass}>
                <div className={dataItemClass}>
                  <span className={dataLabelClass}>Pairing Status</span>
                  <div className={dataValueClass}>Ready</div>
                </div>
                <p className={subtitleClass}>
                  This installation is already paired for server control.
                </p>
              </div>
            ) : (
              <>
                <p className={subtitleClass}>
                  Pairing is pending. Ask the admin for a one-time pairing code
                  and save it here.
                </p>
                <div className={dataListClass}>
                  <div className={dataItemClass}>
                    <span className={dataLabelClass}>Pairing Code</span>
                    <input
                      className={inputBaseClass}
                      type="text"
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
                  <Button
                    className={ghostButtonClass}
                    onClick={() => void saveProfileSource()}
                    disabled={isActionBusy("source:save")}
                  >
                    {isActionBusy("source:save")
                      ? "Saving..."
                      : "Save Pairing Code"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        ) : null}

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Launcher</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Application</span>
              <select
                className={selectClass}
                value={settings?.selectedLauncherId ?? ""}
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml;utf8,<svg fill=\"none\" stroke=\"%239ca3af\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 9l-7 7-7-7\"></path></svg>")',
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 14px center",
                  backgroundSize: "16px",
                }}
                onChange={(event) =>
                  void updateLauncherSelection(event.target.value)
                }
              >
                <option value="">No launcher selected</option>
                {launchers
                  .filter((candidate) => candidate.id !== "custom")
                  .map((candidate) => (
                    <option
                      key={`${candidate.id}:${candidate.path}`}
                      value={candidate.id}
                    >
                      {candidate.name}
                    </option>
                  ))}
                <option value="custom">Custom path</option>
              </select>
            </div>

            {settings?.selectedLauncherId === "custom" ? (
              <div className={dataItemClass}>
                <span className={dataLabelClass}>Custom Bin Path</span>
                <div style={{ display: "grid", gap: "8px" }}>
                  <input
                    className={inputBaseClass}
                    type="text"
                    value={settings.customLauncherPath ?? ""}
                    placeholder="/Applications/Minecraft.app or C:\\...\\MinecraftLauncher.exe"
                    onChange={(event) =>
                      void updateCustomPath(event.target.value)
                    }
                  />
                  <Button
                    className={ghostButtonClass}
                    onClick={() => void pickManualLauncherFromSettings()}
                    disabled={isActionBusy("settings:pickLauncherPath")}
                  >
                    {isActionBusy("settings:pickLauncherPath")
                      ? "Picking..."
                      : "Pick Launcher Path"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-l-brand-indigo rounded-md border-l-[3px] bg-[rgba(255,255,255,0.03)] p-3">
                <p
                  className={subtitleClass}
                  style={{ margin: 0, fontSize: "0.8rem" }}
                >
                  Choosing a managed launcher (like Prism) allows the app to
                  automatically discover your instance directories and handle
                  icon sync.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className={panelCardClass}>
          <h3 className={h3Class}>Paths</h3>
          <div className={dataListClass}>
            <div className={dataItemClass}>
              <span className={dataLabelClass}>Sync Base Root</span>
              <div className={dataValueClass}>
                {instance?.instanceRoot ?? "--"}
              </div>
            </div>

            <div className={dataItemClass}>
              <span className={dataLabelClass}>Managed Game Dir</span>
              <div className={dataValueClass}>
                {instance?.minecraftDir ?? "--"}
              </div>
            </div>

            <div className={dataItemClass}>
              <span className={dataLabelClass}>Live Game Dir</span>
              <div className={dataValueClass}>
                {versionReadiness?.liveMinecraftRoot ?? "--"}
              </div>
            </div>

            <Details
              className={detailsClass}
              summary="Advanced: Override Live Directory"
            >
              <p
                className={subtitleClass}
                style={{
                  fontSize: "0.75rem",
                  marginBottom: "8px",
                  marginTop: 0,
                }}
              >
                By default, the sync tool targets the standard data folder of
                your chosen launcher. Specify an absolute path below to force a
                different live directory.
              </p>
              <input
                className={inputBaseClass}
                type="text"
                value={settings?.minecraftRootOverride ?? ""}
                placeholder="Leave empty for default launcher dir"
                onChange={(event) =>
                  settings
                    ? void saveSettings({
                        ...settings,
                        minecraftRootOverride:
                          event.target.value.trim() || null,
                      })
                    : undefined
                }
              />
              <div className={actionsRowClass}>
                <Button
                  className={ghostButtonClass}
                  onClick={() => void pickMinecraftRootFromSettings()}
                  disabled={isActionBusy("settings:pickMinecraftPath")}
                >
                  {isActionBusy("settings:pickMinecraftPath")
                    ? "Picking..."
                    : "Pick Dir"}
                </Button>
                <Button
                  className={ghostButtonClass}
                  onClick={() => void refreshVersionReadiness()}
                >
                  Refresh
                </Button>
              </div>
              <p
                className={subtitleClass}
                style={{ fontSize: "0.7rem", marginTop: "4px" }}
              >
                Ready:{" "}
                {versionReadiness?.foundInMinecraftRootDir ? "YES" : "NO"} |
                Allowlisted: {versionReadiness?.allowlisted ? "YES" : "NO"}
              </p>
            </Details>
          </div>
        </Card>
      </div>
    </div>
  );
}
