export function renderAdminLoginPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MSS+ Client Admin Login</title>
  <style>
    :root {
      --obsidian: #111417;
      --steel: #1c2329;
      --graphite: #2a343d;
      --parchment: #f6f2e7;
      --ink: #132024;
      --muted: #6e7478;
      --redstone: #b05f33;
      --line: rgba(130, 142, 151, 0.3);
      --ok: #3d7752;
      --radius: 14px;
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
        linear-gradient(135deg, var(--obsidian) 0%, var(--steel) 45%, #1f252b 100%);
    }

    .login-shell {
      width: min(460px, calc(100vw - 36px));
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--parchment);
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
      color: var(--muted);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    }

    label {
      display: grid;
      gap: 7px;
      color: var(--muted);
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
    .error { color: #9b3838; }
  </style>
</head>
<body>
  <main class="login-shell">
    <h1>MSS+ Client Control Console</h1>
    <p>Enter your admin password to unlock server publishing controls.</p>

    <label>Password
      <input id="password" type="password" autocomplete="current-password" placeholder="Admin password" />
    </label>

    <button id="loginBtn">Sign In</button>
    <div id="loginStatus" class="status">Ready.</div>
  </main>

  <script src="/admin/login/app.js"></script>
</body>
</html>`;
}

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MSS+ Client Admin Console</title>
  <style>
    :root {
      --obsidian-0: #111417;
      --obsidian-1: #171d22;
      --obsidian-2: #1d252d;
      --steel-0: #2a353f;
      --steel-1: #34434f;
      --parchment-0: #f6f2e7;
      --parchment-1: #ede8d9;
      --ink-0: #17262b;
      --ink-1: #3f4c52;
      --line-0: rgba(73, 95, 112, 0.3);
      --line-1: rgba(142, 152, 156, 0.28);
      --redstone: #b26940;
      --redstone-strong: #8f502f;
      --slime: #4f7f54;
      --danger: #9c3f3f;
      --radius-sm: 10px;
      --radius-md: 14px;
      --radius-lg: 18px;
      --space: 8px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--parchment-0);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(760px 460px at 14% -8%, rgba(176, 105, 64, 0.22), transparent 66%),
        radial-gradient(680px 420px at 106% 120%, rgba(83, 117, 142, 0.2), transparent 68%),
        linear-gradient(160deg, var(--obsidian-0) 0%, var(--obsidian-1) 58%, #1a2026 100%);
    }

    .shell {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      min-height: 100vh;
    }

    .nav {
      border-right: 1px solid var(--line-0);
      background: linear-gradient(180deg, rgba(27, 35, 41, 0.78), rgba(19, 26, 31, 0.88));
      padding: calc(var(--space) * 3);
      display: grid;
      gap: calc(var(--space) * 2);
      align-content: start;
    }

    .brand {
      border: 1px solid var(--line-0);
      border-radius: var(--radius-md);
      background: rgba(31, 40, 46, 0.7);
      padding: calc(var(--space) * 1.5);
      display: grid;
      gap: 6px;
    }

    .brand h1 {
      margin: 0;
      font-family: "Sora", "Avenir Next", sans-serif;
      font-size: 1.02rem;
      letter-spacing: 0.01em;
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
      padding: calc(var(--space) * 2.5);
      display: grid;
      gap: calc(var(--space) * 2);
      align-content: start;
    }

    .topbar {
      border: 1px solid var(--line-0);
      border-radius: var(--radius-md);
      background: rgba(28, 35, 42, 0.72);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: calc(var(--space) * 1.2) calc(var(--space) * 1.5);
      flex-wrap: wrap;
    }

    .topbar b {
      color: #f0dbcc;
      font-family: "Sora", "Avenir Next", sans-serif;
      letter-spacing: 0.02em;
    }

    .btn {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 9px 12px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-amber {
      color: #fff6ef;
      background: linear-gradient(160deg, var(--redstone) 0%, var(--redstone-strong) 100%);
      box-shadow: 0 8px 18px rgba(143, 80, 47, 0.4);
    }

    .btn-ghost {
      border-color: var(--line-1);
      color: #f2efe2;
      background: rgba(243, 236, 220, 0.1);
    }

    .btn-danger {
      border-color: rgba(171, 88, 88, 0.45);
      color: #ffdada;
      background: rgba(153, 58, 58, 0.22);
    }

    .rail {
      border: 1px solid rgba(178, 105, 64, 0.36);
      border-radius: var(--radius-md);
      background: linear-gradient(120deg, rgba(178, 105, 64, 0.15), rgba(178, 105, 64, 0.05));
      padding: calc(var(--space) * 1.3);
      display: grid;
      gap: calc(var(--space) * 1);
    }

    .rail-title {
      margin: 0;
      color: #f9dec9;
      font-family: "Sora", "Avenir Next", sans-serif;
      font-size: 0.95rem;
    }

    .rail-track {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      color: #ffece0;
      font-size: 0.88rem;
    }

    .rail-node {
      border: 1px solid rgba(236, 193, 163, 0.35);
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(252, 214, 188, 0.1);
      font-family: "IBM Plex Mono", monospace;
      font-size: 0.79rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: calc(var(--space) * 2);
    }

    .panel {
      border: 1px solid var(--line-0);
      border-radius: var(--radius-lg);
      background: rgba(29, 36, 44, 0.75);
      padding: calc(var(--space) * 1.8);
      display: grid;
      gap: calc(var(--space) * 1.2);
      align-content: start;
    }

    .panel h2 {
      margin: 0;
      font-family: "Sora", "Avenir Next", sans-serif;
      font-size: 1rem;
      letter-spacing: 0.01em;
      color: #f8f2de;
    }

    .hint {
      margin: 0;
      color: #b8c1c8;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    label {
      display: grid;
      gap: 6px;
      font-size: 0.81rem;
      color: #c0cad1;
    }

    input,
    select,
    textarea {
      border: 1px solid var(--line-0);
      border-radius: var(--radius-sm);
      color: #f8f0df;
      background: rgba(19, 25, 31, 0.85);
      padding: 10px;
      font: inherit;
    }

    textarea {
      min-height: 84px;
      resize: vertical;
      font-family: "IBM Plex Mono", monospace;
      font-size: 0.79rem;
    }

    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .status {
      border: 1px solid var(--line-0);
      border-radius: 10px;
      background: rgba(26, 33, 40, 0.82);
      color: #d2dae0;
      min-height: 38px;
      display: flex;
      align-items: center;
      padding: 8px 10px;
      font-size: 0.84rem;
    }

    .ok { color: #9ad09b; }
    .error { color: #f0a6a6; }

    .list {
      display: grid;
      gap: 8px;
      max-height: 280px;
      overflow: auto;
      padding-right: 2px;
    }

    .item {
      border: 1px solid var(--line-0);
      border-radius: 12px;
      background: rgba(22, 30, 37, 0.9);
      padding: 10px;
      display: grid;
      gap: 6px;
    }

    .item-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .name {
      font-weight: 700;
      color: #f4efde;
    }

    .meta {
      color: #aeb8bf;
      font-size: 0.8rem;
      word-break: break-word;
    }

    .flag {
      border: 1px solid rgba(178, 105, 64, 0.45);
      border-radius: 999px;
      padding: 2px 8px;
      color: #ffd6bc;
      background: rgba(178, 105, 64, 0.12);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .publish {
      grid-column: 1 / -1;
    }

    @media (max-width: 1120px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .nav {
        border-right: 0;
        border-bottom: 1px solid var(--line-0);
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .fields {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <aside class="nav">
      <div class="brand">
        <h1>MSS+ Client Admin</h1>
        <span class="tag">Single server control</span>
      </div>
      <nav class="nav-list">
        <a class="nav-item active" href="#server">Server Identity</a>
        <a class="nav-item" href="#support">Support Matrix</a>
        <a class="nav-item" href="#mods">Mod Workbench</a>
        <a class="nav-item" href="#publish">Publish</a>
      </nav>
    </aside>

    <section class="main">
      <header class="topbar">
        <div><b>Authenticated Session</b> <span id="sessionInfo">ready</span></div>
        <button id="logoutBtn" class="btn btn-danger">Logout</button>
      </header>

      <section class="rail">
        <p class="rail-title">Compatibility Rail</p>
        <div class="rail-track">
          <span class="rail-node" id="railMinecraft">MC: -</span>
          <span>-></span>
          <span class="rail-node" id="railFabric">Fabric: -</span>
          <span>-></span>
          <span class="rail-node" id="railVersion">Next release: -</span>
        </div>
      </section>

      <section class="grid">
        <article class="panel" id="server">
          <h2>Server Identity</h2>
          <p class="hint">Save identity + branding drafts. Publish to push gameplay changes live.</p>
          <div class="fields">
            <label>Server Name
              <input id="serverName" />
            </label>
            <label>Server Address
              <input id="serverAddress" />
            </label>
            <label>Profile ID
              <input id="profileId" />
            </label>
            <label>Current Version
              <input id="currentVersion" disabled />
            </label>
            <label>Current Release (SemVer)
              <input id="currentReleaseVersion" disabled />
            </label>
            <label>Brand Logo URL
              <input id="brandingLogoUrl" placeholder="https://.../logo.png" />
            </label>
            <label>Brand Background URL
              <input id="brandingBackgroundUrl" placeholder="https://.../background.jpg" />
            </label>
            <label>Brand News URL
              <input id="brandingNewsUrl" placeholder="https://.../news" />
            </label>
          </div>
          <div class="row">
            <button id="uploadBrandLogoBtn" class="btn btn-ghost">Upload Logo Image</button>
            <button id="uploadBrandBackgroundBtn" class="btn btn-ghost">Upload Background Image</button>
            <input id="brandLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden />
            <input id="brandBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp" hidden />
          </div>
          <div class="row">
            <button id="saveDraftBtn" class="btn btn-amber">Save Identity + Fancy Draft</button>
          </div>
          <div id="draftStatus" class="status">Ready.</div>
          <div id="bootstrapStatus" class="status">Loading data...</div>
        </article>

        <article class="panel" id="support">
          <h2>Support Matrix</h2>
          <p class="hint">App-level supported Minecraft versions and platforms.</p>
          <div class="fields">
            <label>Supported Minecraft Versions (comma-separated)
              <textarea id="supportedMinecraftVersions"></textarea>
            </label>
            <label>Supported Platforms
              <input id="supportedPlatforms" disabled value="fabric" />
            </label>
            <label>Selected Minecraft Version
              <input id="minecraftVersion" />
            </label>
            <label>Fabric Loader Version
              <select id="loaderVersion"></select>
            </label>
          </div>
          <div class="row">
            <button id="refreshLoadersBtn" class="btn btn-ghost">Refresh Fabric Loaders</button>
            <button id="saveSettingsBtn" class="btn btn-amber">Save App Settings</button>
          </div>
          <div id="settingsStatus" class="status">Ready.</div>
        </article>

        <article class="panel" id="mods">
          <h2>Mod Workbench</h2>
          <p class="hint">Search, dependency-check, and install mods (recursive required deps).</p>
          <div class="row">
            <input id="searchQuery" style="flex:1" placeholder="Search mod by name" />
            <button id="searchBtn" class="btn btn-ghost">Search</button>
          </div>
          <div id="modsStatus" class="status">Ready.</div>
          <div id="searchResults" class="list"></div>
        </article>

        <article class="panel">
          <h2>Selected Mods</h2>
          <p class="hint">Published into lockfile items.</p>
          <div id="selectedMods" class="list"></div>
        </article>

        <article class="panel publish" id="publish">
          <h2>Publish Profile</h2>
          <p class="hint">Publishes next release with semantic versioning, simple FancyMenu controls, and optional full custom layout bundle.</p>
          <div class="fields">
            <label>FancyMenu Enabled
              <select id="fancyMenuEnabled">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>FancyMenu Mode
              <select id="fancyMenuMode">
                <option value="simple">simple</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>Play Button Label
              <input id="playButtonLabel" value="Play" />
            </label>
            <label>Hide Singleplayer
              <select id="hideSingleplayer">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>Hide Multiplayer
              <select id="hideMultiplayer">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>Hide Realms
              <select id="hideRealms">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>Custom Layout Bundle URL
              <input id="fancyMenuCustomLayoutUrl" placeholder="https://.../fancymenu-bundle.zip" readonly />
            </label>
            <label>Custom Layout Bundle SHA-256
              <input id="fancyMenuCustomLayoutSha256" placeholder="64-hex sha256" readonly />
            </label>
          </div>
          <div class="row">
            <button id="uploadFancyBundleBtn" class="btn btn-ghost">Upload FancyMenu Bundle (.zip)</button>
            <input id="fancyBundleFile" type="file" accept=".zip,application/zip" hidden />
          </div>
          <div class="row">
            <button id="publishBtn" class="btn btn-amber">Publish Next Version</button>
          </div>
          <div id="publishStatus" class="status">Ready.</div>
        </article>
      </section>
    </section>
  </main>

  <script src="/admin/app.js"></script>
</body>
</html>`;
}
