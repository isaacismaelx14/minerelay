export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MVL Lockfile Admin</title>
  <style>
    :root {
      --ink: #13252a;
      --muted: #5c6c73;
      --panel: #fffdfa;
      --line: #d9d6cb;
      --accent: #0f8b73;
      --accent-ink: #ffffff;
      --danger: #b84e4e;
      --bg-a: #f4f2eb;
      --bg-b: #efede4;
      --shadow: 0 16px 34px rgba(15, 36, 38, 0.13);
      --radius: 16px;
      --radius-sm: 10px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(800px 500px at -10% 0%, #8db9ab57 0%, transparent 76%),
        radial-gradient(700px 500px at 110% 100%, #d8bf9955 0%, transparent 70%),
        linear-gradient(140deg, var(--bg-a) 0%, var(--bg-b) 100%);
    }

    .shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 20px;
      display: grid;
      gap: 16px;
    }

    .hero {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero h1 {
      margin: 0;
      font-family: "Sora", "Avenir Next", sans-serif;
      font-size: clamp(1.3rem, 2.4vw, 1.85rem);
    }

    .hero p {
      margin: 6px 0 0;
      color: var(--muted);
      max-width: 720px;
    }

    .badge {
      border: 1px solid #c7d5cf;
      border-radius: 999px;
      background: #ecf6f3;
      padding: 7px 11px;
      font-weight: 600;
      font-size: 0.82rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 16px;
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .card h2 {
      margin: 0;
      font-family: "Sora", "Avenir Next", sans-serif;
      font-size: 1.03rem;
    }

    .small {
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
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
      color: var(--muted);
      font-size: 0.84rem;
    }

    input,
    textarea {
      border: 1px solid #cad8d3;
      border-radius: var(--radius-sm);
      background: #ffffff;
      color: var(--ink);
      font: inherit;
      padding: 10px 11px;
    }

    textarea {
      min-height: 240px;
      resize: vertical;
      font-family: "IBM Plex Mono", monospace;
      font-size: 0.82rem;
      line-height: 1.44;
    }

    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    button {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 10px 14px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary {
      color: var(--accent-ink);
      background: linear-gradient(160deg, var(--accent) 0%, #0c6e5b 100%);
      box-shadow: 0 8px 18px rgba(15, 139, 115, 0.28);
    }

    .btn-ghost {
      background: #ffffff;
      border-color: var(--line);
      color: var(--ink);
    }

    .btn-danger {
      background: #fff3f3;
      border-color: #eabdbd;
      color: var(--danger);
    }

    .status {
      border: 1px solid #ccd8d3;
      border-radius: 10px;
      padding: 8px 10px;
      min-height: 38px;
      display: flex;
      align-items: center;
      background: #f2f8f6;
      color: #294d47;
      font-size: 0.84rem;
    }

    .results,
    .mods {
      display: grid;
      gap: 8px;
      max-height: 330px;
      overflow: auto;
      padding-right: 2px;
    }

    .result-item,
    .mod-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #ffffff;
      padding: 10px;
      display: grid;
      gap: 7px;
    }

    .result-title {
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .muted {
      color: var(--muted);
      font-size: 0.82rem;
      word-break: break-word;
    }

    code {
      font-family: "IBM Plex Mono", monospace;
      font-size: 0.85em;
    }

    @media (max-width: 980px) {
      .grid { grid-template-columns: 1fr; }
      .fields { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <h1>MVL Lockfile Builder</h1>
        <p>MVP admin page to generate profile JSON using server info, Minecraft + Fabric versions, and selected mods from Modrinth.</p>
      </div>
      <div class="badge">Fabric-only MVP</div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>1) Server + Runtime</h2>
        <p class="small">Required fields. Non-critical fields stay mocked for now.</p>
        <div class="fields">
          <label>Profile ID
            <input id="profileId" value="mvl-main" />
          </label>
          <label>Profile Version
            <input id="profileVersion" type="number" min="1" value="1" />
          </label>
          <label>Server Name
            <input id="serverName" value="My Server" />
          </label>
          <label>Server Address
            <input id="serverAddress" value="play.example.com:25565" />
          </label>
          <label>Minecraft Version
            <input id="minecraftVersion" value="1.20.1" />
          </label>
          <label>Fabric Loader Version
            <input id="loaderVersion" value="0.16.14" />
          </label>
        </div>
      </article>

      <article class="card">
        <h2>2) FancyMenu Settings</h2>
        <p class="small">Server-controlled menu policy. This is written to <code>lockJson.fancyMenu</code>.</p>
        <div class="fields">
          <label>Enable FancyMenu
            <input id="includeFancyMenu" type="checkbox" checked />
          </label>
          <label>Play Button Label
            <input id="playButtonLabel" value="Play" />
          </label>
          <label>Menu Title (optional)
            <input id="titleText" placeholder="Server title on main menu" />
          </label>
          <label>Menu Subtitle (optional)
            <input id="subtitleText" placeholder="Short subtitle text" />
          </label>
          <label>Logo URL (optional)
            <input id="logoUrl" placeholder="https://.../logo.png" />
          </label>
          <label>Hide Singleplayer
            <input id="hideSingleplayer" type="checkbox" checked />
          </label>
          <label>Hide Multiplayer
            <input id="hideMultiplayer" type="checkbox" checked />
          </label>
          <label>Hide Realms
            <input id="hideRealms" type="checkbox" checked />
          </label>
          <label>FancyMenu Config URL (optional)
            <input id="fancyMenuConfigUrl" placeholder="https://.../fancymenu-config.zip" />
          </label>
          <label>FancyMenu Config SHA-256 (optional)
            <input id="fancyMenuConfigSha256" placeholder="64-hex sha256" />
          </label>
          <label>FancyMenu Assets URL (optional)
            <input id="fancyMenuAssetsUrl" placeholder="https://.../fancymenu-assets.zip" />
          </label>
          <label>FancyMenu Assets SHA-256 (optional)
            <input id="fancyMenuAssetsSha256" placeholder="64-hex sha256" />
          </label>
        </div>
      </article>

      <article class="card">
        <h2>3) Search and Add Mods</h2>
        <p class="small">Search Modrinth and add the latest compatible Fabric file with SHA-256.</p>
        <div class="row">
          <input id="searchQuery" style="flex: 1" placeholder="Search mods (e.g. Sodium)" />
          <button id="searchBtn" class="btn-ghost">Search</button>
        </div>
        <div id="status" class="status">Ready.</div>
        <div id="results" class="results"></div>
      </article>

      <article class="card">
        <h2>4) Selected Mods</h2>
        <p class="small">This list maps directly to lockfile <code>items</code>.</p>
        <div id="mods" class="mods"></div>
      </article>

      <article class="card">
        <h2>5) Generate / Load JSON</h2>
        <p class="small">Generates valid lockfile JSON from the selected inputs.</p>
        <div class="row">
          <button id="generateBtn" class="btn-primary">Generate Lockfile JSON</button>
          <button id="downloadBtn" class="btn-ghost">Download</button>
          <button id="copyBtn" class="btn-ghost">Copy</button>
        </div>
        <div class="row">
          <button id="importPasteBtn" class="btn-ghost">Load From Pasted JSON</button>
          <button id="importFileBtn" class="btn-ghost">Load From JSON File</button>
          <input id="importFileInput" type="file" accept="application/json,.json" style="display:none" />
        </div>
        <textarea id="output" placeholder="Generated JSON appears here"></textarea>
      </article>
    </section>
  </main>

  <script src="/admin/app.js"></script>
</body>
</html>`;
}
