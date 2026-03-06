# Changelog

## [@mss/launcher/v0.3.0](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Flauncher%2Fv0.3.0) (2026-03-06)

[Full Changelog](https://github.com/isaacismaelx14/minecraft-server-sync/compare/%40mss%2Flauncher%2Fv0.2.1...%40mss%2Flauncher%2Fv0.3.0)

## CI

- **launcher:** republish launcher assets to existing tag release ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** add workflow_dispatch tag input for rebuilding assets on an existing launcher tag release ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** add macOS signed-to-unsigned fallback so asset publishing is not blocked by Apple cert import failures ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** publish and verify updater artifacts against the resolved release tag ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## Features

- **launcher:** improve Windows launcher detection and launch targets ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** detect launchers from registry, filesystem fallbacks, and Windows Start app IDs ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** support launching Microsoft Store launcher targets and add detection-focused tests ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## Bug Fixes

- **launcher:** keep launcher selection aligned with detected options ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** resolve preferred launcher id from detected candidates, saved selection, and custom path ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** update setup wizard guidance for Microsoft Store launcher detection and manual fallback ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))
- **launcher:** trace updater failures with error codes ([3f8649d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/3f8649d0db7f068b210f7dcd5c294e677f2a60eb))

## [@mss/launcher/v0.2.1](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Flauncher%2Fv0.2.1) (2026-03-05)

[Full Changelog](https://github.com/isaacismaelx14/minecraft-server-sync/compare/%40mss%2Flauncher%2Fv0.2.0...%40mss%2Flauncher%2Fv0.2.1)

## CI

- **launcher:** split launcher release workflow into build and asset publish jobs ([31d0a67](https://github.com/isaacismaelx14/minecraft-server-sync/commit/31d0a67b57d130c58915502f00059050ca532e92))

## [@mss/launcher/v0.2.0](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Flauncher%2Fv0.2.0) (2026-03-05)

[Release Tag](https://github.com/isaacismaelx14/minecraft-server-sync/releases/tag/%40mss%2Flauncher%2Fv0.2.0)

## Chores

- **launcher:** run prettier across UI and config files ([f9a1f35](https://github.com/isaacismaelx14/minecraft-server-sync/commit/f9a1f35787d59586bae9381f69424efa2b0e8e6c))

## Tests

- **launcher:** allow vitest to pass when no tests are present ([5befa8f](https://github.com/isaacismaelx14/minecraft-server-sync/commit/5befa8f21a67d2a3005bbe661850246ba041620c))

## Bug Fixes

- **launcher:** remove Windows bundle renaming step from build workflow ([00d0900](https://github.com/isaacismaelx14/minecraft-server-sync/commit/00d09002c5ea46f83e1f62b7907a4d5c7a4b2f79))
- **launcher:** add trailing period to error message for missing LAUNCHER_UPDATE_PUBKEY secret ([e846862](https://github.com/isaacismaelx14/minecraft-server-sync/commit/e846862edc26e896f1aa17f3a422368baab6ed99))
- **launcher:** remove conditional check for server-lock mod build trigger ([a87c456](https://github.com/isaacismaelx14/minecraft-server-sync/commit/a87c45659a20edfe11a1d6bcc582c32fb3d4864e))
- **launcher:** remove trailing period from error message for missing TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret ([25d9def](https://github.com/isaacismaelx14/minecraft-server-sync/commit/25d9defbcefd05abec261ecbcd8aa1abc33a98c8))
- **launcher:** enhance macOS architecture inference and add tests for generic asset names ([7ce5ed3](https://github.com/isaacismaelx14/minecraft-server-sync/commit/7ce5ed3723736f16135aa870d3ae3ad935015cdb))
- **launcher:** remove trailing period from error message for missing LAUNCHER_UPDATE_PUBKEY secret ([d52235d](https://github.com/isaacismaelx14/minecraft-server-sync/commit/d52235d8ed89510e229513facf01c5841cc87b39))
- **launcher:** ignore standalone dashes in argument parsing for manifest generation and asset verification ([2bf7667](https://github.com/isaacismaelx14/minecraft-server-sync/commit/2bf7667091cf85a665e4c5638e4a4363962a6519))
- **launcher:** correct string escaping in LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS validation ([2d3abdf](https://github.com/isaacismaelx14/minecraft-server-sync/commit/2d3abdf372c58fff5bca5d7e7028edbc28a2460d))
- **launcher:** fix admin name sync and semver logic ([06d418e](https://github.com/isaacismaelx14/minecraft-server-sync/commit/06d418eb4f2b89215799b9f79c713b94decf5078))
- **launcher:** Fix tauri plugin init error ([6759db6](https://github.com/isaacismaelx14/minecraft-server-sync/commit/6759db67cee3f24c17b5a55fbc927a44b280f3c2))
- **launcher:** Fix mac quit modal and minimize ([f083d48](https://github.com/isaacismaelx14/minecraft-server-sync/commit/f083d48fc72d198938f2f37a6fc429dabc7bde6f))

## Features

- **launcher:** implement launcher security module with pairing claims and trusted devices ([9937db7](https://github.com/isaacismaelx14/minecraft-server-sync/commit/9937db763c1f6b1ad7b0283bcd9867e02c8a232c))
- **launcher:** add server control pairing functionality with pairing code support ([9937db7](https://github.com/isaacismaelx14/minecraft-server-sync/commit/9937db763c1f6b1ad7b0283bcd9867e02c8a232c))
- **launcher:** add support for LAUNCHER_SERVER_CONTROL_TRUSTED_HOSTS in environment configurations ([9937db7](https://github.com/isaacismaelx14/minecraft-server-sync/commit/9937db763c1f6b1ad7b0283bcd9867e02c8a232c))
- **launcher:** remove redundant validation for API_BASE_URL and PROFILE_LOCK_URL in launcher workflows ([ac64fb5](https://github.com/isaacismaelx14/minecraft-server-sync/commit/ac64fb5c72bc97adc127b9c8d9e681e55dcd5ec9))
- **launcher:** enhance launcher build and release workflows with API_BASE_URL and PROFILE_LOCK_URL variables ([42fdb0f](https://github.com/isaacismaelx14/minecraft-server-sync/commit/42fdb0f30d5135a3e21d12b8cba613903f5b7243))
- **launcher:** add devtools feature to tauri dependency in Cargo.toml ([12152ba](https://github.com/isaacismaelx14/minecraft-server-sync/commit/12152ba7cfdde1a927286b3bd814f20d59e12518))
- **launcher:** enhance launcher configuration and telemetry logging with devtools unlock feature ([0312473](https://github.com/isaacismaelx14/minecraft-server-sync/commit/0312473cd8276af45171751becbd850b947f7435))
- **launcher:** replace Python validation with Node.js for PROFILE_SIGNATURE_PUBLIC_KEY in launcher build process ([9969c81](https://github.com/isaacismaelx14/minecraft-server-sync/commit/9969c81dfe50a54ee01266fbbb8b5629d51b08b8))
- **launcher:** add validation for PROFILE_SIGNATURE_PUBLIC_KEY in launcher build process ([f94be59](https://github.com/isaacismaelx14/minecraft-server-sync/commit/f94be591b5270bcccc6899f73edcc7a30753c44d))
- **launcher:** update prisma integration logic and build process in Dockerfile ([bdc7c67](https://github.com/isaacismaelx14/minecraft-server-sync/commit/bdc7c67d5cedc5283ba79a0947a9405b5496dd39))
- **launcher:** add profile signature verification and related fields ([98ff0b5](https://github.com/isaacismaelx14/minecraft-server-sync/commit/98ff0b500ccaa28aff13cef8fb0216f25ab1bb35))
- **launcher:** add admin client and login components with authentication logic ([98ff0b5](https://github.com/isaacismaelx14/minecraft-server-sync/commit/98ff0b500ccaa28aff13cef8fb0216f25ab1bb35))
- **launcher:** add PROFILE_SIGNATURE_PUBLIC_KEY handling in launcher workflows ([98ff0b5](https://github.com/isaacismaelx14/minecraft-server-sync/commit/98ff0b500ccaa28aff13cef8fb0216f25ab1bb35))
- **launcher:** Add TLauncher detection and improve Windows process command handling ([d40fb7c](https://github.com/isaacismaelx14/minecraft-server-sync/commit/d40fb7cfbe6fde9dab4b77158fc073d88c3a7aee))
- **launcher:** Add beta version computation and stamping for launcher builds ([962e0c5](https://github.com/isaacismaelx14/minecraft-server-sync/commit/962e0c5f63f4c25d17b04b70496b596a62419c14))

## Refactoring

- **launcher:** refactor launcher configuration and enhance UI/UX ([7f90fde](https://github.com/isaacismaelx14/minecraft-server-sync/commit/7f90fdec929eaa2e80589bec1fac0a04d5f4621b))
- **launcher:** refactor fetch_profile_metadata to prioritize server-scoped metadata and improve error handling ([6a0877a](https://github.com/isaacismaelx14/minecraft-server-sync/commit/6a0877af9fcda59fda8967fcd9b3c2431b61051e))
- **launcher:** Enhance beta versioning logic and rename Windows bundles for consistency ([435b2fa](https://github.com/isaacismaelx14/minecraft-server-sync/commit/435b2faf151f54e6eed2b18e98147ec8f4073c9b))
- **launcher:** Redesign launcher UI to desktop feel ([eb62b94](https://github.com/isaacismaelx14/minecraft-server-sync/commit/eb62b9460bc3fbf6d2f358934889148f8ae95797))
