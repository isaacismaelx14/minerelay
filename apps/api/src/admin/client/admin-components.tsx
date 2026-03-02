import {
  Suspense,
  lazy,
  memo,
  useEffect,
  useMemo,
  type ReactNode,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react';
import { useAdminContext } from './admin-context';

const FancyPreviewCanvas = lazy(async () => {
  const mod = await import('./fancy-preview');
  return { default: mod.FancyPreviewCanvas };
});

function statusClass(tone: 'idle' | 'ok' | 'error'): string {
  if (tone === 'ok') return 'status ok';
  if (tone === 'error') return 'status error';
  return 'status';
}

const ModalShell = memo(function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') {
            return;
          }

          const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
          );
          if (!focusables || focusables.length === 0) {
            return;
          }

          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!first || !last) {
            return;
          }
          const current = document.activeElement as HTMLElement | null;

          if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
});

const TextInput = memo(function TextInput({
  name,
  label,
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label>
      {label}
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
      />
    </label>
  );
});

const SelectInput = memo(function SelectInput({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label>
      {label}
      <select id={name} name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});

const Sidebar = memo(function Sidebar() {
  const { view, setView } = useAdminContext();

  return (
    <aside className="nav">
      <div className="brand">
        <h1>MSS+ Client Admin</h1>
        <span className="tag">Control Room</span>
      </div>

      <nav className="nav-list" aria-label="Sections">
        <button
          className={`nav-item ${view === 'overview' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('overview')}
        >
          Overview
        </button>
        <button
          className={`nav-item ${view === 'mods' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('mods')}
        >
          Mod Manager
        </button>
        <button
          className={`nav-item ${view === 'fancy' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('fancy')}
        >
          Fancy Menu
        </button>
      </nav>
    </aside>
  );
});

const TopBar = memo(function TopBar() {
  const {
    sessionState,
    hasPendingPublish,
    actions,
    isBusy,
    selectedMods,
    statuses,
  } =
    useAdminContext();

  return (
    <section className="topbar">
      <div className="topbar-meta">
        Authenticated Session <b>{sessionState}</b>
        <span className="meta">Total Mods: {selectedMods.length}</span>
      </div>
      <div className="topbar-actions">
        <button
          className="btn ghost"
          type="button"
          onClick={() => void actions.saveDraft()}
        >
          Save Draft
        </button>
        {hasPendingPublish ? (
          <div className="publish-reminder">
            <span className="requires-publish">Requires Publish</span>
            <button
              className="btn"
              type="button"
              disabled={isBusy.publish}
              onClick={() => void actions.publishProfile()}
            >
              {isBusy.publish ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        ) : (
          <span className="publish-clean">All changes published</span>
        )}
        <button
          className="btn danger"
          type="button"
          onClick={() => void actions.logout()}
        >
          Logout
        </button>
      </div>
      <div className={statusClass(statuses.draft.tone)}>{statuses.draft.text}</div>
    </section>
  );
});

const CompatibilityRail = memo(function CompatibilityRail() {
  const { rail, selectedMods, hasPendingPublish } = useAdminContext();

  return (
    <section className="panel">
      <h2>Compatibility Rail</h2>
      <div className="chips" aria-live="polite">
        <span className="chip">{rail.minecraft}</span>
        <span className="chip">{rail.fabric}</span>
        <span className="chip">{rail.nextRelease}</span>
        <span className="chip">Mods: {selectedMods.length}</span>
        {hasPendingPublish ? (
          <span className="chip warning-chip">Changes require publish</span>
        ) : null}
      </div>
    </section>
  );
});

const SupportMatrixModal = memo(function SupportMatrixModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { form, loaderOptions, setTextFieldFromEvent, actions, statuses } =
    useAdminContext();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <ModalShell onClose={onClose}>
        <div className="modal-head">
          <h3>Support Matrix</h3>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="warning">
          Warning: changing support matrix values can break clients and runtime
          compatibility across your system.
        </p>
        <div className="grid two">
          <label>
            Supported Minecraft Versions (comma-separated)
            <textarea
              name="supportedMinecraftVersions"
              value={form.supportedMinecraftVersions}
              onChange={setTextFieldFromEvent}
            />
          </label>

          <div className="grid">
            <TextInput
              name="minecraftVersion"
              label="Selected Minecraft Version"
              value={form.minecraftVersion}
              placeholder="1.21.1"
              onChange={setTextFieldFromEvent}
            />
            <label>
              Fabric Loader Version
              <select
                id="loaderVersion"
                name="loaderVersion"
                value={form.loaderVersion}
                onChange={setTextFieldFromEvent}
              >
                <option value="">Select loader version</option>
                {loaderOptions.map((entry) => {
                  const suffix = entry.stable ? ' (stable)' : '';
                  return (
                    <option key={entry.version} value={entry.version}>
                      {entry.version}
                      {suffix}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
          />
          I understand this change can break the system.
        </label>

        <div className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => void actions.refreshLoaders()}
          >
            Refresh Fabric Loaders
          </button>
          <button
            type="button"
            className="btn"
            disabled={!confirmed}
            onClick={() => void actions.saveSettings()}
          >
            Save Matrix
          </button>
        </div>

        <div className={statusClass(statuses.settings.tone)}>
          {statuses.settings.text}
        </div>
    </ModalShell>
  );
});

const OverviewPage = memo(function OverviewPage() {
  const {
    form,
    setTextFieldFromEvent,
    statuses,
    actions,
    selectedMods,
    setView,
  } = useAdminContext();
  const [openMatrix, setOpenMatrix] = useState(false);

  return (
    <>
      <section className="grid two">
        <article className="panel">
          <h3>Server Identity</h3>
          <p className="hint">
            Only critical identity fields are editable here.
          </p>

          <div className="grid">
            <TextInput
              name="serverName"
              label="Server Name"
              value={form.serverName}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="serverAddress"
              label="Server Address"
              value={form.serverAddress}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="profileId"
              label="Profile ID"
              value={form.profileId}
              onChange={setTextFieldFromEvent}
            />
          </div>
          <div className="row">
            <span className="meta">Changes are saved to draft from header.</span>
          </div>
          <div className={statusClass(statuses.draft.tone)}>
            {statuses.draft.text}
          </div>
          <div className={statusClass(statuses.bootstrap.tone)}>
            {statuses.bootstrap.text}
          </div>
        </article>

        <article className="panel">
          <h3>Support Matrix</h3>
          <p className="hint">
            Runtime compatibility is guarded behind a warning modal.
          </p>
          <div className="meta">
            Supported: {form.supportedMinecraftVersions || '-'}
          </div>
          <div className="meta">
            Selected MC: {form.minecraftVersion || '-'}
          </div>
          <div className="meta">Loader: {form.loaderVersion || '-'}</div>
          <div className="row">
            <button
              type="button"
              className="btn warning-btn"
              onClick={() => setOpenMatrix(true)}
            >
              Edit Support Matrix
            </button>
          </div>
        </article>
      </section>

      <section className="grid two">
        <article className="panel">
          <h3>Installed Mods</h3>
          <div className="meta">Total: {selectedMods.length}</div>
          <p className="hint">
            List only. Use Mod Manager for edit/remove actions.
          </p>
          <div className="list">
            {selectedMods.length === 0 ? (
              <p className="hint">No mods selected.</p>
            ) : (
              selectedMods.slice(0, 8).map((mod) => (
                <div
                  key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                  className="item"
                >
                  <div className="item-head">
                    <span className="name">{mod.name}</span>
                    {mod.projectId ? (
                      <span className="meta">{mod.projectId}</span>
                    ) : null}
                  </div>
                  <div className="meta">Version: {mod.versionId || '-'}</div>
                </div>
              ))
            )}
          </div>
          <div className="row">
            <button
              className="btn ghost"
              type="button"
              onClick={() => setView('mods')}
            >
              Open Mod Manager
            </button>
          </div>
        </article>

        <article className="panel">
          <h3>Fancy Menu</h3>
          <p className="hint">Manage simple/custom menu setup and preview.</p>
          <div className="meta">
            Feature: {form.fancyMenuEnabled === 'true' ? 'Enabled' : 'Disabled'}
          </div>
          <div className="meta">Mode: {form.fancyMenuMode}</div>
          <div className="row">
            <button
              className="btn ghost"
              type="button"
              onClick={() => setView('fancy')}
            >
              Open Fancy Menu
            </button>
          </div>
        </article>
      </section>

      {openMatrix ? (
        <SupportMatrixModal onClose={() => setOpenMatrix(false)} />
      ) : null}
    </>
  );
});

const ModManagerPage = memo(function ModManagerPage() {
  const {
    form,
    setTextFieldFromEvent,
    searchResults,
    dependencyMap,
    pendingInstall,
    modVersionOptions,
    coreModPolicy,
    selectedMods,
    statuses,
    actions,
    isBusy,
  } = useAdminContext();
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string;
    name: string;
  } | null>(null);

  return (
    <>
      <section className="panel">
        <h3>Mod Search</h3>
        <p className="hint">
          Search, inspect dependencies, then confirm install.
        </p>
        <div className="row">
          <input
            id="searchQuery"
            name="searchQuery"
            value={form.searchQuery}
            placeholder="Search mod by name"
            onChange={setTextFieldFromEvent}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void actions.searchMods();
              }
            }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => void actions.searchMods()}
          >
            {isBusy.search ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className={statusClass(statuses.mods.tone)}>
          {statuses.mods.text}
        </div>
        <div className="list">
          {searchResults.length === 0 ? (
            <p className="hint">No results.</p>
          ) : (
            searchResults.map((result) => {
              const dep = dependencyMap[result.projectId];
              return (
                <div key={result.projectId} className="item">
                  <div className="item-head">
                    <span className="name">
                      {result.title || result.projectId}
                    </span>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        void actions.requestInstall(result.projectId)
                      }
                    >
                      Install
                    </button>
                  </div>
                  <div className="meta">
                    {result.description || 'No description'}
                  </div>
                  <div className="row">
                    <span className="meta">Project: {result.projectId}</span>
                    {dep?.requiresDependencies ? (
                      <span className="flag">
                        {dep.dependencyDetails.length} required dependencies
                      </span>
                    ) : (
                      <span className="flag">No required dependencies</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Installed Mods</h3>
        <div className="meta">Total: {selectedMods.length}</div>
        <p className="hint">Remove and edit versions from this manager only.</p>
        <div className="list">
          {selectedMods.length === 0 ? (
            <p className="hint">No mods selected.</p>
          ) : (
            selectedMods.map((mod) => {
              const projectId = mod.projectId ?? '';
              const isLocked =
                coreModPolicy.nonRemovableProjectIds.includes(projectId);
              const isFabric = projectId === coreModPolicy.fabricApiProjectId;
              const versions = projectId
                ? (modVersionOptions[projectId] ?? [])
                : [];
              const selectedVersion = versions.some(
                (entry) => entry.id === mod.versionId,
              )
                ? mod.versionId
                : '';

              return (
                <div
                  key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                  className="item"
                >
                  <div className="item-head">
                    <span className="name">{mod.name}</span>
                    <div className="row">
                      {isLocked ? (
                        <span className="lock-badge">Locked Core Mod</span>
                      ) : null}
                      <button
                        type="button"
                        className="btn danger"
                        disabled={isLocked || !projectId}
                        onClick={() =>
                          setRemoveTarget({
                            projectId,
                            name: mod.name,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="meta">Project: {projectId || '-'}</div>
                  <div className="meta">Version: {mod.versionId || '-'}</div>
                  {projectId ? (
                    <div className="row">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void actions.loadModVersions(projectId)}
                      >
                        Load Versions
                      </button>
                      {versions.length > 0 ? (
                        <select
                          value={selectedVersion}
                          onChange={(event) =>
                            void actions.applyModVersion(
                              projectId,
                              event.currentTarget.value,
                            )
                          }
                          disabled={isLocked && !isFabric}
                        >
                          <option value="">Select version</option>
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.name} ({version.versionType})
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      {pendingInstall ? (
        <ModalShell onClose={actions.cancelInstall}>
            <div className="modal-head">
              <h3>Install {pendingInstall.title}</h3>
              <button
                className="btn ghost"
                type="button"
                onClick={actions.cancelInstall}
              >
                Close
              </button>
            </div>
            <p className="hint">
              Confirm installation. Dependencies below will be installed
              together.
            </p>
            <div className="list compact">
              {pendingInstall.dependencies.length === 0 ? (
                <p className="hint">No required dependencies.</p>
              ) : (
                pendingInstall.dependencies.map((dep) => (
                  <div key={dep.projectId} className="item">
                    <div className="item-head">
                      <span className="name">{dep.title}</span>
                    </div>
                    <div className="meta">{dep.projectId}</div>
                  </div>
                ))
              )}
            </div>
            <div className="row">
              <button
                className="btn ghost"
                type="button"
                onClick={actions.cancelInstall}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                disabled={isBusy.install}
                onClick={() => void actions.confirmInstall()}
              >
                {isBusy.install ? 'Installing...' : 'Install'}
              </button>
            </div>
        </ModalShell>
      ) : null}
      {removeTarget ? (
        <ModalShell onClose={() => setRemoveTarget(null)}>
            <div className="modal-head">
              <h3>Remove {removeTarget.name}?</h3>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setRemoveTarget(null)}
              >
                Close
              </button>
            </div>
            <p className="warning">
              This mod will be removed from the profile draft. This change
              requires publish to be applied to users.
            </p>
            <div className="row">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  actions.removeMod(removeTarget.projectId);
                  setRemoveTarget(null);
                }}
              >
                Confirm Remove
              </button>
            </div>
        </ModalShell>
      ) : null}
    </>
  );
});

const FancyMenuPage = memo(function FancyMenuPage() {
  const {
    form,
    setTextFieldFromEvent,
    statuses,
    actions,
    fancyPreview,
    fancyPreviewExpiresAt,
    isBusy,
  } = useAdminContext();
  const bundleUploadRef = useRef<HTMLInputElement | null>(null);

  const visibleButtons = useMemo(
    () => fancyPreview?.buttons.filter((button) => button.visible).length ?? 0,
    [fancyPreview],
  );

  return (
    <>
      <section className="panel">
        <h3>Fancy Menu Configuration</h3>
        <p className="hint">
          Keep it simple: button render, logo, text, background, and basic
          custom bundle preview.
        </p>
        <div className="grid two">
          <SelectInput
            name="fancyMenuEnabled"
            label="FancyMenu Enabled"
            value={form.fancyMenuEnabled}
            onChange={setTextFieldFromEvent}
            options={[
              { value: 'true', label: 'Enabled' },
              { value: 'false', label: 'Disabled' },
            ]}
          />
          <SelectInput
            name="fancyMenuMode"
            label="FancyMenu Mode"
            value={form.fancyMenuMode}
            onChange={setTextFieldFromEvent}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'custom', label: 'Custom Bundle' },
            ]}
          />
          <TextInput
            name="playButtonLabel"
            label="Play Button Label"
            value={form.playButtonLabel}
            placeholder="Play"
            onChange={setTextFieldFromEvent}
          />
          <SelectInput
            name="hideSingleplayer"
            label="Hide Singleplayer"
            value={form.hideSingleplayer}
            onChange={setTextFieldFromEvent}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
          <SelectInput
            name="hideMultiplayer"
            label="Hide Multiplayer"
            value={form.hideMultiplayer}
            onChange={setTextFieldFromEvent}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
          <SelectInput
            name="hideRealms"
            label="Hide Realms"
            value={form.hideRealms}
            onChange={setTextFieldFromEvent}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
          <TextInput
            name="brandingLogoUrl"
            label="Brand Logo URL"
            value={form.brandingLogoUrl}
            placeholder="https://..."
            onChange={setTextFieldFromEvent}
          />
          <TextInput
            name="brandingBackgroundUrl"
            label="Brand Background URL"
            value={form.brandingBackgroundUrl}
            placeholder="https://..."
            onChange={setTextFieldFromEvent}
          />
          <TextInput
            name="fancyMenuCustomLayoutUrl"
            label="Custom Layout URL"
            value={form.fancyMenuCustomLayoutUrl}
            placeholder="https://.../bundle.zip"
            onChange={setTextFieldFromEvent}
          />
          <TextInput
            name="fancyMenuCustomLayoutSha256"
            label="Custom Layout SHA256"
            value={form.fancyMenuCustomLayoutSha256}
            placeholder="hex sha256"
            onChange={setTextFieldFromEvent}
          />
        </div>
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => bundleUploadRef.current?.click()}
          >
            Upload FancyMenu Bundle
          </button>
          <input
            ref={bundleUploadRef}
            type="file"
            accept=".zip"
            hidden
            onChange={(event) => {
              void actions.uploadFancyBundle(
                event.currentTarget.files?.[0] ?? null,
              );
              event.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => void actions.rebuildFancyPreview()}
          >
            {isBusy.preview ? 'Rendering...' : 'Refresh Preview'}
          </button>
        </div>
        <div className={statusClass(statuses.fancy.tone)}>
          {statuses.fancy.text}
        </div>
      </section>

      <section className="panel">
        <h3>Fake Minecraft Start Page</h3>
        <p className="hint">
          Preview mode: {fancyPreview?.source || 'n/a'} | visible buttons:{' '}
          {String(visibleButtons)}
        </p>
        {fancyPreviewExpiresAt ? (
          <p className="meta">
            Custom preview assets expire at: {fancyPreviewExpiresAt}
          </p>
        ) : null}
        <Suspense
          fallback={<p className="hint">Loading preview renderer...</p>}
        >
          <FancyPreviewCanvas model={fancyPreview} />
        </Suspense>
        {fancyPreview?.notices?.length ? (
          <div className="list compact">
            {fancyPreview.notices.map((notice, index) => (
              <div key={`${notice}-${String(index)}`} className="item">
                <div className="meta">{notice}</div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
});

export const AdminApp = memo(function AdminApp() {
  const { view } = useAdminContext();

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <TopBar />
        <CompatibilityRail />
        <section key={view} className="view-stage" aria-live="polite">
          {view === 'overview' ? <OverviewPage /> : null}
          {view === 'mods' ? <ModManagerPage /> : null}
          {view === 'fancy' ? <FancyMenuPage /> : null}
        </section>
      </main>
    </div>
  );
});
