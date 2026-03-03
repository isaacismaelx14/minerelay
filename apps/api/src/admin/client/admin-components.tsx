import {
  memo,
  useEffect,
  useMemo,
  type ReactNode,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react';
import { createPortal } from 'react-dom';

import { useAdminContext } from './admin-context';
import { requestJson } from './http';

function statusClass(tone: 'idle' | 'ok' | 'error'): string {
  if (tone === 'ok') return 'status ok';
  if (tone === 'error') return 'status error';
  return 'status';
}

function exarotonStatusClass(status: number): string {
  if (status === 1) return 'status-chip status-chip-online';
  if (status === 7) return 'status-chip status-chip-crashed';
  if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status)) {
    return 'status-chip status-chip-busy';
  }
  return 'status-chip status-chip-offline';
}

const DataList = memo(function DataList({ children }: { children: ReactNode }) {
  return <div className="data-list">{children}</div>;
});

const DataItem = memo(function DataItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="data-item">
      <span className="data-label">{label}</span>
      <span className="data-value">{value || '-'}</span>
    </div>
  );
});

const ModalShell = memo(function ModalShell({
  onClose,
  children,
  cardClassName,
}: {
  onClose: () => void;
  children: ReactNode;
  cardClassName?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    // Focus the first input if available, otherwise the first focusable
    const inputs = cardRef.current?.querySelectorAll<HTMLElement>('input,textarea');
    const firstInput = inputs?.[0];
    if (firstInput) {
      firstInput.focus();
    } else {
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      focusables?.[0]?.focus();
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <div
        ref={cardRef}
        className={cardClassName || 'modal-card'}
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
    </div>,
    document.body,
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
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Overview</span>
        </button>
        <button
          className={`nav-item ${view === 'identity' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('identity')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <span>Identity</span>
        </button>
        <button
          className={`nav-item ${view === 'mods' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('mods')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Mod Manager</span>
        </button>
        <button
          className={`nav-item ${view === 'fancy' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('fancy')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.5 1.5"></path>
            <path d="M14 11l4 4"></path>
          </svg>
          <span>Fancy Menu</span>
        </button>
        <button
          className={`nav-item ${view === 'exaroton' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('exaroton')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 18a4.6 4.4 0 0 1 0-9 5.5 5.5 0 0 1 10.7-1.2A4 4 0 1 1 18 18"></path>
            <path d="M12 12v6"></path>
            <path d="M9.5 15.5 12 18l2.5-2.5"></path>
          </svg>
          <span>Exaroton</span>
        </button>
      </nav>
    </aside>
  );
});

const ExarotonPage = memo(function ExarotonPage() {
  const { exaroton, statuses, actions } = useAdminContext();

  return (
    <section className="grid exaroton-grid">
      <article className="panel exaroton-panel">
        <h2>Exaroton Integration</h2>
        <p className="hint">
          Optionally connect your Exaroton account to manage your selected server from this panel.
        </p>

        {!exaroton.configured ? (
          <div className="exaroton-warning">
            <strong>Integration not configured</strong>
            <p>
              Set <code>EXAROTON_ENCRYPTION_KEY</code> on the API server first.
            </p>
          </div>
        ) : null}

        {!exaroton.connected ? (
          <div className="exaroton-connect-box">
            <p className="hint">
              Generate your API token at{' '}
              <a href="https://exaroton.com/account/" target="_blank" rel="noreferrer">
                exaroton.com/account
              </a>
            </p>

            <label>
              Exaroton API Key
              <div className="key-row">
                <input
                  name="exarotonApiKey"
                  type={exaroton.showApiKey ? 'text' : 'password'}
                  value={exaroton.apiKeyInput}
                  placeholder="Enter your Exaroton API key"
                  onChange={(event) =>
                    actions.setExarotonApiKey(event.currentTarget.value)
                  }
                  disabled={!exaroton.configured || exaroton.busy}
                />
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => actions.toggleExarotonApiKeyVisibility()}
                  disabled={!exaroton.configured || exaroton.busy}
                >
                  {exaroton.showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn"
                type="button"
                disabled={!exaroton.configured || exaroton.busy}
                onClick={() => void actions.connectExaroton()}
              >
                {exaroton.busy ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="exaroton-account-row">
              <div>
                <strong>{exaroton.accountName || 'Connected account'}</strong>
                <p className="hint">{exaroton.accountEmail || 'Email unavailable'}</p>
              </div>
              <div className="row">
                <button
                  className="btn ghost"
                  type="button"
                  disabled={exaroton.busy}
                  onClick={() => void actions.refreshExarotonStatus()}
                >
                  Refresh
                </button>
                <button
                  className="btn danger"
                  type="button"
                  disabled={exaroton.busy}
                  onClick={() => void actions.disconnectExaroton()}
                >
                  Disconnect
                </button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Select Server</h3>
              <button
                className="btn ghost"
                type="button"
                disabled={exaroton.busy}
                onClick={() => void actions.listExarotonServers()}
              >
                Reload Servers
              </button>
            </div>

            <div className="exaroton-server-list" role="list">
              {exaroton.servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  className={`exaroton-server-item ${
                    exaroton.selectedServer?.id === server.id ? 'active' : ''
                  }`}
                  onClick={() => void actions.selectExarotonServer(server.id)}
                  disabled={exaroton.busy}
                >
                  <div>
                    <strong>{server.name}</strong>
                    <p>{server.address}</p>
                  </div>
                  <span className={exarotonStatusClass(server.status)}>
                    {server.statusLabel}
                  </span>
                </button>
              ))}
              {!exaroton.servers.length ? (
                <p className="hint">No servers loaded yet. Click “Reload Servers”.</p>
              ) : null}
            </div>

            {exaroton.selectedServer ? (
              <article className="exaroton-selected-card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>{exaroton.selectedServer.name}</h3>
                    <p className="hint">{exaroton.selectedServer.address}</p>
                  </div>
                  <span className={exarotonStatusClass(exaroton.selectedServer.status)}>
                    {exaroton.selectedServer.statusLabel}
                  </span>
                </div>
                <DataList>
                  <DataItem
                    label="Players"
                    value={`${exaroton.selectedServer.players.count}/${exaroton.selectedServer.players.max}`}
                  />
                  <DataItem
                    label="Software"
                    value={
                      exaroton.selectedServer.software
                        ? `${exaroton.selectedServer.software.name} ${exaroton.selectedServer.software.version}`
                        : 'Unknown'
                    }
                  />
                </DataList>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void actions.exarotonAction('start')}
                  >
                    Start
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void actions.exarotonAction('restart')}
                  >
                    Restart
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    disabled={exaroton.busy}
                    onClick={() => void actions.exarotonAction('stop')}
                  >
                    Stop
                  </button>
                </div>
              </article>
            ) : null}
          </>
        )}

        <div className={statusClass(statuses.exaroton.tone)}>{statuses.exaroton.text}</div>
        {exaroton.error ? <p className="hint">{exaroton.error}</p> : null}
      </article>
    </section>
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
  const {
    form,
    baselineRuntime,
    loaderOptions,
    setTextFieldFromEvent,
    actions,
    statuses,
  } = useAdminContext();
  const [confirmed, setConfirmed] = useState(false);

  const hasChanges =
    form.minecraftVersion.trim() !== baselineRuntime.minecraftVersion.trim() ||
    form.loaderVersion.trim() !== baselineRuntime.loaderVersion.trim();

  return (
    <ModalShell onClose={onClose}>
        <button
          className="modal-close-icon"
          type="button"
          onClick={onClose}
          title="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 18, height: 18 }}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="modal-head">
          <div className="modal-brand">
            <h3>Support Matrix</h3>
            <p className="meta">Internal Runtime Settings</p>
          </div>
        </div>
        <div className="alert-box danger">
          <strong>Risk Warning</strong>
          <p>
            Altering support matrix values can break launcher bootup and runtime
            compatibility. This action requires server-side validation.
          </p>
        </div>
        <div className="grid two">
          <TextInput
            name="minecraftVersion"
            label="Selected Minecraft Version"
            value={form.minecraftVersion}
            placeholder="1.21.1"
            onChange={setTextFieldFromEvent}
          />
          <div className="data-item">
            <span className="data-label">Fabric Loader Version</span>
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
          </div>
        </div>

        {hasChanges ? (
          <>
            <label className="check danger">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.currentTarget.checked)}
              />
              <span>I understand this change can break the system.</span>
            </label>

            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => void actions.refreshLoaders()}
              >
                Refresh Loader List
              </button>
              <div className="btn-wrapper">
                <button
                  type="button"
                  className="btn"
                  disabled={!confirmed}
                  onClick={() => {
                    void actions.saveSettings();
                    onClose();
                  }}
                >
                  Save Matrix
                </button>
                {!confirmed && (
                  <span className="btn-tooltip">Confirm to enable save</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => void actions.refreshLoaders()}
            >
              Refresh Loader List
            </button>
          </div>
        )}

        <div className={statusClass(statuses.settings.tone)}>
          {statuses.settings.text}
        </div>
    </ModalShell>
  );
});

const OverviewPage = memo(function OverviewPage() {
  const {
    form,
    selectedMods,
    setView,
    summaryStats,
    rail,
  } = useAdminContext();

  return (
    <>
      <div className="summary-bar">
        <div className="summary-item add">
          <span className="summary-value">{summaryStats.add}</span>
          <span className="summary-label">Add</span>
        </div>
        <div className="summary-item remove">
          <span className="summary-value">{summaryStats.remove}</span>
          <span className="summary-label">Remove</span>
        </div>
        <div className="summary-item update">
          <span className="summary-value">{summaryStats.update}</span>
          <span className="summary-label">Update</span>
        </div>
        <div className="summary-item keep">
          <span className="summary-value">{summaryStats.keep}</span>
          <span className="summary-label">Keep</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <h3>Instance Profile</h3>
            <button className="btn ghost" onClick={() => setView('identity')}>Edit</button>
          </div>
          <DataList>
            <DataItem label="Profile Name" value={form.serverName} />
            <DataItem label="Runtime" value={`${rail.minecraft} | ${rail.fabric}`} />
            <DataItem label="Endpoint" value={form.serverAddress} />
          </DataList>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Content Catalog</h3>
            <button className="btn ghost" onClick={() => setView('mods')}>Manage</button>
          </div>
          <DataList>
            <DataItem label="Total Mods" value={selectedMods.length} />
            <DataItem label="Core Mods" value="2 (Locked)" />
            <DataItem label="Update Status" value={summaryStats.update > 0 ? `${summaryStats.update} pending` : 'All current'} />
          </DataList>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Display & Menu</h3>
            <button className="btn ghost" onClick={() => setView('fancy')}>Setup</button>
          </div>
          <DataList>
            <DataItem label="Status" value={form.fancyMenuEnabled === 'true' ? 'Active' : 'Bypass'} />
            <DataItem label="Mode" value={form.fancyMenuMode === 'custom' ? 'Custom Bundle' : 'Simplified'} />
            <DataItem label="Custom Brand" value={form.brandingLogoUrl ? 'Logo Set' : 'Default'} />
          </DataList>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Recent Mods</h3>
          </div>
          <div className="list compact">
            {selectedMods.slice(0, 5).map((mod) => (
              <div key={mod.projectId || mod.name} className="item">
                <span className="name">{mod.name}</span>
                <span className="meta">{mod.versionId || 'Custom'}</span>
              </div>
            ))}
            {selectedMods.length > 5 && (
              <span className="meta">
                and {selectedMods.length - 5} more...
              </span>
            )}
          </div>
        </article>
      </div>
    </>
  );
});

const IdentityPage = memo(function IdentityPage() {
  const { form, setTextFieldFromEvent, actions } = useAdminContext();
  const [openMatrix, setOpenMatrix] = useState(false);

  return (
    <>
      <div className="grid two">
        <article className="panel">
          <h3>Server Identity</h3>
          <p className="hint">
            Master identification and connection endpoints.
          </p>

          <div className="grid">
            <TextInput
              name="serverName"
              label="Display Name"
              value={form.serverName}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="serverAddress"
              label="Server Address (IP/Host)"
              value={form.serverAddress}
              onChange={setTextFieldFromEvent}
            />
            <TextInput
              name="profileId"
              label="Profile Identifier"
              value={form.profileId}
              onChange={setTextFieldFromEvent}
              readOnly
            />
          </div>
        </article>

        <article className="panel">
          <h3>Runtime & Compatibility</h3>
          <p className="hint">Minecraft and Fabric loader configuration.</p>

          <DataList>
            <DataItem label="MC Version" value={form.minecraftVersion} />
            <DataItem label="Loader" value={form.loaderVersion} />
          </DataList>

          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => setOpenMatrix(true)}
            >
              Update Runtime Settings
            </button>
          </div>
        </article>

        <article className="panel">
          <h3>Branding & Assets</h3>
          <p className="hint">Visual identity for the launcher and menu.</p>

          <div className="grid">
            <div className="image-field">
              <div className="image-preview-box">
                {form.brandingLogoUrl ? (
                  <img src={form.brandingLogoUrl} alt="Logo" />
                ) : (
                  <span>Icon</span>
                )}
              </div>
              <div className="upload-controls">
                <span className="data-label">Server Logo / Icon</span>
                <div className="file-input-wrapper">
                  <button className="btn ghost" type="button">
                    Change Icon
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void actions.uploadBrandingImage(
                        'logo',
                        e.target.files?.[0] || null,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="image-field">
              <div className="image-preview-box">
                {form.brandingBackgroundUrl ? (
                  <img src={form.brandingBackgroundUrl} alt="BG" />
                ) : (
                  <span>BG</span>
                )}
              </div>
              <div className="upload-controls">
                <span className="data-label">Background Wallpaper</span>
                <div className="file-input-wrapper">
                  <button className="btn ghost" type="button">
                    Change BG
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void actions.uploadBrandingImage(
                        'background',
                        e.target.files?.[0] || null,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <TextInput
              name="brandingNewsUrl"
              label="Server News Feed URL (RSS/JSON)"
              value={form.brandingNewsUrl || ''}
              placeholder="https://server.com/news.json"
              onChange={setTextFieldFromEvent}
            />
          </div>
        </article>
      </div>

      {openMatrix && (
        <SupportMatrixModal onClose={() => setOpenMatrix(false)} />
      )}
    </>
  );
});

const CART_STORAGE_KEY = 'admin-mod-cart';

type CartEntry = {
  projectId: string;
  title: string;
  iconUrl?: string;
  slug?: string;
  deps: Array<{ projectId: string; title: string }>;
};

function loadCartFromStorage(): CartEntry[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartEntry[]) : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(cart: CartEntry[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignore
  }
}

const ExternalLinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="13"
    height="13"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

const AddModsModal = memo(function AddModsModal({
  onClose,
  onInstall,
}: {
  onClose: () => void;
  onInstall: (cart: CartEntry[]) => void;
}) {
  const {
    searchResults,
    dependencyMap,
    selectedMods,
    statuses,
    actions,
    isBusy,
    form,
  } = useAdminContext();

  const [cart, setCart] = useState<CartEntry[]>(loadCartFromStorage);
  const [localQuery, setLocalQuery] = useState('');
  const [isLoadingPopular, setIsLoadingPopular] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRestored = useRef(loadCartFromStorage().length > 0);

  // Load most-followed mods on first open (when there's no prior search)
  useEffect(() => {
    if (searchResults.length > 0 || localQuery) return;
    const mcVersion = form.minecraftVersion.trim();
    setIsLoadingPopular(true);

    // Use backend endpoint with proper authentication instead of direct API call
    const searchParams = new URLSearchParams({
      query: '', // Empty query to get popular mods
      minecraftVersion: mcVersion,
    });

    requestJson<Array<{
      projectId: string;
      slug: string;
      title: string;
      description: string;
      author: string;
      iconUrl?: string;
      categories?: string[];
      latestVersion?: string;
    }>>(`/v1/admin/mods/search?${searchParams}`, 'GET')
      .then((results) => {
        // The backend already returns the data in the correct format
        const mappedResults = results.map((h) => ({
          projectId: h.projectId,
          slug: h.slug,
          title: h.title,
          description: h.description,
          author: h.author,
          iconUrl: h.iconUrl,
          categories: h.categories,
          latestVersion: h.latestVersion,
        }));
        // Only populate if still no user query has been typed
        actions.setSearchQuery('');
        // Directly set results via a workaround: call context setter (we use searchMods side-effect)
        // Since we can't call setSearchResults directly, we store locally
        if (mappedResults.length > 0) {
          setPopularResults(mappedResults);
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setIsLoadingPopular(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [popularResults, setPopularResults] = useState<typeof searchResults>([]);
  const displayResults = localQuery ? searchResults : (searchResults.length > 0 ? searchResults : popularResults);
  const isPopularView = !localQuery && searchResults.length === 0 && popularResults.length > 0;

  const installedIds = useMemo(
    () => new Set(selectedMods.map((m) => m.projectId).filter(Boolean) as string[]),
    [selectedMods],
  );

  const cartIds = useMemo(() => new Set(cart.map((c) => c.projectId)), [cart]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setLocalQuery(value);
    // Update the form field too so actions.searchMods() reads it
    actions.setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        void actions.searchMods();
      }
    }, 500);
  };

  const addToCart = async (result: (typeof searchResults)[number]) => {
    if (cartIds.has(result.projectId) || installedIds.has(result.projectId)) return;

    let deps: Array<{ projectId: string; title: string }> = [];
    const fromCache = dependencyMap[result.projectId];
    if (fromCache) {
      deps = fromCache.dependencyDetails;
    } else if (form.minecraftVersion.trim()) {
      try {
        const analysis = await actions.analyzeDeps(result.projectId);
        deps = analysis?.dependencyDetails ?? [];
      } catch {
        // ignore
      }
    }

    const entry: CartEntry = {
      projectId: result.projectId,
      title: result.title,
      iconUrl: result.iconUrl,
      slug: result.slug,
      deps,
    };
    setCart((prev) => {
      const next = [...prev, entry];
      saveCartToStorage(next);
      return next;
    });
  };

  const removeFromCart = (projectId: string) => {
    setCart((prev) => {
      const next = prev.filter((c) => c.projectId !== projectId);
      saveCartToStorage(next);
      return next;
    });
  };

  const clearCart = () => {
    setCart([]);
    saveCartToStorage([]);
  };

  const handleInstall = () => {
    if (cart.length === 0) return;
    onInstall(cart);
    saveCartToStorage([]);
    setCart([]);
  };

  return (
    <ModalShell onClose={onClose} cardClassName="modal-card wide">
      {/* Header */}
      <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Add Mods</h3>
        <button className="modal-close-icon" type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

        {wasRestored.current && cart.length > 0 && (
          <div style={{
            padding: '8px 20px',
            fontSize: '0.75rem',
            color: 'var(--warning)',
            background: 'rgba(245,158,11,0.07)',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}>
            ⚡ Cart restored from previous session.
          </div>
        )}

        {/* Main layout: search pane | cart pane */}
        <div className="add-mods-layout" style={{ flex: 1, minHeight: 0 }}>
          {/* Left: Search */}
          <div className="add-mods-search-pane">
            <div className="add-mods-search-bar">
              <input
                id="addModsSearch"
                value={localQuery}
                onChange={handleQueryChange}
                placeholder="Search Modrinth..."
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    void actions.searchMods();
                  }
                }}
              />
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '8px 14px', flexShrink: 0 }}
                onClick={() => void actions.searchMods()}
                disabled={isBusy.search}
              >
                {isBusy.search ? (
                  <span className="search-spinner" />
                ) : (
                  'Search'
                )}
              </button>
            </div>

            <div className={statusClass(statuses.mods.tone)} style={{ flexShrink: 0 }}>
              {isPopularView ? '⭐ Most popular mods (by followers)' : statuses.mods.text}
            </div>

            <div className="add-mods-search-results">
              {isLoadingPopular ? (
                <p className="hint" style={{ margin: 0 }}>Loading popular mods...</p>
              ) : displayResults.length === 0 ? (
                <p className="hint" style={{ margin: 0 }}>
                  {localQuery ? 'No results. Try a different query.' : 'Search for a mod to get started.'}
                </p>
              ) : (
                displayResults.map((result) => {
                  const dep = dependencyMap[result.projectId];
                  const inCart = cartIds.has(result.projectId);
                  const installed = installedIds.has(result.projectId);
                  return (
                    <div
                      key={result.projectId}
                      className={`search-result-card${inCart ? ' in-cart' : ''}${installed ? ' already-installed' : ''}`}
                    >
                      <img
                        src={result.iconUrl || 'https://modrinth.com/favicon.ico'}
                        alt={result.title}
                        className="search-result-icon"
                        onError={(e) => (e.currentTarget.src = 'https://modrinth.com/favicon.ico')}
                      />
                      <div className="search-result-info">
                        <div className="search-result-name">
                          <a
                            href={`https://modrinth.com/mod/${result.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="modrinth-title-link"
                            title="View on Modrinth"
                          >
                            {result.title}
                            <ExternalLinkIcon />
                          </a>
                        </div>
                        <div className="search-result-sub">
                          {result.author && <span>by {result.author}</span>}
                          {result.latestVersion && <span>{result.latestVersion}</span>}
                          {dep ? (
                            dep.requiresDependencies ? (
                              <span className="dep-badge has-deps">+{dep.dependencyDetails.length} deps</span>
                            ) : (
                              <span className="dep-badge no-deps">No deps</span>
                            )
                          ) : null}
                          {installed && <span style={{ color: 'var(--success)' }}>✓ Installed</span>}
                          {inCart && !installed && <span style={{ color: 'var(--brand-primary)' }}>✓ In cart</span>}
                        </div>
                      </div>
                      <div>
                        {installed ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Installed</span>
                        ) : inCart ? (
                          <button
                            type="button"
                            className="btn danger"
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                            onClick={() => removeFromCart(result.projectId)}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                            onClick={() => void addToCart(result)}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Cart */}
          <div className="add-mods-cart-pane">
            <div className="add-mods-cart-title">
              Queue
              {cart.length > 0 && (
                <span className="cart-count-badge">{cart.length}</span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <span style={{ fontSize: '2rem' }}>🧺</span>
                <span>Add mods from search to queue them for install.</span>
              </div>
            ) : (
              <div className="add-mods-cart-list">
                {cart.map((entry) => (
                  <div key={entry.projectId} className="cart-item">
                    <img
                      src={entry.iconUrl || 'https://modrinth.com/favicon.ico'}
                      alt={entry.title}
                      className="cart-item-icon"
                      onError={(e) => (e.currentTarget.src = 'https://modrinth.com/favicon.ico')}
                    />
                    <div className="cart-item-info" style={{ minWidth: 0 }}>
                      <div className="cart-item-name">
                        <a
                          href={`https://modrinth.com/mod/${entry.slug ?? entry.projectId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="modrinth-title-link"
                          title="View on Modrinth"
                        >
                          {entry.title}
                          <ExternalLinkIcon />
                        </a>
                      </div>
                      {entry.deps.length > 0 && (
                        <div className="cart-item-deps">+{entry.deps.length} deps</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                      onClick={() => removeFromCart(entry.projectId)}
                      title="Remove from cart"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="add-mods-footer">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            {cart.length > 0 && (
              <button
                type="button"
                className="btn ghost"
                style={{ color: 'var(--danger)' }}
                onClick={clearCart}
              >
                Clear All
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn"
            disabled={cart.length === 0 || isBusy.install}
            onClick={handleInstall}
          >
            {isBusy.install ? 'Installing...' : `Install ${cart.length > 0 ? `${String(cart.length)} mod${cart.length !== 1 ? 's' : ''}` : 'queue'}`}
          </button>
      </div>
    </ModalShell>
  );
});

const ModManagerPage = memo(function ModManagerPage() {
  const {
    modVersionOptions,
    coreModPolicy,
    selectedMods,
    statuses,
    actions,
  } = useAdminContext();

  const [showAddMods, setShowAddMods] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string;
    sha256: string;
    name: string;
  } | null>(null);

  const coreMods = useMemo(
    () => selectedMods.filter((m) => m.projectId && coreModPolicy.lockedProjectIds.includes(m.projectId)),
    [selectedMods, coreModPolicy],
  );

  const userMods = useMemo(
    () => selectedMods.filter((m) => !(m.projectId && coreModPolicy.lockedProjectIds.includes(m.projectId))),
    [selectedMods, coreModPolicy],
  );

  const handleInstallCart = async (cart: CartEntry[]) => {
    for (const entry of cart) {
      await actions.requestAndConfirmInstall(entry.projectId);
    }
    setShowAddMods(false);
  };

  const ModGridCard = ({ mod }: { mod: typeof selectedMods[number] }) => {
    const projectId = mod.projectId ?? '';
    const isLocked = coreModPolicy.nonRemovableProjectIds.includes(projectId);
    const isFabric = projectId === coreModPolicy.fabricApiProjectId;
    const versions = projectId ? (modVersionOptions[projectId] ?? []) : [];
    const selectedVersion = versions.some((v) => v.id === mod.versionId) ? mod.versionId : '';

    return (
      <div className={`mod-grid-card${isLocked ? ' core-mod' : ''}`}>
        {isLocked && (
          <span className="lock-badge mod-grid-badge" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
            Core
          </span>
        )}
        <img
          src={
            mod.iconUrl ||
            (mod.projectId
              ? `https://cdn.modrinth.com/data/${mod.projectId}/icon.png`
              : 'https://modrinth.com/favicon.ico')
          }
          alt={mod.name}
          className="mod-grid-icon"
          onError={(e) => {
            e.currentTarget.src = 'https://modrinth.com/favicon.ico';
          }}
        />
        <div className="mod-grid-name">{mod.name}</div>
        {mod.versionId && (
          <div className="mod-grid-meta" title={mod.versionId}>{mod.versionId}</div>
        )}
        {mod.slug && (
          <a
            href={`https://modrinth.com/mod/${mod.slug}`}
            target="_blank"
            rel="noreferrer"
            className="modrinth-link"
            title="View on Modrinth"
            style={{ marginBottom: 2 }}
          >
            <ExternalLinkIcon />
          </a>
        )}
        <div className="mod-grid-actions">
          {projectId && (
            <>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                onClick={() => void actions.loadModVersions(projectId)}
              >
                Versions
              </button>
              {versions.length > 0 && (
                <select
                  value={selectedVersion}
                  style={{ fontSize: '0.72rem', padding: '3px 6px', width: '100%', marginTop: 2 }}
                  onChange={(e) => void actions.applyModVersion(projectId, e.currentTarget.value)}
                  disabled={isLocked && !isFabric}
                >
                  <option value="">Select version</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.versionType})
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button
            type="button"
            className="btn danger"
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            disabled={isLocked}
            onClick={() => setRemoveTarget({ projectId, sha256: mod.sha256, name: mod.name })}
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="panel">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Installed Mods</h3>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {selectedMods.length} mod{selectedMods.length !== 1 ? 's' : ''} installed
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setShowAddMods(true)}
            style={{ flexShrink: 0 }}
          >
            + Add Mods
          </button>
        </div>

        <div className={statusClass(statuses.mods.tone)}>{statuses.mods.text}</div>

        {selectedMods.length === 0 ? (
          <p className="hint" style={{ marginTop: 16 }}>No mods installed. Click "Add Mods" to get started.</p>
        ) : (
          <>
            {coreMods.length > 0 && (
              <>
                <div className="mods-section-label core">🔒 Core Mods — {coreMods.length}</div>
                <div className="mods-grid" style={{ marginBottom: 28 }}>
                  {coreMods.map((mod) => (
                    <ModGridCard key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`} mod={mod} />
                  ))}
                </div>
              </>
            )}

            {userMods.length > 0 && (
              <>
                <div className="mods-section-label">📦 User Mods — {userMods.length}</div>
                <div className="mods-grid">
                  {userMods.map((mod) => (
                    <ModGridCard key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`} mod={mod} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {showAddMods ? (
        <AddModsModal
          onClose={() => setShowAddMods(false)}
          onInstall={(cart) => void handleInstallCart(cart)}
        />
      ) : null}

      {removeTarget ? (
        <ModalShell onClose={() => setRemoveTarget(null)}>
          <div
            className="modal-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ margin: 0 }}>Remove {removeTarget.name}?</h3>
            <button
              className="modal-close-icon"
              type="button"
              aria-label="Close"
              onClick={() => setRemoveTarget(null)}
            >
              ✕
            </button>
          </div>
          <p className="warning">
            This mod will be removed from the profile draft. This change
            requires a publish to apply to users.
          </p>
          <div
            className="row"
            style={{ justifyContent: 'flex-end', marginTop: 8 }}
          >
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
                actions.removeMod(removeTarget.projectId, removeTarget.sha256);
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
    actions,
    statuses,
  } = useAdminContext();
  const bundleUploadRef = useRef<HTMLInputElement | null>(null);

  // local wizard state
  const [activeStep, setActiveStep] = useState(1);

  const isEnabled = form.fancyMenuEnabled === 'true';

  return (
    <>
      <section className="panel">
        <div className="wizard-steps">
          <button
            type="button"
            className={`step ${activeStep >= 1 ? 'done' : ''} ${activeStep === 1 ? 'active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            1. Activation
          </button>
          <button
            type="button"
            className={`step ${activeStep >= 2 ? 'done' : ''} ${activeStep === 2 ? 'active' : ''}`}
            disabled={!isEnabled}
            onClick={() => isEnabled && setActiveStep(2)}
          >
            2. Mode & Config
          </button>
        </div>

        {activeStep === 1 && (
          <div className="wizard-panel">
            <h3>Fancy Menu activation</h3>
            <div className="wizard-description">
              FancyMenu is a powerful mod that allows for full customization of the Minecraft main menu.
              By enabling this, we can override the default buttons, logo, and background with a premium brand experience.
            </div>

            <div className="wizard-box">
              <SelectInput
                name="fancyMenuEnabled"
                label="FancyMenu Status"
                value={form.fancyMenuEnabled}
                onChange={(e) => {
                  const val = e.currentTarget.value === 'true';
                  actions.setFancyMenuEnabled(val);
                  if (val) setActiveStep(2);
                }}
                options={[
                  { value: 'false', label: 'Disabled (Standard Minecraft Menu)' },
                  { value: 'true', label: 'Enabled (Custom Brand Experience)' },
                ]}
              />
              <p className="wizard-meta">
                Setting this to Enabled will automatically include necessary core mods and configuration files in the profile.
              </p>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn primary"
                disabled={!isEnabled}
                onClick={() => setActiveStep(2)}
              >
                Continue to Configuration
              </button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="wizard-panel">
            <h3>Choose your customization path</h3>
            <p className="hint">Select how you want to build your main menu experience.</p>

            <div className="mode-grid">
              <button
                type="button"
                className={`mode-card ${form.fancyMenuMode === 'simple' ? 'active' : ''}`}
                onClick={() => actions.setFancyMenuMode('simple')}
              >
                <div className="mode-card-icon">⚡</div>
                <h4>Simple Form</h4>
                <p>Quickly set a custom logo, background and play button labels via the form below.</p>
              </button>

              <button
                type="button"
                className={`mode-card ${form.fancyMenuMode === 'custom' ? 'active' : ''}`}
                onClick={() => actions.setFancyMenuMode('custom')}
              >
                <div className="mode-card-icon">📦</div>
                <h4>Custom Bundle</h4>
                <p>Upload a full FancyMenu .zip export with custom layouts, animations and more.</p>
              </button>
            </div>

            {form.fancyMenuMode === 'simple' ? (
              <div className="wizard-box">
                <div className="grid two">
                  <TextInput
                    name="playButtonLabel"
                    label="Play Button Label"
                    value={form.playButtonLabel}
                    placeholder="START"
                    onChange={setTextFieldFromEvent}
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
                </div>
                <div className="grid two" style={{ marginTop: 8 }}>
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
                </div>
              </div>
            ) : (
              <div className="wizard-box">
                <div className="wizard-description" style={{ fontSize: '0.85rem' }}>
                  <strong>Important:</strong> Your .zip must contain a valid FancyMenu export structure
                  (usually including a <code>customization</code> folder).
                </div>
                <div className="grid two">
                  <TextInput
                    name="fancyMenuCustomLayoutUrl"
                    label="Bundle Download URL"
                    value={form.fancyMenuCustomLayoutUrl}
                    placeholder="https://.../bundle.zip"
                    onChange={setTextFieldFromEvent}
                  />
                  <TextInput
                    name="fancyMenuCustomLayoutSha256"
                    label="Bundle SHA256"
                    value={form.fancyMenuCustomLayoutSha256}
                    placeholder="hex sha256"
                    onChange={setTextFieldFromEvent}
                  />
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ width: '100%' }}
                    onClick={() => bundleUploadRef.current?.click()}
                  >
                    Upload New Bundle .zip
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
                </div>
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="btn ghost" onClick={() => setActiveStep(1)}>Back</button>
            </div>
          </div>
        )}


        <div className={statusClass(statuses.fancy.tone)} style={{ marginTop: 24 }}>
          {statuses.fancy.text}
        </div>
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
          {view === 'identity' ? <IdentityPage /> : null}
          {view === 'mods' ? <ModManagerPage /> : null}
          {view === 'fancy' ? <FancyMenuPage /> : null}
          {view === 'exaroton' ? <ExarotonPage /> : null}
        </section>
      </main>
    </div>
  );
});
