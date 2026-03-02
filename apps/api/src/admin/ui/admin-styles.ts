export const LOGIN_STYLES = `
  :root {
    --bg0: #111417;
    --bg1: #1c2329;
    --paper: #f6f2e7;
    --ink: #132024;
    --line: rgba(130, 142, 151, 0.3);
    --brand: #b05f33;
    --ok: #3d7752;
    --error: #9b3838;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: "Sora", "Avenir Next", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(700px 500px at 85% -10%, rgba(176, 95, 51, 0.25), transparent 68%),
      radial-gradient(700px 500px at 0% 120%, rgba(86, 112, 132, 0.18), transparent 65%),
      linear-gradient(135deg, var(--bg0) 0%, var(--bg1) 45%, #1f252b 100%);
  }

  .login-shell {
    width: min(460px, calc(100vw - 36px));
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--paper);
    padding: 24px;
    display: grid;
    gap: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.34);
  }

  h1 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    color: #6e7478;
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  }

  label {
    display: grid;
    gap: 7px;
    color: #6e7478;
    font-size: 0.85rem;
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  }

  input {
    border: 1px solid rgba(43, 65, 78, 0.25);
    border-radius: 10px;
    background: #fffcf4;
    padding: 11px 12px;
    font: inherit;
    color: var(--ink);
  }

  button {
    border: 0;
    border-radius: 10px;
    padding: 11px 13px;
    color: #fff6ee;
    background: linear-gradient(160deg, #b66a3e 0%, #8e4f28 100%);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    border-radius: 10px;
    border: 1px solid rgba(124, 136, 141, 0.3);
    background: #ede7d8;
    min-height: 40px;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    color: var(--ink);
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  }

  .ok { color: var(--ok); }
  .error { color: var(--error); }
`;

export const ADMIN_STYLES = `
  :root {
    --bg0: #0e1217;
    --bg1: #131a21;
    --surface-0: rgba(14, 21, 29, 0.82);
    --surface-1: rgba(18, 27, 36, 0.9);
    --surface-2: rgba(22, 31, 40, 0.95);
    --line: rgba(108, 129, 148, 0.34);
    --line-soft: rgba(126, 144, 156, 0.24);
    --text: #f3eee5;
    --muted: #9aaab7;
    --brand: #b46a41;
    --brand-strong: #8f502f;
    --warning: #cc7f2f;
    --danger: #a54e4e;
    --ok: #6fa786;
    --accent-glow: rgba(180, 106, 65, 0.25);
    --focus-ring: rgba(255, 184, 137, 0.65);
    --motion-fast: 140ms;
    --motion-mid: 200ms;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    color: var(--text);
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    background:
      radial-gradient(860px 540px at 14% -8%, rgba(180, 106, 65, 0.2), transparent 66%),
      radial-gradient(760px 520px at 106% 120%, rgba(67, 96, 118, 0.2), transparent 68%),
      linear-gradient(160deg, var(--bg0) 0%, var(--bg1) 58%, #111820 100%);
  }

  .shell {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    min-height: 100vh;
  }

  .nav {
    border-right: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(20, 29, 38, 0.86), rgba(16, 24, 33, 0.94));
    padding: 14px;
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .brand {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-0);
    padding: 9px 10px;
    display: grid;
    gap: 4px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .brand h1 {
    margin: 0;
    font-family: "Sora", "Avenir Next", sans-serif;
    font-size: 0.96rem;
  }

  .tag {
    display: inline-flex;
    width: fit-content;
    border-radius: 999px;
    border: 1px solid rgba(178, 105, 64, 0.5);
    background: rgba(178, 105, 64, 0.15);
    color: #f7dece;
    padding: 3px 9px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .nav-list {
    display: grid;
    gap: 6px;
  }

  .nav-item {
    border: 1px solid var(--line-soft);
    border-radius: 9px;
    padding: 7px 9px;
    width: 100%;
    text-align: left;
    color: #c5d0d6;
    font-size: 0.82rem;
    background: rgba(32, 43, 52, 0.52);
    cursor: pointer;
    min-height: 38px;
    transition:
      background var(--motion-fast) ease,
      border-color var(--motion-fast) ease,
      color var(--motion-fast) ease,
      transform var(--motion-fast) ease;
  }

  .nav-item.active {
    border-color: rgba(178, 105, 64, 0.45);
    color: #ffe6d7;
    background: rgba(176, 105, 64, 0.12);
    box-shadow: 0 0 0 1px rgba(178, 105, 64, 0.18), 0 10px 20px rgba(0, 0, 0, 0.15);
  }

  .nav-item:hover {
    background: rgba(44, 56, 67, 0.58);
    transform: translateY(-1px);
  }

  .main {
    padding: 14px;
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .topbar {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: linear-gradient(180deg, var(--surface-1), rgba(17, 25, 34, 0.95));
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    flex-wrap: wrap;
    font-size: 0.84rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .topbar-meta {
    display: grid;
    gap: 2px;
  }

  .topbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .topbar .status {
    margin-left: auto;
    min-width: 220px;
  }

  .publish-reminder {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(204, 127, 47, 0.42);
    border-radius: 999px;
    padding: 3px 6px 3px 9px;
    background: rgba(176, 105, 64, 0.15);
    color: #ffdcbc;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .requires-publish {
    color: #ffdcbc;
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .publish-clean {
    color: #9ec9ab;
    font-size: 0.74rem;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: linear-gradient(180deg, var(--surface-1), rgba(16, 24, 32, 0.95));
    padding: 10px;
    display: grid;
    gap: 8px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 14px 30px rgba(0, 0, 0, 0.16);
    transition: border-color var(--motion-fast) ease, box-shadow var(--motion-fast) ease;
  }

  .grid {
    display: grid;
    gap: 8px;
  }

  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel h2,
  .panel h3 {
    margin: 0;
    font-family: "Sora", "Avenir Next", sans-serif;
    letter-spacing: 0.01em;
    font-size: 0.92rem;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.28;
  }

  label {
    display: grid;
    gap: 4px;
    font-size: 0.76rem;
    color: #c6d2da;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    background: rgba(10, 15, 21, 0.68);
    color: var(--text);
    padding: 7px 9px;
    font: inherit;
    font-size: 0.82rem;
    min-height: 36px;
    transition:
      border-color var(--motion-fast) ease,
      box-shadow var(--motion-fast) ease,
      background var(--motion-fast) ease;
  }

  textarea {
    min-height: 62px;
    resize: vertical;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .btn {
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 7px 10px;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    color: #fdf5ee;
    background: linear-gradient(165deg, var(--brand) 0%, var(--brand-strong) 100%);
    cursor: pointer;
    min-height: 36px;
    transition:
      filter var(--motion-fast) ease,
      transform var(--motion-fast) ease,
      box-shadow var(--motion-fast) ease,
      border-color var(--motion-fast) ease;
  }

  .btn:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  }

  .btn.ghost {
    color: #d8e0e6;
    background: rgba(34, 44, 53, 0.62);
    border-color: var(--line);
  }

  .btn.danger {
    background: rgba(156, 79, 79, 0.34);
    border-color: rgba(195, 106, 106, 0.56);
    color: #ffdede;
  }

  .warning-btn {
    background: linear-gradient(165deg, #c17a35 0%, #9d6128 100%);
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: none;
    transform: none;
    box-shadow: none;
  }

  .status {
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    min-height: 32px;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    background: rgba(17, 24, 30, 0.72);
    color: #d4dce1;
    font-size: 0.76rem;
  }

  .status.ok { color: #9ad0a6; }
  .status.error { color: #ffc0c0; }

  .chips {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .chip {
    border: 1px solid rgba(178, 105, 64, 0.5);
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 0.72rem;
    color: #f7dece;
    background: rgba(178, 105, 64, 0.12);
    transition: background var(--motion-fast) ease, border-color var(--motion-fast) ease;
  }

  .warning-chip {
    border-color: rgba(204, 127, 47, 0.55);
    background: rgba(204, 127, 47, 0.18);
    color: #ffd7b2;
  }

  .list {
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 8px;
    max-height: 300px;
    overflow: auto;
    display: grid;
    gap: 6px;
    background: rgba(10, 15, 21, 0.66);
  }

  .list.compact {
    max-height: 200px;
  }

  .item {
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    background: rgba(14, 20, 27, 0.86);
    padding: 8px;
    display: grid;
    gap: 4px;
    transition:
      border-color var(--motion-fast) ease,
      background var(--motion-fast) ease,
      transform var(--motion-fast) ease;
  }

  .item:hover {
    border-color: rgba(160, 178, 192, 0.36);
    background: rgba(18, 25, 33, 0.92);
    transform: translateY(-1px);
  }

  .item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .name {
    font-weight: 600;
    color: #f6f2e7;
    font-size: 0.9rem;
  }

  .meta {
    color: #9eb0ba;
    font-size: 0.75rem;
  }

  .flag {
    border: 1px solid rgba(178, 105, 64, 0.55);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.68rem;
    color: #f7dece;
    background: rgba(178, 105, 64, 0.16);
  }

  .lock-badge {
    border: 1px solid rgba(126, 167, 213, 0.5);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.68rem;
    color: #d7e9ff;
    background: rgba(73, 106, 140, 0.26);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 10, 14, 0.78);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 16px;
  }

  .modal-card {
    width: min(760px, calc(100vw - 20px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: linear-gradient(180deg, var(--surface-2), rgba(15, 22, 30, 0.98));
    padding: 10px;
    display: grid;
    gap: 8px;
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.42),
      0 0 0 1px rgba(173, 191, 207, 0.05);
  }

  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .warning {
    margin: 0;
    border: 1px solid rgba(204, 127, 47, 0.48);
    border-radius: 8px;
    padding: 8px;
    background: rgba(176, 105, 64, 0.16);
    color: #ffd7b7;
    font-size: 0.76rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #d5dfe6;
    font-size: 0.76rem;
  }

  .check input {
    width: 18px;
    height: 18px;
  }

  .mc-preview {
    position: relative;
    border: 1px solid rgba(121, 142, 157, 0.46);
    border-radius: 12px;
    overflow: hidden;
    min-height: 340px;
    background: #141c24;
  }

  .mc-preview-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(140deg, #223245 0%, #1d2834 45%, #141d27 100%);
    background-size: cover;
    background-position: center;
    filter: saturate(1.06) contrast(1.04);
  }

  .mc-preview-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(13, 20, 27, 0.34) 0%, rgba(8, 12, 16, 0.68) 100%),
      repeating-linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.02) 0px,
        rgba(255, 255, 255, 0.02) 1px,
        transparent 1px,
        transparent 3px
      );
  }

  .mc-preview-content {
    position: relative;
    z-index: 1;
    min-height: 340px;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 10px;
    padding: 24px;
  }

  .mc-preview-logo {
    max-width: 260px;
    max-height: 84px;
    object-fit: contain;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5));
  }

  .mc-preview-title {
    margin: 0;
    font-family: "Sora", "Avenir Next", sans-serif;
    font-size: 1.8rem;
    letter-spacing: 0.01em;
  }

  .mc-preview-subtitle {
    margin: 0;
    color: #cad5dc;
    font-size: 0.9rem;
  }

  .mc-preview-buttons {
    width: min(320px, 100%);
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }

  .mc-btn {
    width: 100%;
    border: 1px solid rgba(115, 134, 149, 0.55);
    border-radius: 6px;
    padding: 9px 10px;
    font: inherit;
    color: #eaf0f4;
    background: linear-gradient(180deg, rgba(62, 77, 90, 0.92), rgba(40, 53, 64, 0.92));
    transition: transform var(--motion-fast) ease, filter var(--motion-fast) ease;
  }

  .mc-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  .mc-btn.primary {
    border-color: rgba(205, 137, 89, 0.72);
    background: linear-gradient(180deg, rgba(181, 113, 69, 0.95), rgba(135, 78, 45, 0.95));
    color: #fff5eb;
  }

  .view-stage {
    display: grid;
    gap: 8px;
    animation: view-in var(--motion-mid) ease;
  }

  @keyframes view-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  *:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 1100px) {
    .shell { grid-template-columns: 1fr; }
    .nav { border-right: 0; border-bottom: 1px solid var(--line); }
    .topbar .status {
      margin-left: 0;
      min-width: 0;
      width: 100%;
    }
  }

  @media (max-width: 760px) {
    .grid.two { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;
