# Contributing Guide

Thanks for helping improve this project.

## License model

This repository is `source-available` and not OSI open source.
Read `LICENSE.md` before contributing.

Public forks are permitted only for non-commercial collaboration and proposing
pull requests. Do not publish compiled binaries or releases from forks.

## Ground rules

- Follow `CODE_OF_CONDUCT.md`.
- Keep all code, comments, and docs in English.
- Open an issue before large architectural changes.
- Keep pull requests focused and small.

## Development setup

1. Install dependencies:

```bash
pnpm install
```

2. Start local infra:

```bash
docker compose up -d
```

3. Prepare env files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

4. Prepare API database:

```bash
pnpm --filter @mvl/api prisma:generate
pnpm --filter @mvl/api prisma:migrate
pnpm --filter @mvl/api prisma:seed
```

5. Run apps:

```bash
pnpm --filter @mvl/api dev
pnpm --filter @mvl/launcher tauri:dev
```

## Pull request checklist

- `pnpm --filter @mvl/api build`
- `pnpm --filter @mvl/launcher typecheck`
- Add tests for behavioral changes when feasible.
- Update docs when behavior, env vars, or workflows change.

## Contribution legal terms

By opening a pull request or submitting patches, you agree to `CLA.md`.
If you do not agree with `CLA.md`, do not submit contributions.
