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
    --bg0: #111417;
    --bg1: #1a2026;
    --panel: rgba(27, 35, 41, 0.82);
    --line: rgba(91, 113, 129, 0.35);
    --line-soft: rgba(142, 152, 156, 0.28);
    --text: #f6f2e7;
    --muted: #97a7b1;
    --brand: #b26940;
    --brand-strong: #8f502f;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    color: var(--text);
    font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    background:
      radial-gradient(760px 460px at 14% -8%, rgba(176, 105, 64, 0.22), transparent 66%),
      radial-gradient(680px 420px at 106% 120%, rgba(83, 117, 142, 0.2), transparent 68%),
      linear-gradient(160deg, var(--bg0) 0%, var(--bg1) 58%, #1a2026 100%);
  }

  .shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    min-height: 100vh;
  }

  .nav {
    border-right: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(27, 35, 41, 0.78), rgba(19, 26, 31, 0.88));
    padding: 24px;
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .brand {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(31, 40, 46, 0.7);
    padding: 12px;
    display: grid;
    gap: 6px;
  }

  .brand h1 {
    margin: 0;
    font-family: "Sora", "Avenir Next", sans-serif;
    font-size: 1.02rem;
  }

  .tag {
    display: inline-flex;
    width: fit-content;
    border-radius: 999px;
    border: 1px solid rgba(178, 105, 64, 0.5);
    background: rgba(178, 105, 64, 0.15);
    color: #f7dece;
    padding: 4px 10px;
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .nav-list {
    display: grid;
    gap: 7px;
  }

  .nav-item {
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 9px 10px;
    color: #c5d0d6;
    font-size: 0.86rem;
    background: rgba(37, 47, 54, 0.45);
    text-decoration: none;
  }

  .nav-item.active {
    border-color: rgba(178, 105, 64, 0.45);
    color: #ffe6d7;
    background: rgba(176, 105, 64, 0.12);
  }

  .main {
    padding: 20px;
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .topbar {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(28, 35, 42, 0.72);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    flex-wrap: wrap;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .grid {
    display: grid;
    gap: 10px;
  }

  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel h2,
  .panel h3 {
    margin: 0;
    font-family: "Sora", "Avenir Next", sans-serif;
    letter-spacing: 0.01em;
    font-size: 0.98rem;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 0.8rem;
    color: #c6d2da;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: rgba(12, 18, 22, 0.45);
    color: var(--text);
    padding: 9px 10px;
    font: inherit;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .btn {
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 9px 12px;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    color: #fdf5ee;
    background: linear-gradient(165deg, var(--brand) 0%, var(--brand-strong) 100%);
    cursor: pointer;
  }

  .btn.ghost {
    color: #d8e0e6;
    background: rgba(39, 49, 57, 0.5);
    border-color: var(--line);
  }

  .btn.danger {
    background: rgba(156, 63, 63, 0.28);
    border-color: rgba(188, 96, 96, 0.52);
    color: #ffdede;
  }

  .status {
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    min-height: 38px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    background: rgba(17, 24, 30, 0.56);
    color: #d4dce1;
    font-size: 0.82rem;
  }

  .status.ok { color: #97d3a4; }
  .status.error { color: #ffb2b2; }

  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip {
    border: 1px solid rgba(178, 105, 64, 0.5);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.78rem;
    color: #f7dece;
    background: rgba(178, 105, 64, 0.12);
  }

  .list {
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    padding: 10px;
    max-height: 300px;
    overflow: auto;
    display: grid;
    gap: 8px;
    background: rgba(10, 15, 19, 0.5);
  }

  .item {
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: rgba(14, 20, 24, 0.7);
    padding: 10px;
    display: grid;
    gap: 6px;
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
  }

  .meta {
    color: #9eb0ba;
    font-size: 0.82rem;
  }

  .flag {
    border: 1px solid rgba(178, 105, 64, 0.55);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 0.72rem;
    color: #f7dece;
    background: rgba(178, 105, 64, 0.16);
  }

  @media (max-width: 1100px) {
    .shell { grid-template-columns: 1fr; }
    .nav { border-right: 0; border-bottom: 1px solid var(--line); }
  }

  @media (max-width: 760px) {
    .grid.two { grid-template-columns: 1fr; }
  }
`;
