# Changelog

## [@mss/api/v0.1.1](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Fapi%2Fv0.1.1) (2026-03-06)

[Full Changelog](https://github.com/isaacismaelx14/minecraft-server-sync/compare/%40mss%2Fapi%2Fv0.1.0-beta.32...%40mss%2Fapi%2Fv0.1.1)

## Bug Fixes

- **api:** handle database connectivity failures ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **api:** preserve bootstrap data on redeploy ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## Styles

- **api:** format prisma exception filter spec ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## [@mss/api/v0.1.0-beta.32](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Fapi%2Fv0.1.0-beta.32) (2026-03-05)

[Release Tag](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Fapi%2Fv0.1.0-beta.32)

## Bug Fixes

- **api:** harden admin publish stream errors and websocket payload decoding ([1cab786](https://github.com/isaacismaelx14/minecraft-server-sync/commit/1cab786af9abff0e6910452b1d56978e015418d7))
- **api:** update mvl-syncer version to 0.1.0-beta.31 ([5befa8f](https://github.com/isaacismaelx14/minecraft-server-sync/commit/5befa8f21a67d2a3005bbe661850246ba041620c))

## Styles

- **api:** apply formatting fixes across eslint and admin services ([358ab23](https://github.com/isaacismaelx14/minecraft-server-sync/commit/358ab238b439bc2da7f5424e95433df849008aff))

## CI

- **api:** configure git identity for semantic release workflow ([c4cc292](https://github.com/isaacismaelx14/minecraft-server-sync/commit/c4cc29291400ae0c97a0a62db8d956a5608becd7))

## Refactoring

- **api:** Refactor admin and profile services for improved readability and maintainability ([16735ce](https://github.com/isaacismaelx14/minecraft-server-sync/commit/16735ce16f254254317df1ff5a479fe3134fe21a))
- **api:** Refactor fancyMenu and lockJson types to use object instead of Prisma.InputJsonValue ([75e586c](https://github.com/isaacismaelx14/minecraft-server-sync/commit/75e586ca4f0204b79cb8d490f6f124551da7ae94))

## Features

- **api:** Implement remote lock caching in AppState and enhance fetch_remote_lock logic ([283bb81](https://github.com/isaacismaelx14/minecraft-server-sync/commit/283bb815e909ea2e43b312928a08d117904ff022))
- **api:** Build authenticated server admin UI ([a3dd39f](https://github.com/isaacismaelx14/minecraft-server-sync/commit/a3dd39f6ef25e1ecc65ecd4f4baf3d49f84db8ae))
- **api:** Add admin server settings UI ([5ed09b1](https://github.com/isaacismaelx14/minecraft-server-sync/commit/5ed09b1d0aeee19247ff8528b727b4ba2d05aaf9))
