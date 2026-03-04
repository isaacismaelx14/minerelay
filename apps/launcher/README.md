# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Launcher configuration (dev vs installed app)

For installed builds, do **not** rely on `.env` being present at runtime.

The launcher now resolves config in this order:

1. Process environment variables (useful for local dev/CI)
2. Runtime config file in app data: `launcher.runtime.json`
3. Build-time defaults compiled from env (`option_env!`)
4. Hardcoded defaults (for select fields like updater endpoint / server id)

### Runtime config file

Path:

- Development build: `${dataDir}/minecraft-server-syncer-dev/launcher.runtime.json`
- Release build: `${dataDir}/minecraft-server-syncer/launcher.runtime.json`

Use [launcher.runtime.example.json](launcher.runtime.example.json) as a template.

### `.env` usage

Use `.env` only for local development and build-time defaults. See [.env.example](.env.example).

Do not ship secrets in `.env` with the desktop bundle.

### GitHub Actions packaging inputs

For CI packaging (`launcher-build.yml` / `launcher-release.yml`), set these repository variables/secrets so build-time defaults are embedded consistently:

- Variables: `LAUNCHER_API_BASE_URL`, `LAUNCHER_PROFILE_LOCK_URL`, `LAUNCHER_SERVER_ID`, `LAUNCHER_UPDATE_ENDPOINT`
- Variables: `LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS` (optional, comma-separated hosts)
- Secrets: `LAUNCHER_UPDATE_PUBKEY`, `PROFILE_SIGNATURE_PUBLIC_KEY` (or variable), `LAUNCHER_INSTALL_CODE`

Security defaults:

- `DEVTOOLS_SECRET_COMMAND` is ignored in release builds (debug builds only).
- Packaging workflows intentionally do not inject `DEVTOOLS_SECRET_COMMAND`.
- Packaging workflows currently inject `LAUNCHER_INSTALL_CODE` because enrollment requires it in the existing backend flow.

Installed clients can still override with `launcher.runtime.json` at runtime.
