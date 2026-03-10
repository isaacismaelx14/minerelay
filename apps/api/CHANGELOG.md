# Changelog

## [@minerelay/api/v0.2.2](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fapi%2Fv0.2.2) (2026-03-10)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fapi%2Fv0.2.1...%40minerelay%2Fapi%2Fv0.2.2)

## Bug Fixes

- **api:** remove useless assignment lint violations ([5b9c1ca](https://github.com/isaacismaelx14/minerelay/commit/5b9c1ca4545c9dc4f47e3a9d08f28bc72dee8216))

## [@minerelay/api/v0.2.1](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fapi%2Fv0.2.1) (2026-03-08)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fapi%2Fv0.2.0...%40minerelay%2Fapi%2Fv0.2.1)

## Build

- **api:** target node 24 for builds ([3227898](https://github.com/isaacismaelx14/minerelay/commit/322789825f9f4e22b5e125da7c210bda143e4d7a))

## Bug Fixes

- **api:** migrate prisma 7 datasource and adapter ([34c3a36](https://github.com/isaacismaelx14/minerelay/commit/34c3a3666179a09c1fc8bb00fee2ce68e3aaa0da))

## [@minerelay/api/v0.2.0](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fapi%2Fv0.2.0) (2026-03-07)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fapi%2Fv0.1.1...%40minerelay%2Fapi%2Fv0.2.0)

## Features

- **api:** resolve lock URL from request origin or configured base URL ([9cbe6b7](https://github.com/isaacismaelx14/minerelay/commit/9cbe6b790e921c3fe8e9cbb6413967d1a8272822))

## Bug Fixes

- **api:** backfill stale lock URL hosts to canonical domain ([a1bad0f](https://github.com/isaacismaelx14/minerelay/commit/a1bad0f50215e332e7f6e3e44e950faa0e843eea))
- **api:** correct middleware next handler signature ([17fde01](https://github.com/isaacismaelx14/minerelay/commit/17fde018798c2ad9be80e23c2326215d5e57db53))
- **api:** use correct api production entrypoint ([8113fb3](https://github.com/isaacismaelx14/minerelay/commit/8113fb33d6fc642ffd25a6dffec4a15512b02a26))

## [@minerelay/api/v0.1.1](https://github.com/isaacismaelx14/minerelay/releases/tag/%40mss%2Fapi%2Fv0.1.1) (2026-03-06)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40mss%2Fapi%2Fv0.1.0-beta.32...%40mss%2Fapi%2Fv0.1.1)

## Bug Fixes

- **api:** handle database connectivity failures ([3f8649d](https://github.com/isaacismaelx14/minerelay/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **api:** preserve bootstrap data on redeploy ([3f8649d](https://github.com/isaacismaelx14/minerelay/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## Styles

- **api:** format prisma exception filter spec ([3f8649d](https://github.com/isaacismaelx14/minerelay/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## [@minerelay/api/v0.1.0-beta.32](https://github.com/isaacismaelx14/minerelay/releases/tag/%40mss%2Fapi%2Fv0.1.0-beta.32) (2026-03-05)

[Release Tag](https://github.com/isaacismaelx14/minerelay/releases/tag/%40mss%2Fapi%2Fv0.1.0-beta.32)

## Bug Fixes

- **api:** harden admin publish stream errors and websocket payload decoding ([1cab786](https://github.com/isaacismaelx14/minerelay/commit/1cab786af9abff0e6910452b1d56978e015418d7))
- **api:** update mvl-syncer version to 0.1.0-beta.31 ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))

## Styles

- **api:** apply formatting fixes across eslint and admin services ([358ab23](https://github.com/isaacismaelx14/minerelay/commit/358ab238b439bc2da7f5424e95433df849008aff))

## CI

- **api:** configure git identity for semantic release workflow ([c4cc292](https://github.com/isaacismaelx14/minerelay/commit/c4cc29291400ae0c97a0a62db8d956a5608becd7))

## Refactoring

- **api:** Refactor admin and profile services for improved readability and maintainability ([16735ce](https://github.com/isaacismaelx14/minerelay/commit/16735ce16f254254317df1ff5a479fe3134fe21a))
- **api:** Refactor fancyMenu and lockJson types to use object instead of Prisma.InputJsonValue ([75e586c](https://github.com/isaacismaelx14/minerelay/commit/75e586ca4f0204b79cb8d490f6f124551da7ae94))

## Features

- **api:** Implement remote lock caching in AppState and enhance fetch_remote_lock logic ([283bb81](https://github.com/isaacismaelx14/minerelay/commit/283bb815e909ea2e43b312928a08d117904ff022))
- **api:** Build authenticated server admin UI ([a3dd39f](https://github.com/isaacismaelx14/minerelay/commit/a3dd39f6ef25e1ecc65ecd4f4baf3d49f84db8ae))
- **api:** Add admin server settings UI ([5ed09b1](https://github.com/isaacismaelx14/minerelay/commit/5ed09b1d0aeee19247ff8528b727b4ba2d05aaf9))
