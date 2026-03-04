# Minecraft Server Syncer + Instance Bootstrapper (Java Edition)

Desktop sync/bootstrap app for **Minecraft Java Edition only**.

This project does **not** implement Microsoft OAuth and does **not** replace a Minecraft launcher. It synchronizes a managed instance directory, ensures server-lock behavior, and opens an installed Java launcher.

## License and Legal

This repository is `source-available` and **not** OSI open source.

- License: see `LICENSE.md`
- Contribution terms: see `CLA.md` and `CONTRIBUTING.md`
- Community standards: see `CODE_OF_CONDUCT.md`
- Security reporting: see `SECURITY.md`
- Trademark usage: see `TRADEMARKS.md`
- Public forks are allowed only for non-commercial collaboration and pull
  request workflows; compiled redistribution is not allowed.

## Repository Layout

- `apps/launcher`: Tauri v2 + React + TypeScript desktop app
- `apps/api`: NestJS + Prisma + Postgres profile/version API
- `apps/fancymenu-sandbox`: isolated FancyMenu zip validation + preview sandbox
- `packages/shared`: shared lockfile/profile/update schemas
- `mods/server-lock`: Fabric 1.20.1 client mod (`Play` only -> direct connect)
- `infra/sample-data`: sample lockfile, metadata, and local artifact jar
- `infra/scripts`: profile publish/hash/release helper scripts

## Product Scope

- Target: **Minecraft Java Edition only**
- Launcher support focus:
  - Official Minecraft Launcher (Java)
  - Prism Launcher
  - MultiMC
- Mod/loader support:
  - MVP runtime path: Fabric 1.20.1
  - Forge extension points are structured for future addition

## Setup Wizard (First Run)

1. **Step 1**: Detecting Minecraft launcher (max 5s with progress)
2. **Step 2**:
   - `Setup manually`
   - `Log in with {appName} account` (disabled, badge `VERY SOON`)

If detection finds no launcher, wizard supports:
- manual executable/app selection (file picker)
- skip for now

## Core Behavior

- Sync engine:
  - fetches profile lockfile
  - computes add/remove/update/keep plan
  - downloads to staging, validates SHA-256, commits atomically
  - rollbacks on cancel/failure
  - updates `manifest.lock.json`
- Instance management:
  - dedicated instance directory by default
  - optional global `.minecraft` mode with explicit warning
- Server lock:
  - syncer writes `servers.dat`
  - syncer writes config at `config/mvl-syncer/server-lock.json`
  - Fabric server-lock mod enforces Play-only title screen and direct server connect

## Instance Structure

```
instances/<serverId>/
  minecraft_dir/
    mods/
    shaderpacks/
    resourcepacks/
    config/
      mvl-syncer/
        server-lock.json
    servers.dat
  manifest.lock.json
  logs/
```

## Lockfile

Sample file: `infra/sample-data/profile.lock.json`

Includes:
- `items` (mods, including server-lock mod)
- `resources`
- `shaders`
- `configs` (optional config templates)
- full SHA-256 integrity fields

Sample mod set includes:
- Fabric API
- Sodium
- Iris
- MVL Server Lock mod

## API Endpoints

- `GET /v1/profile`
- `GET /v1/servers/:serverId/profile`
- `GET /v1/servers/:serverId/updates?clientVersion=#`
- `GET /v1/locks/:profileId/:version`
- `GET /v1/artifacts/:key` (sample server-lock jar or nested asset key like `assets/<serverId>/...`)

Swagger docs: `/docs`

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start local infra (Postgres + FancyMenu sandbox):

```bash
docker compose up -d
```

3. Create env files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

4. Build shared package:

```bash
pnpm --filter @mvl/shared build
```

5. Prepare API DB:

```bash
pnpm --filter @mvl/api prisma:generate
pnpm --filter @mvl/api prisma:migrate
pnpm --filter @mvl/api prisma:seed
```

6. Run API:

```bash
pnpm --filter @mvl/api dev
```

7. Run desktop app:

```bash
pnpm --filter @mvl/launcher tauri:dev
```

## Packaged App Configuration

Packaged apps do not inherit your terminal env by default.
Configure profile source from the app sidebar:

- `API Base URL` (example: `http://localhost:3000`)
- or `Profile Lock URL` (direct lockfile)

Settings persist at:
- macOS: `~/Library/Application Support/minecraft-server-syncer/settings.json`
- Windows: `%LOCALAPPDATA%\minecraft-server-syncer\settings.json`

## Launcher Paths

### Prism Launcher (automated bootstrap)

When Prism is selected and you open launcher, the app creates/updates a Prism instance named:

`Release {appName}-{shortVersion} (MC {minecraftVersion} {loader})`

The generated Prism instance is linked to the managed `minecraft_dir`.

### Official Minecraft Launcher (fallback)

If automation is not feasible, app shows guidance:
1. open launcher
2. create installation for target MC + loader
3. set game directory to syncer `minecraft_dir`

## Build Installers

```bash
pnpm --filter @mvl/launcher tauri:build
```

Outputs:
- Windows: `.exe` (NSIS) and `.msi`
- macOS: `.dmg`

## Launcher Auto Updates (GitHub Releases)

The desktop launcher now checks GitHub release updates and can download + install them in-app (`Check App Updates` button).

Required runtime env:

- `LAUNCHER_UPDATE_ENDPOINT` (default: `https://github.com/isaacismaelx14/mc-client-center/releases/latest/download/latest.json`)
- `LAUNCHER_UPDATE_PUBKEY` (public key generated with `tauri signer generate`)

Required GitHub secrets for signed release builds:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (set this in CI; generate a password-protected key)
- `LAUNCHER_UPDATE_PUBKEY` (public key string from `.pub`; injected at build time so installed app can verify updates)

Tag-based release flow:

1. Bump launcher versions (`apps/launcher/package.json`, `apps/launcher/src-tauri/Cargo.toml`, `apps/launcher/src-tauri/tauri.conf.json`).
2. Push a tag like `v0.2.0`.
3. GitHub Actions workflow `launcher-release` builds Windows + macOS bundles, generates updater artifacts + `latest.json`, and publishes them to the tagged release.

## Build Fabric Mod

```bash
cd mods/server-lock
/opt/homebrew/opt/gradle@8/bin/gradle build --no-daemon
```

Jar output:

```
mods/server-lock/build/devlibs/server-lock-0.1.0.jar
```

## Profile Publishing

```bash
pnpm --filter @mvl/infra-scripts publish-profile
pnpm --filter @mvl/infra-scripts sha256 <file-path>
pnpm --filter @mvl/infra-scripts release-notes
```

## Troubleshooting

- `Profile source is not configured`: set API Base URL or Profile Lock URL in app settings.
- Prisma `DATABASE_URL` missing: ensure `apps/api/.env` exists.
- Hash mismatch: artifact changed or lockfile hash is stale.
- Launcher not detected: use manual picker, then save settings.
