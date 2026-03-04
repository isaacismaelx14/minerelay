export const LOGIN_STYLES = `
  :root {
    --bg-base: #0a0a0e;
    --bg-surface: rgba(18, 18, 26, 0.65);

    --text-primary: #f0f4f8;
    --text-secondary: #a0aec0;
    --text-muted: #64748b;

    --brand-primary: #6366f1;
    --brand-accent: #0ea5e9;

    --success: #10b981;
    --danger: #ef4444;

    --line: rgba(255, 255, 255, 0.06);
    --line-strong: rgba(255, 255, 255, 0.12);

    --radius-xl: 28px;
    --radius-md: 12px;
    --radius-sm: 8px;

    --glass-blur: blur(16px);
    --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: 'Outfit', system-ui, sans-serif;
    color: var(--text-primary);
    background-color: var(--bg-base);
    background-image:
      radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.14), transparent 45%),
      radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.1), transparent 45%),
      radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 50%);
    background-attachment: fixed;
    -webkit-font-smoothing: antialiased;
  }

  .login-shell {
    width: min(420px, calc(100vw - 36px));
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-xl);
    background: var(--bg-surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    padding: 36px;
    display: grid;
    gap: 20px;
    box-shadow:
      0 0 0 1px rgba(99, 102, 241, 0.08),
      0 24px 60px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    animation: fadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  }

  h1 {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #fff 30%, #a5b4fc);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.55;
  }

  label {
    display: grid;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  form {
    display: grid;
    gap: 16px;
  }

  input {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
    padding: 13px 16px;
    font: inherit;
    font-size: 0.95rem;
    color: var(--text-primary);
    width: 100%;
    transition: all var(--transition-fast);
    outline: none;
  }

  input:focus {
    border-color: var(--brand-primary);
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
  }

  button {
    border: none;
    border-radius: var(--radius-md);
    padding: 14px 20px;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
    width: 100%;
    text-align: center;
    letter-spacing: 0.01em;
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
    filter: brightness(1.08);
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .status {
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    font-size: 0.85rem;
    color: var(--text-muted);
    transition: all var(--transition-fast);
  }

  .ok {
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.2);
    background: rgba(16, 185, 129, 0.05);
  }

  .error {
    color: var(--danger);
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

export const ADMIN_STYLES = `
  :root {
    --bg-base: #0a0a0e;
    --bg-surface: rgba(18, 18, 26, 0.65);
    --bg-surface-hover: rgba(26, 26, 38, 0.8);
    --bg-card: rgba(16, 17, 24, 0.55);
    --bg-card-hover: rgba(22, 23, 32, 0.75);
    --radius-lg: 20px;
    --bg-card-hover: rgba(22, 24, 34, 0.7);

    --text-primary: #f0f4f8;
    --text-secondary: #a0aec0;
    --text-muted: #64748b;

    --brand-primary: #6366f1;
    --brand-primary-glow: rgba(99, 102, 241, 0.5);
    --brand-secondary: #8b5cf6;
    --brand-accent: #0ea5e9;
    --brand-accent-glow: rgba(14, 165, 233, 0.5);

    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;

    --sidebar-w: 240px;
    --workspace-padding: 32px;

    --radius-xl: 28px;
    --radius-lg: 20px;
    --radius-md: 12px;
    --radius-sm: 8px;

    --line: rgba(255, 255, 255, 0.06);
    --line-strong: rgba(255, 255, 255, 0.12);

    --glass-blur: blur(16px);
    --transition-smooth: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    height: 100vh;
    color: var(--text-primary);
    font-family: 'Outfit', system-ui, sans-serif;
    background-color: var(--bg-base);
    background-image:
      radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.12), transparent 45%),
      radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.1), transparent 45%),
      radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 50%);
    background-attachment: fixed;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
  }

  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    height: 100vh;
    padding: var(--workspace-padding);
    gap: var(--workspace-padding);
    overflow: hidden;
  }

  /* Nav Sidebar */
  .nav {
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--bg-surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    padding: 24px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 32px;
    animation: fadeIn var(--transition-smooth);
  }

  .brand {
    display: grid;
    gap: 4px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--line);
  }

  .brand h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    background: linear-gradient(135deg, #fff, #a5b4fc);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.01em;
  }

  .tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--brand-accent);
    font-weight: 500;
  }

  .nav-list {
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .nav-item {
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-secondary);
    padding: 14px 20px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: all var(--transition-fast);
    text-align: left;
    width: 100%;
    position: relative;
  }

  .nav-item:hover {
    background: var(--bg-card-hover);
    color: #fff;
    transform: translateX(4px);
  }

  .nav-item.active {
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.02));
    border: 1px solid rgba(99, 102, 241, 0.2);
    color: #fff;
    font-weight: 600;
  }

  .nav-item::before {
    content: '';
    position: absolute;
    left: 0; top: 25%; bottom: 25%; width: 3px;
    background: var(--brand-primary);
    transform: scaleY(0);
    transition: transform var(--transition-fast);
    border-radius: 0 4px 4px 0;
  }

  .nav-item:hover::before { transform: scaleY(0.6); }
  .nav-item.active::before { transform: scaleY(1.5); top: 15%; bottom: 15%; }

  .nav-icon {
    width: 18px;
    height: 18px;
    opacity: 0.7;
    transition: all var(--transition-fast);
    color: currentColor;
  }

  .nav-item:hover .nav-icon,
  .nav-item.active .nav-icon {
    opacity: 1;
    color: var(--brand-accent);
    transform: scale(1.1);
  }

  /* Main Workspace Area */
  .main {
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--bg-surface);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    padding: 32px 40px;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 32px;
    position: relative;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
  }

  .main::-webkit-scrollbar {
    width: 12px;
  }
  .main::-webkit-scrollbar-track {
    background: transparent;
    margin: 16px 0;
  }
  .main::-webkit-scrollbar-thumb {
    background-color: var(--line-strong);
    background-clip: padding-box;
    border: 4px solid transparent;
    border-radius: 10px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 24px;
  }

  .topbar-meta {
    font-size: 0.92rem;
    color: var(--text-secondary);
  }

  .topbar-meta b { color: #fff; }

  .topbar-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .publish-reminder {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .requires-publish {
    font-size: 0.78rem;
    font-weight: 600;
    color: #f97316;
    background: rgba(249, 115, 22, 0.12);
    border: 1px solid rgba(249, 115, 22, 0.3);
    border-radius: 6px;
    padding: 3px 10px;
    white-space: nowrap;
  }

  .draft-pending {
    font-size: 0.78rem;
    font-weight: 600;
    color: #eab308;
    background: rgba(234, 179, 8, 0.12);
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 6px;
    padding: 3px 10px;
    white-space: nowrap;
  }

  .publish-clean {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* Panels & Cards */
  .panel {
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: all var(--transition-fast);
  }

  .panel:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
    transform: translateY(-2px);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .panel h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
    letter-spacing: -0.01em;
  }

  .hint {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 24px;
  }

  /* Data-Item Components */
  .data-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .data-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .data-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-weight: 600;
  }

  .data-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88rem;
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.25);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    word-break: break-all;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Mod Manager Lists */
  .list {
    display: grid;
    gap: 8px;
  }

  .list.compact .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    gap: 16px;
    background: rgba(255, 255, 255, 0.02);
  }

  .item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px;
    transition: all var(--transition-fast);
  }

  .item:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
    transform: translateY(-2px);
  }

  .item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .name {
    font-weight: 600;
    color: #fff;
    font-size: 0.98rem;
  }

  .meta {
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  /* Status Badges */
  .status {
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line);
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .status.ok { color: var(--success); border-color: rgba(16, 185, 129, 0.2); }
  .status.error { color: var(--danger); border-color: rgba(239, 68, 68, 0.2); }

  /* Grid Layouts */
  .grid {
    display: grid;
    gap: 24px;
  }
  .grid.two {
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  }

  .summary-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 8px;
  }

  @media (max-width: 800px) {
    .summary-bar {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .summary-item {
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    transition: all var(--transition-fast);
  }

  .summary-item:hover {
    background: var(--bg-card-hover);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }

  .summary-value {
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary);
  }

  .summary-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .summary-item.keep .summary-value { color: var(--brand-primary); }
  .summary-item.add .summary-value { color: var(--success); }
  .summary-item.remove .summary-value { color: var(--danger); }
  .summary-item.update .summary-value { color: var(--brand-accent); }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 24px;
  }

  .integrations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
    margin-top: 12px;
  }

  .integration-card {
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    transition: all var(--transition-smooth);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    outline: none;
  }

  .integration-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 60%);
    opacity: 0;
    transition: opacity var(--transition-smooth);
  }

  .integration-card:hover:not(.disabled) {
    background: var(--bg-card-hover);
    border-color: var(--brand-primary);
    transform: translateY(-6px);
    box-shadow:
      0 20px 48px rgba(0, 0, 0, 0.5),
      0 0 0 1px var(--brand-primary-glow);
  }

  .integration-card:hover:not(.disabled)::before {
    opacity: 1;
  }

  .integration-card.disabled {
    opacity: 0.5;
    cursor: default;
    filter: grayscale(0.6);
    border-style: dashed;
  }

  .integration-card h3 {
    margin: 0;
    font-size: 1.4rem;
    color: #fff;
  }

  .connection-badge {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(16, 185, 129, 0.2);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.4);
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 2;
  }

  .active-integration {
    border-color: var(--brand-primary) !important;
    background: linear-gradient(135deg, var(--bg-card), rgba(99, 102, 241, 0.05)) !important;
  }

  .integration-card p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .integration-logo-wrapper {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-md);
    padding: 12px;
    transition: all var(--transition-fast);
  }

  .integration-card:hover:not(.disabled) .integration-logo-wrapper {
    background: rgba(99, 102, 241, 0.1);
    transform: scale(1.05);
  }

  .image-field {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 20px;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
  }

  .image-preview-box {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .image-preview-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .upload-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-input-wrapper {
    position: relative;
    overflow: hidden;
    display: inline-block;
  }

  .file-input-wrapper input[type=file] {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  /* Inputs & Buttons */
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.88rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  input, select, textarea {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    color: #fff;
    font-family: inherit;
    font-size: 0.95rem;
    width: 100%;
    transition: all var(--transition-fast);
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
  }

  .check {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.02);
    padding: 14px 18px;
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
    transition: all var(--transition-fast);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .check:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--line-strong);
    color: #fff;
  }

  .check input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--brand-primary);
    flex-shrink: 0;
  }

  .alert-box {
    padding: 16px 20px;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    line-height: 1.5;
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.02);
  }

  .security-banner {
    background: linear-gradient(90deg, rgba(14, 165, 233, 0.1), rgba(99, 102, 241, 0.05));
    border: 1px solid rgba(14, 165, 233, 0.2);
    border-left: 4px solid var(--brand-accent);
    padding: 20px 24px;
    border-radius: var(--radius-lg);
    display: flex;
    gap: 16px;
    align-items: center;
    margin: 8px 0;
  }

  .security-banner-icon {
    font-size: 1.5rem;
    color: var(--brand-accent);
    filter: drop-shadow(0 0 8px var(--brand-accent-glow));
  }

  .security-banner p {
    margin: 0;
    font-size: 0.92rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .alert-box.danger {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .alert-box.danger strong {
    color: #ef4444;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  .btn {
    border: none;
    border-radius: var(--radius-md);
    padding: 12px 20px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    background: var(--brand-primary);
    color: #fff;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.1);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
  }

  .btn.ghost {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--line);
    color: var(--text-secondary);
    box-shadow: none;
  }

  .btn.danger {
    background: var(--danger);
    color: #fff;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
  }

  .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    filter: grayscale(0.5);
    box-shadow: none;
    transform: none !important;
  }

  .btn-wrapper {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-tooltip {
    font-size: 0.75rem;
    color: #fca5a5;
    font-weight: 500;
    opacity: 0.9;
    background: rgba(239, 68, 68, 0.1);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn var(--transition-fast);
    padding: 20px;
  }

  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 32px;
    width: min(700px, 90vw);
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
    position: relative;
  }

  .modal-close-icon {
    position: absolute;
    top: 24px;
    right: 24px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--line);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    padding: 0;
  }

  .modal-close-icon:hover {
    background-color: var(--danger);
    color: #fff;
    border-color: var(--danger);
    transform: rotate(90deg);
  }

  .row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .warning {
    background: var(--warning-bg);
    border: 1px solid rgba(245, 158, 11, 0.2);
    padding: 20px;
    border-radius: var(--radius-md);
    color: var(--warning);
    font-size: 0.92rem;
    line-height: 1.6;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 1024px) {
    --sidebar-w: 80px;
    .nav-item span { display: none; }
    .nav-item { justify-content: center; padding: 12px; }
    .nav-item::before { visibility: hidden; }
  }

  /* Enhanced Mod Cards - Search Results */
  .mod-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 20px;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 20px;
    transition: all var(--transition-fast);
    margin-bottom: 8px;
  }

  .mod-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .mod-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line);
    object-fit: contain;
    flex-shrink: 0;
  }

  .mod-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .mod-name-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mod-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modrinth-link {
    color: var(--text-muted);
    transition: color var(--transition-fast);
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .modrinth-link:hover { color: var(--brand-accent); }

  .mod-description {
    font-size: 0.88rem;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.5;
  }

  .mod-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .mod-meta-item {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(0, 0, 0, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--line);
  }

  .mod-actions {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;
  }

  .lock-badge {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: var(--warning);
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .lock-badge::before { content: '🔒'; font-size: 0.8rem; }

  /* ====== Installed Mods Grid ====== */
  .mods-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mods-section-label.core {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.25);
  }

  .mods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .mod-grid-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px 12px 12px;
    transition: all var(--transition-fast);
    position: relative;
    text-align: center;
  }

  .mod-grid-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
    transform: translateY(-3px);
    box-shadow: 0 10px 36px rgba(0, 0, 0, 0.5);
  }

  .mod-grid-card.core-mod {
    border-color: rgba(245, 158, 11, 0.2);
    background: rgba(245, 158, 11, 0.04);
  }

  .mod-grid-card.core-mod:hover { border-color: rgba(245, 158, 11, 0.4); }

  .mod-grid-icon {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-sm);
    object-fit: contain;
    border: 1px solid var(--line);
    background: rgba(0,0,0,0.3);
  }

  .mod-grid-name {
    font-size: 0.84rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
    word-break: break-word;
  }

  .mod-grid-meta {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .mod-grid-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: auto;
    width: 100%;
    padding-top: 4px;
  }

  .mod-grid-badge {
    position: absolute;
    top: 6px;
    right: 6px;
  }

  /* ====== Add Mods Modal ====== */
  .modal-card.wide {
    width: min(1060px, calc(100vw - 40px));
    height: calc(100vh - 80px);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    gap: 0;
  }

  .add-mods-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  .add-mods-search-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--line);
    padding: 16px 20px;
    gap: 12px;
  }

  .add-mods-cart-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 16px;
    gap: 10px;
    background: rgba(0, 0, 0, 0.12);
  }

  .add-mods-cart-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .cart-count-badge {
    background: var(--brand-primary);
    color: #fff;
    border-radius: 999px;
    font-size: 0.68rem;
    padding: 1px 7px;
    font-weight: 700;
  }

  .add-mods-search-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .add-mods-search-results {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    min-height: 0;
  }

  .add-mods-cart-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    min-height: 0;
  }

  .search-result-card {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: 10px;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 10px;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .search-result-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
  }

  .search-result-card.in-cart {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.07);
  }

  .search-result-card.already-installed { opacity: 0.5; }

  .search-result-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: contain;
    border: 1px solid var(--line);
    background: rgba(0,0,0,0.3);
    flex-shrink: 0;
  }

  .search-result-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .search-result-name {
    font-size: 0.88rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modrinth-title-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modrinth-title-link:hover {
    text-decoration: underline;
    color: var(--brand-primary);
  }

  .modrinth-title-link svg {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .modrinth-title-link:hover svg {
    opacity: 1;
  }

  .search-result-sub {
    font-size: 0.72rem;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .dep-badge {
    font-size: 0.66rem;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 600;
  }

  .dep-badge.has-deps {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: var(--warning);
  }

  .dep-badge.no-deps {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--success);
  }

  .cart-item {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    gap: 6px;
    align-items: center;
    background: rgba(99, 102, 241, 0.06);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: var(--radius-sm);
    padding: 8px;
    flex-shrink: 0;
  }

  .cart-item-icon {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    object-fit: contain;
    border: 1px solid var(--line);
    background: rgba(0,0,0,0.3);
  }

  .cart-item-name {
    font-size: 0.78rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cart-item-deps {
    font-size: 0.66rem;
    color: var(--text-muted);
  }

  .cart-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.82rem;
    gap: 8px;
    text-align: center;
    padding: 16px;
    opacity: 0.7;
  }

  .add-mods-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid var(--line);
    gap: 12px;
    flex-shrink: 0;
  }

  .search-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid var(--line);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Wizard / Flow Styles for Admin */
  .wizard-steps {
    display: flex;
    gap: 32px;
    margin-bottom: 24px;
    padding: 0 4px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 16px;
  }

  .wizard-steps .step {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-muted);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.55;
    user-select: none;
    position: relative;
    padding-bottom: 14px;
    border: none;
    background: transparent;
    cursor: default;
  }

  .wizard-steps .step.active {
    color: #fff;
    opacity: 1;
  }

  .wizard-steps .step.active::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0; height: 2px;
    background: var(--brand-primary);
    box-shadow: 0 0 12px var(--brand-primary-glow);
  }

  .wizard-steps .step.done {
    color: var(--success);
    opacity: 1;
  }

  .wizard-panel {
    display: flex;
    flex-direction: column;
    gap: 24px;
    animation: fadeIn var(--transition-fast);
  }

  .wizard-box {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 24px;
    display: grid;
    gap: 16px;
  }

  .wizard-meta {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  .wizard-description {
    font-size: 0.92rem;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 8px;
    padding: 16px 20px;
    background: rgba(99, 102, 241, 0.05);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--brand-primary);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 8px;
  }

  .mode-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: grid;
    gap: 12px;
    text-align: left;
    width: 100%;
    align-content: start;
    outline: none;
  }

  .mode-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--line-strong);
    transform: translateY(-2px);
  }

  .mode-card.active {
    background: rgba(99, 102, 241, 0.1);
    border-color: var(--brand-primary);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.1);
  }

  .mode-card h4 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: #fff;
  }

  .mode-card p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  .mode-card-icon {
    font-size: 1.75rem;
    margin-bottom: 4px;
  }

  .exaroton-grid {
    display: grid;
  }

  .exaroton-panel {
    display: grid;
    gap: 16px;
  }

  .exaroton-warning {
    border: 1px solid rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.08);
    border-radius: var(--radius-md);
    padding: 14px 16px;
  }

  .exaroton-warning p {
    margin-top: 6px;
  }

  .exaroton-connect-box {
    display: grid;
    gap: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.2);
    padding: 14px;
  }

  .key-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .exaroton-account-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.03);
    padding: 20px 24px;
    transition: all var(--transition-fast);
  }

  .exaroton-account-row:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--brand-primary);
  }

  .exaroton-account-info {
    display: grid;
    gap: 4px;
  }

  .exaroton-account-info strong {
    font-size: 1.1rem;
    color: #fff;
  }

  .exaroton-account-info span {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .exaroton-server-list {
    display: grid;
    gap: 8px;
  }

  .exaroton-server-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.2);
    color: var(--text-primary);
    padding: 12px 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .exaroton-server-item:hover:not(:disabled) {
    border-color: var(--line-strong);
    background: rgba(0, 0, 0, 0.3);
  }

  .exaroton-server-item.active {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.18);
  }

  .exaroton-server-item p {
    margin: 4px 0 0 0;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .status-chip {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid var(--line);
    background: rgba(148, 163, 184, 0.12);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .status-chip-online {
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.1);
  }

  .status-chip-offline {
    color: var(--text-secondary);
    border-color: var(--line);
    background: rgba(148, 163, 184, 0.12);
  }

  .status-chip-busy {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.1);
  }

  .status-chip-crashed {
    color: var(--danger);
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.1);
  }

  .exaroton-selected-card {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.22);
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .exaroton-selected-card h3 {
    margin: 0;
    font-size: 1rem;
  }

  .exaroton-selected-card .data-list {
    margin-top: 0;
  }

  /* New Exaroton Wizard & UI */
  .exaroton-wizard {
    display: grid;
    gap: 32px;
    animation: fadeIn var(--transition-smooth);
  }

  .exaroton-hero {
    text-align: center;
    padding: 60px 40px;
    background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 60%),
                radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.05), transparent 60%);
    border-radius: var(--radius-xl);
    border: 1px solid var(--line-strong);
    display: grid;
    gap: 32px;
    place-items: center;
    position: relative;
  }

  .exaroton-hero::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--brand-primary), transparent);
    opacity: 0.5;
  }

  .exaroton-logo-large {
    width: 100px;
    height: 100px;
    filter: drop-shadow(0 0 30px rgba(99, 102, 241, 0.4));
    transition: transform var(--transition-smooth);
  }

  .exaroton-hero:hover .exaroton-logo-large {
    transform: scale(1.05) rotate(2deg);
  }

  .exaroton-connect-btn {
    background: linear-gradient(135deg, #6366f1, #0ea5e9);
    padding: 16px 32px;
    font-size: 1.1rem;
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
  }

  .wizard-step {
    display: grid;
    gap: 32px;
    position: relative;
    animation: fadeIn var(--transition-smooth);
    padding: 20px 0;
  }

  .wizard-step::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--brand-primary), var(--brand-accent));
    opacity: 0.8;
  }

  .step-header {
    display: grid;
    gap: 8px;
  }

  .step-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
  }

  .exaroton-server-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin: 12px 0;
  }

  .server-card {
    background: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
    cursor: pointer;
    transition: all var(--transition-smooth);
    text-align: left;
    display: grid;
    gap: 16px;
    position: relative;
    overflow: hidden;
    outline: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .server-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent);
    pointer-events: none;
    opacity: 0.5;
  }

  .server-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--line-strong);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }

  .server-card:hover strong {
    color: var(--brand-accent);
  }

  .server-card.active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(14, 165, 233, 0.08));
    border-color: var(--brand-primary);
    box-shadow:
      0 0 0 1px var(--brand-primary-glow),
      0 16px 40px rgba(0, 0, 0, 0.5);
  }

  .server-card.active::after {
    content: '✓';
    position: absolute;
    top: 16px; right: 16px;
    width: 24px; height: 24px;
    background: var(--brand-primary);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
    box-shadow: 0 0 12px var(--brand-primary-glow);
  }

  .server-card strong {
    font-size: 1.15rem;
    color: #fff;
    letter-spacing: -0.01em;
    transition: color var(--transition-fast);
  }

  .server-card .hint {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-secondary);
    font-family: 'JetBrains Mono', monospace;
    opacity: 0.8;
  }

  .server-name-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .server-card .meta {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .server-card .meta::before {
    content: '';
    width: 6px; height: 6px;
    background: var(--brand-accent);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--brand-accent-glow);
  }

  .exaroton-widget {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-xl);
    padding: 6px 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.85rem;
    backdrop-filter: var(--glass-blur);
  }

  .widget-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .widget-controls {
    display: flex;
    gap: 4px;
    border-left: 1px solid var(--line);
    padding-left: 12px;
  }

  .control-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.2s;
    background: transparent;
    color: var(--text-secondary);
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn svg { width: 14px; height: 14px; }

  /* Sidebar Bottom status */
  .nav-status {
    margin-top: auto;
    padding-top: 24px;
    border-top: 1px solid var(--line);
    display: grid;
    gap: 12px;
  }

  .rail-chip {
    font-size: 0.72rem;
    padding: 4px 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .rail-chip b { color: var(--text-secondary); }

  /* API Key Input Improvements */
  .api-key-container {
    display: grid;
    gap: 12px;
    position: relative;
  }

  .api-key-input {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.9rem !important;
    letter-spacing: 0.05em;
    background: rgba(0, 0, 0, 0.4) !important;
    border: 1px solid var(--line-strong) !important;
    padding: 16px 20px !important;
    border-radius: var(--radius-lg) !important;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .api-key-input:focus {
    border-color: var(--brand-primary) !important;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15), inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
  }

  .link-premium {
    color: var(--brand-accent);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 1px dashed var(--brand-accent-glow);
    transition: all var(--transition-fast);
  }

  .link-premium:hover {
    color: #fff;
    border-bottom-color: #fff;
    text-shadow: 0 0 12px var(--brand-accent-glow);
  }

  /* Success Step Styling */
  .success-step {
    text-align: center;
    padding: 60px 40px;
    display: grid;
    gap: 32px;
    place-items: center;
    animation: successIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .success-icon-wrapper {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    box-shadow: 0 0 50px rgba(16, 185, 129, 0.4);
    position: relative;
  }

  .success-icon-wrapper::after {
    content: '';
    position: absolute;
    top: -15px; left: -15px; right: -15px; bottom: -15px;
    border: 2px solid #10b981;
    border-radius: 50%;
    opacity: 0;
    animation: successPing 2s infinite;
  }

  .success-content {
    display: grid;
    gap: 16px;
  }

  .success-content h2 {
    font-size: 2.25rem;
    font-weight: 800;
    margin: 0;
    background: linear-gradient(to bottom, #fff, #d1fae5);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }

  .success-content p {
    font-size: 1.15rem;
    color: var(--text-secondary);
    max-width: 440px;
    line-height: 1.6;
    margin: 0 auto;
  }

  .finish-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    padding: 18px 60px;
    font-size: 1.2rem;
    font-weight: 800;
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
    border: none;
    cursor: pointer;
  }

  .finish-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 40px rgba(16, 185, 129, 0.5);
    filter: brightness(1.1);
  }

  @keyframes successIn {
    from { opacity: 0; transform: scale(0.95) translateY(30px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes successPing {
    0% { transform: scale(0.8); opacity: 0; }
    50% { opacity: 0.4; }
    100% { transform: scale(1.4); opacity: 0; }
  }
`;
