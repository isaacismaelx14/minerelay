import { memo, useRef, type ChangeEventHandler } from 'react';
import { useAdminContext } from './admin-context';

function statusClass(tone: 'idle' | 'ok' | 'error'): string {
  if (tone === 'ok') return 'status ok';
  if (tone === 'error') return 'status error';
  return 'status';
}

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
  return (
    <aside className="nav">
      <div className="brand">
        <h1>MSS+ Client Admin</h1>
        <span className="tag">Single Server Control</span>
      </div>

      <nav className="nav-list" aria-label="Sections">
        <a className="nav-item active" href="#identity">
          Server Identity
        </a>
        <a className="nav-item" href="#matrix">
          Support Matrix
        </a>
        <a className="nav-item" href="#mods">
          Mod Workbench
        </a>
        <a className="nav-item" href="#publish">
          Publish
        </a>
      </nav>
    </aside>
  );
});

const TopBar = memo(function TopBar() {
  const { sessionState, actions } = useAdminContext();

  return (
    <section className="topbar">
      <div>
        Authenticated Session <b>{sessionState}</b>
      </div>
      <button
        className="btn danger"
        type="button"
        onClick={() => void actions.logout()}
      >
        Logout
      </button>
    </section>
  );
});

const CompatibilityRail = memo(function CompatibilityRail() {
  const { rail } = useAdminContext();

  return (
    <section className="panel">
      <h2>Compatibility Rail</h2>
      <div className="chips" aria-live="polite">
        <span className="chip">{rail.minecraft}</span>
        <span className="chip">{rail.fabric}</span>
        <span className="chip">{rail.nextRelease}</span>
      </div>
    </section>
  );
});

const ServerIdentityPanel = memo(function ServerIdentityPanel() {
  const { form, setTextFieldFromEvent, statuses, actions } = useAdminContext();
  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const backgroundUploadRef = useRef<HTMLInputElement | null>(null);

  return (
    <article id="identity" className="panel">
      <h3>Server Identity</h3>
      <p className="hint">
        Save identity and branding drafts. Publish to apply live gameplay
        changes.
      </p>

      <div className="grid two">
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
        <TextInput
          name="currentVersion"
          label="Current Version"
          value={String(form.currentVersion)}
          onChange={setTextFieldFromEvent}
          readOnly
        />
        <TextInput
          name="currentReleaseVersion"
          label="Current Release (SemVer)"
          value={form.currentReleaseVersion}
          onChange={setTextFieldFromEvent}
          readOnly
        />
      </div>

      <div className="grid two">
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
      </div>

      <TextInput
        name="brandingNewsUrl"
        label="Brand News URL"
        value={form.brandingNewsUrl}
        placeholder="https://..."
        onChange={setTextFieldFromEvent}
      />

      <div className="row">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            logoUploadRef.current?.click();
          }}
        >
          Upload Logo Image
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            backgroundUploadRef.current?.click();
          }}
        >
          Upload Background Image
        </button>

        <input
          ref={logoUploadRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void actions.uploadBrandingImage(
              'logo',
              event.currentTarget.files?.[0] ?? null,
            );
            event.currentTarget.value = '';
          }}
        />
        <input
          ref={backgroundUploadRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void actions.uploadBrandingImage(
              'background',
              event.currentTarget.files?.[0] ?? null,
            );
            event.currentTarget.value = '';
          }}
        />
      </div>

      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => void actions.saveDraft()}
        >
          Save Identity and Fancy Draft
        </button>
      </div>

      <div className={statusClass(statuses.draft.tone)}>
        {statuses.draft.text}
      </div>
      <div className={statusClass(statuses.bootstrap.tone)}>
        {statuses.bootstrap.text}
      </div>
    </article>
  );
});

const SupportMatrixPanel = memo(function SupportMatrixPanel() {
  const { form, loaderOptions, setTextFieldFromEvent, statuses, actions } =
    useAdminContext();

  return (
    <article id="matrix" className="panel">
      <h3>Support Matrix</h3>
      <p className="hint">
        App-level supported Minecraft versions and runtime compatibility.
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
          onClick={() => void actions.saveSettings()}
        >
          Save App Settings
        </button>
      </div>

      <div className={statusClass(statuses.settings.tone)}>
        {statuses.settings.text}
      </div>
    </article>
  );
});

const ModWorkbenchPanel = memo(function ModWorkbenchPanel() {
  const {
    form,
    setTextFieldFromEvent,
    searchResults,
    dependencyMap,
    statuses,
    actions,
    isBusy,
  } = useAdminContext();

  return (
    <article id="mods" className="panel">
      <h3>Mod Workbench</h3>
      <p className="hint">
        Search and dependency-check mods before publishing.
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
      <div className="list" aria-live="polite">
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
                    onClick={() => void actions.installMod(result.projectId)}
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
                    <span className="flag">Requires dependencies</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
});

const SelectedModsPanel = memo(function SelectedModsPanel() {
  const { selectedMods, actions } = useAdminContext();

  return (
    <article className="panel">
      <h3>Selected Mods</h3>
      <p className="hint">Published into lockfile items.</p>
      <div className="list" aria-live="polite">
        {selectedMods.length === 0 ? (
          <p className="hint">No mods selected.</p>
        ) : (
          selectedMods.map((mod) => (
            <div
              key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
              className="item"
            >
              <div className="item-head">
                <span className="name">{mod.name}</span>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => actions.removeMod(mod.projectId ?? '')}
                  disabled={!mod.projectId}
                >
                  Remove
                </button>
              </div>
              <div className="meta">Version: {mod.versionId || '-'}</div>
              <div className="meta">URL: {mod.url || '-'}</div>
            </div>
          ))
        )}
      </div>
    </article>
  );
});

const PublishPanel = memo(function PublishPanel() {
  const { form, setTextFieldFromEvent, statuses, actions, isBusy } =
    useAdminContext();
  const bundleUploadRef = useRef<HTMLInputElement | null>(null);

  return (
    <section id="publish" className="panel">
      <h3>Publish</h3>
      <p className="hint">
        Prepare launcher-facing branding, FancyMenu behavior, and release
        publication.
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
          onClick={() => {
            bundleUploadRef.current?.click();
          }}
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
          onClick={() => void actions.publishProfile()}
        >
          {isBusy.publish ? 'Publishing...' : 'Publish Profile'}
        </button>
      </div>

      <div className={statusClass(statuses.publish.tone)}>
        {statuses.publish.text}
      </div>
    </section>
  );
});

export const AdminApp = memo(function AdminApp() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <TopBar />
        <CompatibilityRail />

        <section className="grid two">
          <ServerIdentityPanel />
          <SupportMatrixPanel />
        </section>

        <section className="grid two">
          <ModWorkbenchPanel />
          <SelectedModsPanel />
        </section>

        <PublishPanel />
      </main>
    </div>
  );
});
