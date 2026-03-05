import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
  useRef,
  useState,
  type ChangeEventHandler,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

import { useAdminContext } from './admin-context';
import { requestJson } from './http';
import type {
  ExarotonServerPayload,
  LauncherPairingClaimIssuePayload,
  LauncherPairingClaimListItem,
  LauncherTrustResetPayload,
} from './types';

const ExarotonLogo = memo(function ExarotonLogo({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 1049.8 200.4"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Exaroton"
    >
      <path
        fill="#FFFFFF"
        d="M640.1,47.1h-6.5c-9.6,0-18.9,3.8-24.9,9.8c-1.3,1.3-3.5,0.4-3.5-1.4v-4.3c0-1.1-0.9-2-2-2h-20.5c-1.1,0-2,0.9-2,2v98c0,1.1,0.9,2,2,2h20.5c1.1,0,2-0.9,2-2V90.8c0-13.7,10.8-22.9,27.1-22.9h7.8c1.1,0,2-0.9,2-2V49.1C642.1,48,641.2,47.1,640.1,47.1z"
      />
      <path
        fill="#FFFFFF"
        d="M822.3,133.7h-15.7c-5.3,0-9-3.5-9-8.6V68.4c0-1.1,0.9-2,2-2h21.7c1.1,0,2-0.9,2-2V48c0-1.1-0.9-2-2-2h-21.7c-1.1,0-2-0.9-2-2V20.2c0-1.1-0.9-2-2-2h-20.5c-1.1,0-2,0.9-2,2V44c0,1.1-0.9,2-2,2h-14.8c-1.1,0-2,0.9-2,2v16.4c0,1.1,0.9,2,2,2h14.8c1.1,0,2,0.9,2,2v56.7c0,17.3,13.7,29,33.9,29h15.3c1.1,0,2-0.9,2-2v-16.4C824.3,134.5,823.4,133.7,822.3,133.7z"
      />
      <path
        fill="#FFFFFF"
        d="M1004.6,46.3c-12.7,0-21.3,6.4-25.7,10.7c-1.3,1.3-3.4,0.4-3.4-1.4v-4.4c0-1.1-0.9-2-2-2H953c-1.1,0-2,0.9-2,2v98c0,1.1,0.9,2,2,2h20.5c1.1,0,2-0.9,2-2V90.6c0-13.5,11.2-22.6,26.1-22.6c13.8,0,23.7,9.2,23.7,22.6v58.6c0,1.1,0.9,2,2,2h20.5c1.1,0,2-0.9,2-2V87.7C1049.7,62.8,1030.2,46.3,1004.6,46.3z"
      />
      <path
        fill="#FFFFFF"
        d="M411.7,98.5c-0.5-0.7-0.5-1.7,0-2.4l32.5-43.8c1-1.3,0-3.2-1.6-3.2h-24.9c-0.7,0-1.3,0.3-1.7,0.9l-17.5,27.2c-0.8,1.2-2.6,1.2-3.4,0l-17.9-27.1c-0.4-0.6-1-0.9-1.7-0.9h-24.7c-1.6,0-2.6,1.9-1.6,3.2l32.5,43.8c0.5,0.7,0.5,1.7,0,2.4l-36.4,49.5c-1,1.3,0,3.2,1.6,3.2h25c0.7,0,1.3-0.3,1.7-0.9l21.6-32.7c0.8-1.2,2.6-1.2,3.3,0l21.4,32.7c0.4,0.6,1,0.9,1.7,0.9h25c1.6,0,2.6-1.9,1.6-3.2L411.7,98.5z"
      />
      <path
        fill="#FFFFFF"
        d="M345.4,100.2c0-32.2-22.2-53.9-55.3-53.9s-55.3,21.6-55.3,53.9c0,32.2,22.2,53.9,55.3,53.9c23.9,0,44.4-13.9,52-34.9c0.5-1.3-0.5-2.7-1.9-2.7h-20.9c-0.7,0-1.2,0.3-1.6,0.9c-4.7,8.8-13.9,14.9-24.6,14.9h-5.6c-12.9,0-23.8-8.9-26.9-20.9h0.1c-0.2-0.6-0.4-1.3-0.5-2c-0.3-1.3,0.7-2.5,2-2.5h81.3c1.1,0,2-0.9,2-2L345.4,100.2L345.4,100.2z M315.8,86.5h-51.4c-1.5,0-2.5-1.6-1.8-2.9c5.1-10.2,15.7-16.9,27.5-16.9s22.3,6.7,27.5,16.9C318.3,84.9,317.3,86.5,315.8,86.5z"
      />
      <path
        fill="#FFFFFF"
        d="M559,49.2h-20.5c-1.1,0-2,0.9-2,2v5.9c0,1.8-2.1,2.7-3.4,1.4c-7.6-7.6-19.3-12.1-29.6-12.1c-31.8,0-53.1,21.6-53.1,53.9c0,32.2,21.2,53.9,53.1,53.9c10.2,0,22.4-5.3,29.6-12.4c1.3-1.3,3.4-0.4,3.4,1.4v6.1c0,1.1,0.9,2,2,2H559c1.1,0,2-0.9,2-2v-98C561,50.1,560.2,49.2,559,49.2z M536.2,107c0,13.6-11.1,24.6-24.6,24.6h-11.3c-13.6,0-24.6-11.1-24.6-24.6V93.1c0-13.6,11.1-24.6,24.6-24.6h11.3c13.6,0,24.6,11.1,24.6,24.6V107z"
      />
      <path
        fill="#FFFFFF"
        d="M697.4,46.3c-33.1,0-55.3,21.6-55.3,53.9c0,32.2,22.2,53.9,55.3,53.9s55.3-21.6,55.3-53.9C752.7,67.9,730.5,46.3,697.4,46.3z M727.7,107c0,13.6-11.1,24.6-24.6,24.6h-11.3c-13.6,0-24.6-11.1-24.6-24.6V93.1c0-13.6,11.1-24.6,24.6-24.6h11.3c13.6,0,24.6,11.1,24.6,24.6V107z"
      />
      <path
        fill="#FFFFFF"
        d="M883,46.3c-33.1,0-55.3,21.6-55.3,53.9c0,32.2,22.2,53.9,55.3,53.9s55.3-21.6,55.3-53.9C938.3,67.9,916,46.3,883,46.3z M913.2,107c0,13.6-11.1,24.6-24.6,24.6h-11.3c-13.6,0-24.6-11.1-24.6-24.6V93.1c0-13.6,11.1-24.6,24.6-24.6h11.3c13.6,0,24.6,11.1,24.6,24.6V107z"
      />
      <path
        fill="#19BA19"
        d="M198,73.3c2.9-2.9,2.9-7.6,0-10.5L137.4,2.2c-2.9-2.9-7.6-2.9-10.5,0l-21.7,21.7c-2.9,2.9-7.6,2.9-10.5,0L73.2,2.3c-2.9-2.9-7.6-2.9-10.5,0L2.2,62.9c-2.9,2.9-2.9,7.6,0,10.5l21.7,21.7c2.9,2.9,2.9,7.6,0,10.5L2.2,127.1c-2.9,2.9-2.9,7.6,0,10.5l60.6,60.6c2.9,2.9,7.6,2.9,10.5,0L95,176.5c2.9-2.9,7.6-2.9,10.5,0l21.7,21.7c2.9,2.9,7.6,2.9,10.5,0l60.6-60.6c2.9-2.9,2.9-7.6,0-10.5l-21.7-21.7c-2.9-2.9-2.9-7.6,0-10.5L198,73.3z M154.3,112.1c0,23.3-19,42.3-42.3,42.3H88.2c-23.3,0-42.3-19-42.3-42.3V88.3C45.9,65,64.9,46,88.2,46H112c23.3,0,42.3,19,42.3,42.3V112.1z"
      />
    </svg>
  );
});

function statusClass(tone: 'idle' | 'ok' | 'error'): string {
  if (tone === 'ok') return 'status ok';
  if (tone === 'error') return 'status error';
  return 'status';
}

function exarotonStatusClass(status: number): string {
  // 0: OFFLINE, 1: ONLINE, 2: STARTING, 3: STOPPING, 4: RESTARTING, 5: SAVING, 6: LOADING, 7: CRASHED, 8: PENDING, 9: TRANSFERRING, 10: PREPARING
  if (status === 1) return 'status-chip status-chip-online';
  if (status === 7) return 'status-chip status-chip-crashed';
  if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status)) {
    return 'status-chip status-chip-busy';
  }
  return 'status-chip status-chip-offline';
}

function getExarotonStatusTone(status: number): 'ok' | 'error' | 'idle' {
  if (status === 1) return 'ok';
  if (status === 7) return 'error';
  return 'idle';
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

const EXAROTON_MODS_WARNING_KEY = 'admin-exaroton-mods-delete-warning-v1';

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
    const inputs =
      cardRef.current?.querySelectorAll<HTMLElement>('input,textarea');
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
  const { view, setView, rail, selectedMods, hasPendingPublish, isBusy } =
    useAdminContext();

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
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <span>Identity</span>
        </button>
        <button
          className={`nav-item ${view === 'mods' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('mods')}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Mod Manager</span>
        </button>
        <button
          className={`nav-item ${view === 'fancy' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('fancy')}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.5 1.5"></path>
            <path d="M14 11l4 4"></path>
          </svg>
          <span>Fancy Menu</span>
        </button>
        <button
          className={`nav-item ${view === 'servers' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('servers')}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          <span>Servers</span>
        </button>
        <button
          className={`nav-item ${view === 'launcher' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('launcher')}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
          <span>Launcher Pairing</span>
        </button>
      </nav>

      <div className="nav-status">
        {isBusy.bootstrap ? (
          <>
            <div className="rail-chip rail-chip-loading">
              Loading runtime...
            </div>
            <div className="rail-chip rail-chip-loading">Loading loader...</div>
            <div className="rail-chip rail-chip-loading">Loading mods...</div>
          </>
        ) : (
          <>
            <div className="rail-chip">
              <b>MC</b> {rail.minecraft}
            </div>
            <div className="rail-chip">
              <b>Loader</b> {rail.fabric}
            </div>
            <div className="rail-chip">{selectedMods.length} mods</div>
            {hasPendingPublish && (
              <div
                className="rail-chip"
                style={{
                  color: 'var(--warning)',
                  borderColor: 'var(--warning)',
                  background: 'rgba(245,158,11,0.05)',
                  fontWeight: 600,
                }}
              >
                Requires Publish
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
});

const MainLoadingState = memo(function MainLoadingState() {
  return (
    <div className="main-loading" role="status" aria-live="polite">
      <div className="main-loading-head" />
      <div className="main-loading-grid">
        <div className="main-loading-card" />
        <div className="main-loading-card" />
        <div className="main-loading-card" />
        <div className="main-loading-card" />
      </div>
    </div>
  );
});

const ServersLanding = memo(function ServersLanding({
  onSelect,
  connectedIntegration,
}: {
  onSelect: (id: string) => void;
  connectedIntegration?: string | null;
}) {
  return (
    <div className="integrations-grid">
      <button
        className={`integration-card ${connectedIntegration === 'exaroton' ? 'active-integration' : ''}`}
        onClick={() => onSelect('exaroton')}
        type="button"
      >
        <div className="integration-logo-wrapper">
          <ExarotonLogo style={{ height: 32 }} />
        </div>
        <div className="integration-info">
          <h3>Exaroton</h3>
          <p>
            {connectedIntegration === 'exaroton'
              ? 'Account connected. Click to manage servers or change selection.'
              : 'Connect your Exaroton account to manage your servers directly.'}
          </p>
        </div>
        {connectedIntegration === 'exaroton' && (
          <div className="connection-badge">Connected</div>
        )}
      </button>

      <div className="integration-card disabled">
        <div className="integration-logo-wrapper">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 28, height: 28, opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="integration-info">
          <h3>Coming Soon</h3>
          <p>We are working to bring you more integrations in the future.</p>
        </div>
      </div>
    </div>
  );
});

const ServersPage = memo(function ServersPage() {
  const { exaroton, statuses, actions } = useAdminContext();
  const [confirmDisconnect, setConfirmDisconnect] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );

  const inSetupFlow = selectedIntegration === 'exaroton' && !exaroton.connected;
  const isKeyStep = inSetupFlow && exaroton.connectionStep === 'key';
  const isServersStep =
    (exaroton.connectionStep === 'servers' || !exaroton.selectedServer) &&
    exaroton.connected;
  const isSuccessStep =
    exaroton.connectionStep === 'success' && exaroton.connected;

  const setupStepIndex = !selectedIntegration
    ? 0
    : !exaroton.connected
      ? 1
      : !exaroton.selectedServer
        ? 2
        : 3;

  const openExarotonSetup = () => {
    setSelectedIntegration('exaroton');
    if (!exaroton.connected) {
      actions.setExarotonStep('key');
    }
  };

  if (!exaroton.configured) {
    return (
      <section className="exaroton-wizard">
        <div className="alert-box danger">
          <strong>Integration not configured</strong>
          <p>
            Set <code>EXAROTON_ENCRYPTION_KEY</code> on the API server first to
            enable this feature.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="exaroton-wizard">
      {!exaroton.connected && !selectedIntegration && (
        <>
          <div className="step-header">
            <h2>Select Integration</h2>
            <p>Choose a service to manage your game servers.</p>
          </div>
          <ServersLanding
            onSelect={(id) => {
              if (id === 'exaroton') {
                openExarotonSetup();
                return;
              }
              setSelectedIntegration(id);
            }}
            connectedIntegration={exaroton.connected ? 'exaroton' : null}
          />
        </>
      )}

      {selectedIntegration === 'exaroton' && (
        <div className="wizard-step">
          <div className="wizard-steps">
            <span className={`step ${setupStepIndex >= 1 ? 'active' : ''}`}>
              1. API Key
            </span>
            <span className={`step ${setupStepIndex >= 2 ? 'active' : ''}`}>
              2. Select Server
            </span>
            <span className={`step ${setupStepIndex >= 3 ? 'done' : ''}`}>
              3. Connected
            </span>
          </div>

          {isKeyStep ? (
            <>
              <div className="step-header">
                <h2>Connect Exaroton Account</h2>
                <p>
                  Obtain your API key from{' '}
                  <a
                    href="https://exaroton.com/account/settings/"
                    target="_blank"
                    rel="noreferrer"
                    className="link-premium"
                  >
                    exaroton.com/account/settings/
                  </a>
                </p>
              </div>

              <div className="security-banner">
                <div className="security-banner-icon">🛡️</div>
                <p>
                  <b>Your key stays protected.</b> All requests run through our
                  secure backend umbrella. After saving, we no longer expose
                  your raw key in UI; it is encrypted at rest and only decrypted
                  when an authorized action needs to call Exaroton.
                </p>
              </div>

              <div className="api-key-container">
                <label className="label">Exaroton API Key</label>
                <input
                  className="api-key-input"
                  type="password"
                  placeholder="Paste your secret API key here..."
                  value={exaroton.apiKeyInput}
                  onChange={(e) => actions.setExarotonApiKey(e.target.value)}
                />
              </div>

              <div
                className="row"
                style={{ justifyContent: 'flex-end', gap: 12, marginTop: 12 }}
              >
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    actions.setExarotonStep('idle');
                    setSelectedIntegration(null);
                  }}
                >
                  Back
                </button>
                <button
                  className="btn primary"
                  type="button"
                  style={{ padding: '12px 32px' }}
                  disabled={!exaroton.apiKeyInput || exaroton.busy}
                  onClick={() => void actions.connectExaroton()}
                >
                  {exaroton.busy ? 'Connecting...' : 'Connect Account'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {isServersStep && (
        <div className="wizard-step">
          <div className="step-header">
            <h2>Select Server</h2>
            <p>Choose the server you want to manage within the client.</p>
          </div>

          <div className="exaroton-server-grid">
            {exaroton.servers.map((server: ExarotonServerPayload) => (
              <button
                key={server.id}
                className={`server-card ${exaroton.selectedServer?.id === server.id ? 'active' : ''}`}
                onClick={() => void actions.selectExarotonServer(server.id)}
                disabled={exaroton.busy}
                type="button"
              >
                <div className="server-name-row">
                  <strong>{server.name}</strong>
                  <span className={exarotonStatusClass(server.status)}>
                    {server.statusLabel}
                  </span>
                </div>
                <p className="hint">{server.address}</p>
                <div className="meta">
                  {server.players.count} / {server.players.max} players online
                </div>
              </button>
            ))}
          </div>

          {!exaroton.servers.length && (
            <div className="alert-box">
              <p>
                No servers found on this account. Please create one on Exaroton
                first.
              </p>
            </div>
          )}

          <div
            className="row"
            style={{ justifyContent: 'space-between', marginTop: 12 }}
          >
            <button
              className="btn ghost"
              style={{ padding: '10px 20px' }}
              onClick={() => {
                if (!exaroton.connected) {
                  actions.setExarotonStep('key');
                } else {
                  setSelectedIntegration(null);
                }
              }}
            >
              {exaroton.connected ? 'Back' : 'Back to API Key'}
            </button>
            <button
              className="btn"
              style={{ padding: '10px 24px' }}
              onClick={() => void actions.listExarotonServers()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.7 }}
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh List
            </button>
          </div>
        </div>
      )}

      {(isSuccessStep ||
        (exaroton.connected &&
          exaroton.selectedServer &&
          exaroton.connectionStep !== 'servers')) && (
        <div className="exaroton-wizard">
          {isSuccessStep && (
            <div className="success-step">
              <div className="success-icon-wrapper">
                <span>✓</span>
              </div>
              <div className="success-content">
                <h2>Successfully Connected!</h2>
                <p>
                  Your server <b>{exaroton.selectedServer?.name}</b> is now
                  fully integrated with the MSS+ Client Center.
                </p>
              </div>
              <button
                className="finish-btn"
                onClick={() => actions.setExarotonStep('idle')}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {!isSuccessStep && exaroton.connected && (
            <div className="grid two">
              <article className="panel">
                <h3>Connected Account</h3>
                <div
                  className="exaroton-account-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div className="exaroton-account-info">
                    <strong>{exaroton.accountName}</strong>
                    <span>{exaroton.accountEmail}</span>
                  </div>
                  <button
                    className="btn danger ghost"
                    style={{ padding: '10px 20px' }}
                    onClick={() => setConfirmDisconnect('PENDING')}
                  >
                    Disconnect Account
                  </button>
                </div>

                {confirmDisconnect && (
                  <ModalShell onClose={() => setConfirmDisconnect('')}>
                    <div className="step-header">
                      <h2>Confirm Disconnection</h2>
                      <p>
                        To disconnect, please type the name of the connected
                        server: <b>{exaroton.selectedServer?.name}</b>
                      </p>
                    </div>
                    <TextInput
                      name="confirm"
                      label="Type server name to confirm"
                      value={
                        confirmDisconnect === 'PENDING' ? '' : confirmDisconnect
                      }
                      onChange={(e) =>
                        setConfirmDisconnect(e.currentTarget.value)
                      }
                      placeholder={exaroton.selectedServer?.name}
                    />
                    <div
                      className="row"
                      style={{
                        justifyContent: 'flex-end',
                        gap: 12,
                        marginTop: 20,
                      }}
                    >
                      <button
                        className="btn ghost"
                        onClick={() => setConfirmDisconnect('')}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn danger"
                        disabled={
                          confirmDisconnect !== exaroton.selectedServer?.name
                        }
                        onClick={() => {
                          void actions.disconnectExaroton();
                          setConfirmDisconnect('');
                        }}
                      >
                        Confirm Disconnect
                      </button>
                    </div>
                  </ModalShell>
                )}
              </article>

              {exaroton.selectedServer && (
                <article className="panel">
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <h3>Selected Server</h3>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        actions.setExarotonStep('servers');
                        void actions.listExarotonServers();
                      }}
                    >
                      Change Server
                    </button>
                  </div>
                  <div
                    className="exaroton-selected-card"
                    style={{
                      background: 'rgba(99,102,241,0.05)',
                      borderColor: 'var(--brand-primary)',
                    }}
                  >
                    <div
                      className="row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <strong>{exaroton.selectedServer.name}</strong>
                        <p className="hint">
                          {exaroton.selectedServer.address}
                        </p>
                      </div>
                      <span
                        className={exarotonStatusClass(
                          exaroton.selectedServer.status,
                        )}
                      >
                        {exaroton.selectedServer.statusLabel}
                      </span>
                    </div>
                  </div>
                </article>
              )}

              <article className="panel">
                <div
                  className="row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <h3>Settings</h3>
                  {exaroton.busy ? (
                    <span className="hint">Saving...</span>
                  ) : null}
                </div>
                <fieldset
                  disabled={exaroton.busy}
                  style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}
                >
                  <div className="grid" style={{ gap: 12 }}>
                    <label className="check" style={{ opacity: 0.7 }}>
                      <input type="checkbox" checked disabled />
                      <span>Server status (required, cannot be disabled)</span>
                    </label>

                    <label className="check">
                      <input
                        type="checkbox"
                        checked={exaroton.settings.modsSyncEnabled}
                        onChange={(event) =>
                          void actions.updateExarotonSettings({
                            modsSyncEnabled: event.currentTarget.checked,
                          })
                        }
                      />
                      <span>Mods sync</span>
                    </label>

                    <div className="alert-box" style={{ marginTop: 4 }}>
                      <strong>Player access</strong>
                      <div className="grid" style={{ marginTop: 8, gap: 8 }}>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanViewStatus}
                            disabled={
                              exaroton.settings.playerCanStartServer ||
                              exaroton.settings.playerCanStopServer ||
                              exaroton.settings.playerCanRestartServer
                            }
                            onChange={(event) =>
                              void actions.updateExarotonSettings({
                                playerCanViewStatus:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Status visibility for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={
                              exaroton.settings.playerCanViewOnlinePlayers
                            }
                            disabled={!exaroton.settings.playerCanViewStatus}
                            onChange={(event) =>
                              void actions.updateExarotonSettings({
                                playerCanViewOnlinePlayers:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Online players count for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanStartServer}
                            onChange={(event) =>
                              void actions.updateExarotonSettings({
                                playerCanStartServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>Start server for players</span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanStopServer}
                            onChange={(event) =>
                              void actions.updateExarotonSettings({
                                playerCanStopServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>
                            Stop server for players{' '}
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: '1px solid var(--line)',
                                fontSize: '0.72rem',
                                cursor: 'help',
                              }}
                              title="We do not recommend granting stop controls to players; misuse can degrade overall player experience."
                              aria-label="Stop permission warning"
                            >
                              i
                            </span>
                          </span>
                        </label>

                        <label className="check">
                          <input
                            type="checkbox"
                            checked={exaroton.settings.playerCanRestartServer}
                            onChange={(event) =>
                              void actions.updateExarotonSettings({
                                playerCanRestartServer:
                                  event.currentTarget.checked,
                              })
                            }
                          />
                          <span>
                            Restart server for players{' '}
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: '1px solid var(--line)',
                                fontSize: '0.72rem',
                                cursor: 'help',
                              }}
                              title="We do not recommend granting restart controls to players; misuse can degrade overall player experience."
                              aria-label="Restart permission warning"
                            >
                              i
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </article>
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <div className={statusClass(statuses.exaroton.tone)}>
          {statuses.exaroton.text}
        </div>
      </div>
      {exaroton.error ? (
        <div className="alert-box danger" style={{ marginTop: 12 }}>
          <p>{exaroton.error}</p>
        </div>
      ) : null}
    </section>
  );
});

const ExarotonWidget = memo(function ExarotonWidget() {
  const { exaroton, actions } = useAdminContext();

  if (!exaroton.connected || !exaroton.selectedServer) return null;

  const server = exaroton.selectedServer;
  const statusTone = getExarotonStatusTone(server.status);
  const disableStartByStatus = [1, 2, 3, 4, 6].includes(server.status);
  const disableStopByStatus = [0, 2, 3, 4, 6].includes(server.status);
  const disableRestartByStatus = [0, 2, 3, 4, 6].includes(server.status);

  return (
    <div className="exaroton-widget">
      <div className="widget-status">
        <span
          className={`widget-dot ${statusTone}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              statusTone === 'ok'
                ? 'var(--success)'
                : statusTone === 'error'
                  ? 'var(--danger)'
                  : 'var(--text-muted)',
          }}
        />
        <span className="widget-server-name">{server.name}:</span>
        <span className={exarotonStatusClass(server.status)}>
          {server.statusLabel}
        </span>
        <span className="widget-player-count">
          {server.players.count}/{server.players.max} online
        </span>
      </div>
      <div className="widget-controls">
        <button
          className="control-btn"
          type="button"
          title="Start Server"
          disabled={exaroton.busy || disableStartByStatus}
          onClick={() => void actions.exarotonAction('start')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button
          className="control-btn"
          type="button"
          title="Restart Server"
          disabled={exaroton.busy || disableRestartByStatus}
          onClick={() => void actions.exarotonAction('restart')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
        <button
          className="control-btn"
          type="button"
          title="Stop Server"
          disabled={exaroton.busy || disableStopByStatus}
          onClick={() => void actions.exarotonAction('stop')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="6" width="12" height="12"></rect>
          </svg>
        </button>
      </div>
    </div>
  );
});

const TopBar = memo(function TopBar() {
  const {
    exaroton,
    hasPendingPublish,
    publishBlockReason,
    hasSavedDraft,
    isBusy,
    actions,
    statuses,
  } = useAdminContext();
  const [showExarotonPublishWarning, setShowExarotonPublishWarning] =
    useState(false);

  const publishButtonLabel =
    isBusy.publish && statuses.publish.text.trim().length > 0
      ? statuses.publish.text
      : 'Publish';

  const handlePublish = () => {
    if (publishBlockReason) {
      return;
    }

    const shouldWarn =
      exaroton.connected &&
      exaroton.settings.modsSyncEnabled &&
      !localStorage.getItem(EXAROTON_MODS_WARNING_KEY);

    if (shouldWarn) {
      setShowExarotonPublishWarning(true);
      return;
    }

    void actions.publishProfile();
  };

  const acknowledgeWarningAndPublish = () => {
    localStorage.setItem(EXAROTON_MODS_WARNING_KEY, '1');
    setShowExarotonPublishWarning(false);
    void actions.publishProfile();
  };

  return (
    <section className="topbar">
      <div className="topbar-meta">
        <ExarotonWidget />
      </div>
      <div className="topbar-actions">
        <button
          className="btn ghost"
          type="button"
          onClick={() => void actions.saveDraft()}
        >
          Save Draft
        </button>
        {hasPendingPublish || hasSavedDraft ? (
          <div className="publish-reminder">
            {hasPendingPublish ? (
              <span className="requires-publish">Requires Publish</span>
            ) : (
              <span className="draft-pending">Draft pending</span>
            )}
            <button
              className="btn"
              type="button"
              disabled={isBusy.publish || Boolean(publishBlockReason)}
              onClick={handlePublish}
              title={
                publishBlockReason ||
                (isBusy.publish ? statuses.publish.text : undefined)
              }
            >
              {publishButtonLabel}
            </button>
            {publishBlockReason ? (
              <span className="btn-tooltip">{publishBlockReason}</span>
            ) : null}
          </div>
        ) : (
          <span className="publish-clean">All changes published</span>
        )}
        <button
          className="btn danger ghost"
          type="button"
          style={{ padding: '8px 12px' }}
          onClick={() => void actions.logout()}
        >
          Logout
        </button>
      </div>
      <div className={statusClass(statuses.draft.tone)}>
        {statuses.draft.text}
      </div>

      {showExarotonPublishWarning ? (
        <ModalShell onClose={() => setShowExarotonPublishWarning(false)}>
          <div className="step-header">
            <h2>Before first Exaroton mod sync</h2>
            <p>
              We recommend deleting existing mods from your Exaroton server
              first to avoid conflicts, duplicates, or incompatible jars.
            </p>
          </div>
          <div className="alert-box">
            <p>
              Once you click publish, server-target mods will be synchronized to
              the Exaroton <b>mods</b> folder.
            </p>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setShowExarotonPublishWarning(false)}
            >
              Cancel
            </button>
            <button
              className="btn"
              type="button"
              onClick={acknowledgeWarningAndPublish}
            >
              I Understand
            </button>
          </div>
        </ModalShell>
      ) : null}
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
  const { form, selectedMods, setView, summaryStats, rail } = useAdminContext();

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
            <button className="btn ghost" onClick={() => setView('identity')}>
              Edit
            </button>
          </div>
          <DataList>
            <DataItem label="Profile Name" value={form.serverName} />
            <DataItem
              label="Runtime"
              value={`${rail.minecraft} | ${rail.fabric}`}
            />
            <DataItem label="Endpoint" value={form.serverAddress} />
          </DataList>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Content Catalog</h3>
            <button className="btn ghost" onClick={() => setView('mods')}>
              Manage
            </button>
          </div>
          <DataList>
            <DataItem label="Total Mods" value={selectedMods.length} />
            <DataItem label="Core Mods" value="2 (Managed)" />
            <DataItem
              label="Update Status"
              value={
                summaryStats.update > 0
                  ? `${summaryStats.update} pending`
                  : 'All current'
              }
            />
          </DataList>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Display & Menu</h3>
            <button className="btn ghost" onClick={() => setView('fancy')}>
              Setup
            </button>
          </div>
          <DataList>
            <DataItem
              label="Status"
              value={form.fancyMenuEnabled === 'true' ? 'Active' : 'Bypass'}
            />
            <DataItem
              label="Mode"
              value={
                form.fancyMenuMode === 'custom' ? 'Custom Bundle' : 'Simplified'
              }
            />
            <DataItem
              label="Custom Brand"
              value={form.brandingLogoUrl ? 'Logo Set' : 'Default'}
            />
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

function toIsoLocalInputValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  return normalized;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

const LauncherPairingPanel = memo(function LauncherPairingPanel() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    toIsoLocalInputValue(window.location.origin),
  );
  const [claims, setClaims] = useState<LauncherPairingClaimListItem[]>([]);
  const [latestClaim, setLatestClaim] =
    useState<LauncherPairingClaimIssuePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshClaims = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const next = await requestJson<LauncherPairingClaimListItem[]>(
        '/v1/admin/launcher/pairing/claims',
        'GET',
      );
      setClaims(next);
    } catch (requestError) {
      setError(
        (requestError as Error).message || 'Failed to load pairing claims',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshClaims();
  }, [refreshClaims]);

  const createClaim = async () => {
    setIsCreating(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<LauncherPairingClaimIssuePayload>(
        '/v1/admin/launcher/pairing/claims',
        'POST',
        {
          apiBaseUrl: apiBaseUrl.trim() || undefined,
        },
      );
      setLatestClaim(payload);
      setMessage('Pairing claim generated.');
      await refreshClaims();
    } catch (requestError) {
      setError(
        (requestError as Error).message || 'Failed to create pairing claim',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
      setError('');
    } catch {
      setError('Clipboard permission denied in this browser.');
    }
  };

  const revokeClaim = async (claimId: string) => {
    setError('');
    setMessage('');
    try {
      await requestJson<{ revoked: boolean }>(
        `/v1/admin/launcher/pairing/claims/${encodeURIComponent(claimId)}`,
        'DELETE',
      );
      setClaims((prev) =>
        prev.map((entry) =>
          entry.id === claimId
            ? { ...entry, revokedAt: new Date().toISOString() }
            : entry,
        ),
      );
      if (latestClaim?.claimId === claimId) {
        setLatestClaim(null);
      }
      setMessage('Pairing claim revoked.');
    } catch (requestError) {
      setError(
        (requestError as Error).message || 'Failed to revoke pairing claim',
      );
    }
  };

  const resetTrust = async () => {
    setIsResetting(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<LauncherTrustResetPayload>(
        '/v1/admin/launcher/trust/reset',
        'POST',
      );
      setLatestClaim(null);
      setMessage(`Launcher trust reset at ${formatDateTime(payload.resetAt)}.`);
      await refreshClaims();
    } catch (requestError) {
      setError(
        (requestError as Error).message || 'Failed to reset launcher trust',
      );
    } finally {
      setIsResetting(false);
    }
  };

  const activeClaims = claims.filter(
    (entry) =>
      !entry.revokedAt &&
      !entry.consumedAt &&
      new Date(entry.expiresAt).getTime() > Date.now(),
  );

  return (
    <article className="panel">
      <div className="panel-header">
        <h3>Launcher Pairing</h3>
        <button
          className="btn ghost"
          type="button"
          onClick={() => void refreshClaims()}
          disabled={isLoading || isCreating || isResetting}
        >
          Refresh
        </button>
      </div>
      <p className="hint">
        Generate one-time claims for secure launcher enrollment. Give users the
        deep link or the fallback pairing code.
      </p>

      <div className="grid">
        <TextInput
          name="pairingApiBaseUrl"
          label="Server API URL for pairing link"
          value={apiBaseUrl}
          placeholder="https://api.example.com"
          onChange={(event) => setApiBaseUrl(event.currentTarget.value)}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="btn"
          type="button"
          onClick={() => void createClaim()}
          disabled={isCreating || isResetting}
        >
          {isCreating ? 'Generating...' : 'Generate Pairing Claim'}
        </button>
        <button
          className="btn danger ghost"
          type="button"
          onClick={() => void resetTrust()}
          disabled={isResetting || isCreating}
          title="Invalidates all trusted launcher devices and sessions"
        >
          {isResetting ? 'Resetting...' : 'Reset Launcher Trust'}
        </button>
      </div>

      {latestClaim ? (
        <div className="alert-box" style={{ marginTop: 12 }}>
          <div className="grid" style={{ gap: 8 }}>
            <DataItem label="Claim ID" value={latestClaim.claimId} />
            <DataItem
              label="Expires"
              value={formatDateTime(latestClaim.expiresAt)}
            />
            <TextInput
              name="latestPairingCode"
              label="Pairing Code"
              value={latestClaim.pairingCode}
              readOnly
              onChange={() => undefined}
            />
            <div className="row">
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  void copyValue(latestClaim.pairingCode, 'Pairing code')
                }
              >
                Copy Pairing Code
              </button>
            </div>
            <TextInput
              name="latestDeepLink"
              label="Deep Link"
              value={latestClaim.deepLink}
              readOnly
              onChange={() => undefined}
            />
            <div className="row">
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  void copyValue(latestClaim.deepLink, 'Deep link')
                }
              >
                Copy Deep Link
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel-header" style={{ marginTop: 16 }}>
        <h3>Active Claims</h3>
      </div>
      {!activeClaims.length ? (
        <p className="hint">No active pairing claims.</p>
      ) : (
        <div className="list compact">
          {activeClaims.map((claim) => (
            <div
              key={claim.id}
              className="item"
              style={{ alignItems: 'flex-start' }}
            >
              <div style={{ flex: 1 }}>
                <div className="name">{claim.id}</div>
                <div className="meta">
                  Expires {formatDateTime(claim.expiresAt)}
                </div>
              </div>
              <button
                className="btn danger ghost"
                type="button"
                onClick={() => void revokeClaim(claim.id)}
                style={{ padding: '6px 10px' }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {error ? <div className="status error">{error}</div> : null}
      {message ? <div className="status ok">{message}</div> : null}
    </article>
  );
});

const LauncherPairingPage = memo(function LauncherPairingPage() {
  return (
    <section className="exaroton-wizard">
      <div className="step-header">
        <h2>Launcher Pairing</h2>
        <p>
          Generate and manage one-time claims used to enroll trusted launcher
          installations.
        </p>
      </div>
      <LauncherPairingPanel />
    </section>
  );
});

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

    requestJson<
      Array<{
        projectId: string;
        slug: string;
        title: string;
        description: string;
        author: string;
        iconUrl?: string;
        categories?: string[];
        latestVersion?: string;
      }>
    >(`/v1/admin/mods/search?${searchParams}`, 'GET')
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
      .catch(() => {
        /* silent */
      })
      .finally(() => setIsLoadingPopular(false));
  }, []);

  const [popularResults, setPopularResults] = useState<typeof searchResults>(
    [],
  );
  const displayResults = localQuery
    ? searchResults
    : searchResults.length > 0
      ? searchResults
      : popularResults;
  const isPopularView =
    !localQuery && searchResults.length === 0 && popularResults.length > 0;

  const installedIds = useMemo(
    () =>
      new Set(selectedMods.map((m) => m.projectId).filter(Boolean) as string[]),
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
    if (cartIds.has(result.projectId) || installedIds.has(result.projectId))
      return;

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
      <div
        className="modal-head"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ margin: 0 }}>Add Mods</h3>
        <button
          className="modal-close-icon"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {wasRestored.current && cart.length > 0 && (
        <div
          style={{
            padding: '8px 20px',
            fontSize: '0.75rem',
            color: 'var(--warning)',
            background: 'rgba(245,158,11,0.07)',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
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
              {isBusy.search ? <span className="search-spinner" /> : 'Search'}
            </button>
          </div>

          <div
            className={statusClass(statuses.mods.tone)}
            style={{ flexShrink: 0 }}
          >
            {isPopularView
              ? '⭐ Most popular mods (by followers)'
              : statuses.mods.text}
          </div>

          <div className="add-mods-search-results">
            {isLoadingPopular ? (
              <p className="hint" style={{ margin: 0 }}>
                Loading popular mods...
              </p>
            ) : displayResults.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                {localQuery
                  ? 'No results. Try a different query.'
                  : 'Search for a mod to get started.'}
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
                      onError={(e) =>
                        (e.currentTarget.src =
                          'https://modrinth.com/favicon.ico')
                      }
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
                        {result.latestVersion && (
                          <span>{result.latestVersion}</span>
                        )}
                        {dep ? (
                          dep.requiresDependencies ? (
                            <span className="dep-badge has-deps">
                              +{dep.dependencyDetails.length} deps
                            </span>
                          ) : (
                            <span className="dep-badge no-deps">No deps</span>
                          )
                        ) : null}
                        {installed && (
                          <span style={{ color: 'var(--success)' }}>
                            ✓ Installed
                          </span>
                        )}
                        {inCart && !installed && (
                          <span style={{ color: 'var(--brand-primary)' }}>
                            ✓ In cart
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {installed ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Installed
                        </span>
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
                    onError={(e) =>
                      (e.currentTarget.src = 'https://modrinth.com/favicon.ico')
                    }
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
                      <div className="cart-item-deps">
                        +{entry.deps.length} deps
                      </div>
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
          <button type="button" className="btn ghost" onClick={onClose}>
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
          {isBusy.install
            ? 'Installing...'
            : `Install ${cart.length > 0 ? `${String(cart.length)} mod${cart.length !== 1 ? 's' : ''}` : 'queue'}`}
        </button>
      </div>
    </ModalShell>
  );
});

const ModGridCardItem = memo(function ModGridCardItem({
  mod,
  index = 0,
  selectedModKeys,
  setSelectedModKeys,
  setRemoveTarget,
  coreModPolicy,
  exaroton,
  modVersionOptions,
  actions,
}: {
  mod: any;
  index: number;
  selectedModKeys: Set<string>;
  setSelectedModKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRemoveTarget: React.Dispatch<React.SetStateAction<any>>;
  coreModPolicy: any;
  exaroton: any;
  modVersionOptions: any;
  actions: any;
}) {
  const projectId = mod.projectId ?? '';
  const modKey = projectId || mod.sha256;
  const isLocked = coreModPolicy.nonRemovableProjectIds.includes(projectId);
  const isFabric = projectId === coreModPolicy.fabricApiProjectId;
  const isFancy = projectId === coreModPolicy.fancyMenuProjectId;
  const versions = projectId ? (modVersionOptions[projectId] ?? []) : [];
  const selectedVersion = versions.some((v: any) => v.id === mod.versionId)
    ? mod.versionId
    : '';

  return (
    <div
      className={`mod-grid-card${isLocked ? ' core-mod' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {!isLocked ? (
        <label className="mod-card-check">
          <input
            type="checkbox"
            checked={selectedModKeys.has(modKey)}
            onChange={(event) => {
              const isChecked = event.currentTarget.checked;
              setSelectedModKeys((current: Set<string>) => {
                const next = new Set(current);
                if (isChecked) {
                  next.add(modKey);
                } else {
                  next.delete(modKey);
                }
                return next;
              });
            }}
          />
        </label>
      ) : null}
      {isLocked && (
        <span
          className="lock-badge mod-grid-badge"
          style={{ fontSize: '0.6rem', padding: '1px 6px' }}
        >
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
        <div className="mod-grid-meta" title={mod.versionId}>
          {mod.versionId}
        </div>
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
        {exaroton.connected ? (
          <select
            value={mod.side || (isFabric ? 'both' : 'client')}
            style={{
              fontSize: '0.72rem',
              padding: '3px 6px',
              width: '100%',
              marginBottom: 4,
            }}
            disabled={(isLocked && !isFabric) || isFancy}
            onChange={(event) =>
              actions.setModInstallTarget(
                projectId,
                event.currentTarget.value as 'client' | 'server' | 'both',
                mod.sha256,
              )
            }
            title={isFancy ? 'FancyMenu is User only' : 'Install target'}
          >
            {isFancy ? (
              <option value="client">User</option>
            ) : (
              <>
                <option value="client">User</option>
                <option value="both">User + Server</option>
                <option value="server">Server</option>
              </>
            )}
          </select>
        ) : null}

        {projectId && (
          <>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
              onClick={() => void actions.loadModVersions(projectId)}
              disabled={isLocked}
            >
              Versions
            </button>
            {versions.length > 0 && (
              <select
                value={selectedVersion}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 6px',
                  width: '100%',
                  marginTop: 2,
                }}
                onChange={(e) =>
                  void actions.applyModVersion(projectId, e.currentTarget.value)
                }
                disabled={isLocked}
              >
                <option value="">Select version</option>
                {versions.map((v: any) => (
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
          onClick={() =>
            setRemoveTarget({ projectId, sha256: mod.sha256, name: mod.name })
          }
        >
          Remove
        </button>
      </div>
    </div>
  );
});

const ModManagerPage = memo(function ModManagerPage() {
  const {
    exaroton,
    modVersionOptions,
    coreModPolicy,
    selectedMods,
    statuses,
    actions,
  } = useAdminContext();

  const [showAddMods, setShowAddMods] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<'client' | 'server' | 'both'>(
    'both',
  );
  const [selectedModKeys, setSelectedModKeys] = useState<Set<string>>(
    new Set(),
  );
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string;
    sha256: string;
    name: string;
  } | null>(null);

  const coreMods = useMemo(
    () =>
      selectedMods.filter(
        (m) =>
          m.projectId && coreModPolicy.lockedProjectIds.includes(m.projectId),
      ),
    [selectedMods, coreModPolicy],
  );

  const userMods = useMemo(
    () =>
      selectedMods.filter(
        (m) =>
          !(
            m.projectId && coreModPolicy.lockedProjectIds.includes(m.projectId)
          ),
      ),
    [selectedMods, coreModPolicy],
  );

  const handleInstallCart = async (cart: CartEntry[]) => {
    for (const entry of cart) {
      await actions.requestAndConfirmInstall(entry.projectId);
    }
    setShowAddMods(false);
  };

  const selectableMods = useMemo(
    () =>
      selectedMods.filter((mod) => {
        const projectId = mod.projectId ?? '';
        return !coreModPolicy.nonRemovableProjectIds.includes(projectId);
      }),
    [selectedMods, coreModPolicy],
  );

  const allSelectableSelected =
    selectableMods.length > 0 &&
    selectableMods.every((mod) =>
      selectedModKeys.has(mod.projectId || mod.sha256),
    );

  const selectedBulkEntries = useMemo(
    () =>
      selectedMods
        .filter((mod) => selectedModKeys.has(mod.projectId || mod.sha256))
        .map((mod) => ({
          projectId: mod.projectId,
          sha256: mod.sha256,
        })),
    [selectedModKeys, selectedMods],
  );

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
              {selectedMods.length} mod{selectedMods.length !== 1 ? 's' : ''}{' '}
              installed
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {exaroton.connected ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => void actions.syncExarotonMods()}
                style={{ flexShrink: 0 }}
              >
                Sync Server Mods
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => setShowAddMods(true)}
              style={{ flexShrink: 0 }}
            >
              + Add Mods
            </button>
          </div>
        </div>

        <div className={statusClass(statuses.mods.tone)}>
          {statuses.mods.text}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="check">
            <input
              type="checkbox"
              checked={allSelectableSelected}
              onChange={(event) => {
                if (!event.currentTarget.checked) {
                  setSelectedModKeys(new Set());
                  return;
                }
                setSelectedModKeys(
                  new Set(
                    selectableMods.map((mod) => mod.projectId || mod.sha256),
                  ),
                );
              }}
            />
            <span>Select all editable mods</span>
          </label>

          {selectedBulkEntries.length > 0 ? (
            <div className="row" style={{ gap: 8 }}>
              {exaroton.connected ? (
                <>
                  <select
                    value={bulkTarget}
                    onChange={(event) =>
                      setBulkTarget(
                        event.currentTarget.value as
                          | 'client'
                          | 'server'
                          | 'both',
                      )
                    }
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <option value="client">Bulk: User</option>
                    <option value="both">Bulk: User + Server</option>
                    <option value="server">Bulk: Server</option>
                  </select>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      actions.setModsInstallTargetBulk(
                        selectedBulkEntries,
                        bulkTarget,
                      )
                    }
                  >
                    Apply Target
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  actions.removeModsBulk(selectedBulkEntries);
                  setSelectedModKeys(new Set());
                }}
              >
                Delete Selected
              </button>
            </div>
          ) : null}
        </div>

        {selectedMods.length === 0 ? (
          <p className="hint" style={{ marginTop: 16 }}>
            No mods installed. Click "Add Mods" to get started.
          </p>
        ) : (
          <>
            {userMods.length > 0 && (
              <>
                <div className="mods-section-label">
                  📦 User Mods — {userMods.length}
                </div>
                <div className="mods-grid">
                  {userMods.map((mod, index) => (
                    <ModGridCardItem
                      key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                      mod={mod}
                      index={index}
                      selectedModKeys={selectedModKeys}
                      setSelectedModKeys={setSelectedModKeys}
                      setRemoveTarget={setRemoveTarget}
                      coreModPolicy={coreModPolicy}
                      exaroton={exaroton}
                      modVersionOptions={modVersionOptions}
                      actions={actions}
                    />
                  ))}
                </div>
              </>
            )}

            {coreMods.length > 0 && (
              <>
                <div className="mods-section-label core">
                  🔒 Core Mods — {coreMods.length}
                </div>
                <div className="mods-grid" style={{ marginBottom: 28 }}>
                  {coreMods.map((mod, index) => (
                    <ModGridCardItem
                      key={`${mod.projectId ?? mod.name}-${mod.versionId ?? mod.sha256}`}
                      mod={mod}
                      index={index}
                      selectedModKeys={selectedModKeys}
                      setSelectedModKeys={setSelectedModKeys}
                      setRemoveTarget={setRemoveTarget}
                      coreModPolicy={coreModPolicy}
                      exaroton={exaroton}
                      modVersionOptions={modVersionOptions}
                      actions={actions}
                    />
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
                void actions.saveDraft();
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
  const { form, setTextFieldFromEvent, actions, statuses } = useAdminContext();
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
              FancyMenu is a powerful mod that allows for full customization of
              the Minecraft main menu. By enabling this, we can override the
              default buttons, logo, and background with a premium brand
              experience.
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
                  {
                    value: 'false',
                    label: 'Disabled (Standard Minecraft Menu)',
                  },
                  { value: 'true', label: 'Enabled (Custom Brand Experience)' },
                ]}
              />
              <p className="wizard-meta">
                Setting this to Enabled will automatically include necessary
                core mods and configuration files in the profile.
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
            <p className="hint">
              Select how you want to build your main menu experience.
            </p>

            <div className="mode-grid">
              <button
                type="button"
                className={`mode-card ${form.fancyMenuMode === 'simple' ? 'active' : ''}`}
                onClick={() => actions.setFancyMenuMode('simple')}
              >
                <div className="mode-card-icon">⚡</div>
                <h4>Simple Form</h4>
                <p>
                  Quickly set a custom logo, background and play button labels
                  via the form below.
                </p>
              </button>

              <button
                type="button"
                className={`mode-card ${form.fancyMenuMode === 'custom' ? 'active' : ''}`}
                onClick={() => actions.setFancyMenuMode('custom')}
              >
                <div className="mode-card-icon">📦</div>
                <h4>Custom Bundle</h4>
                <p>
                  Upload a full FancyMenu .zip export with custom layouts,
                  animations and more.
                </p>
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
                <div
                  className="wizard-description"
                  style={{ fontSize: '0.85rem' }}
                >
                  <strong>Important:</strong> Your .zip must contain a valid
                  FancyMenu export structure (usually including a{' '}
                  <code>customization</code> folder).
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

            <div
              className="row"
              style={{ justifyContent: 'flex-start', marginTop: 12 }}
            >
              <button
                type="button"
                className="btn ghost"
                onClick={() => setActiveStep(1)}
              >
                Back
              </button>
            </div>
          </div>
        )}

        <div
          className={statusClass(statuses.fancy.tone)}
          style={{ marginTop: 24 }}
        >
          {statuses.fancy.text}
        </div>
      </section>
    </>
  );
});

export const AdminApp = memo(function AdminApp() {
  const { view, isBusy } = useAdminContext();

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <TopBar />
        <section key={view} className="view-stage" aria-live="polite">
          {isBusy.bootstrap ? (
            <MainLoadingState />
          ) : (
            <>
              {view === 'overview' ? <OverviewPage /> : null}
              {view === 'identity' ? <IdentityPage /> : null}
              {view === 'mods' ? <ModManagerPage /> : null}
              {view === 'fancy' ? <FancyMenuPage /> : null}
              {view === 'servers' ? <ServersPage /> : null}
              {view === 'launcher' ? <LauncherPairingPage /> : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
});
