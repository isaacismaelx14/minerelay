# Changelog

All notable changes to this package will be documented in this file.

## [@minerelay/admin/v0.2.0](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fadmin%2Fv0.2.0) (2026-03-12)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fadmin%2Fv0.1.4...%40minerelay%2Fadmin%2Fv0.2.0)

## Features

- **admin:** add onboarding flow and exaroton setup fixes ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))
- **admin:** add onboarding wizard route with version, identity, and completion steps ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))

## Bug Fixes

- **admin:** keep Exaroton integration selectable and show backend setup errors clearly ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))
- **admin:** shim localStorage in vitest setup ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))
- **admin:** avoid login loop on bootstrap failures ([e1ca707](https://github.com/isaacismaelx14/minerelay/commit/e1ca707cdf0af081da5e8a14e25d208515447b47))
- **admin:** build deploy image from workspace root ([e7bab97](https://github.com/isaacismaelx14/minerelay/commit/e7bab97df31e1e4ced35490c3e903fc4d1a89a08))
- **admin:** resolve ui css imports in build ([82cb92b](https://github.com/isaacismaelx14/minerelay/commit/82cb92bd7eaf0d7f1bf7562efb1c0f2ead6979db))
- **admin:** run admin tests before release builds ([5f84581](https://github.com/isaacismaelx14/minerelay/commit/5f8458119383ce9823550332de6490429c05ea55))

## Refactoring

- **admin:** update bootstrap and status handling for onboarding and integration flows ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))

## Styles

- **admin:** normalize admin layout formatting ([28582f6](https://github.com/isaacismaelx14/minerelay/commit/28582f61f7127bb720761c21613fc736b01c8c2a))

## [@minerelay/admin/v0.1.4](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fadmin%2Fv0.1.4) (2026-03-10)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fadmin%2Fv0.1.3...%40minerelay%2Fadmin%2Fv0.1.4)

## Refactoring

- **admin:** migrate admin views to shared ui components ([e9ddbf6](https://github.com/isaacismaelx14/minerelay/commit/e9ddbf6d869fd4475b2da2477aee297b85b12f81))

## [@minerelay/admin/v0.1.3](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fadmin%2Fv0.1.3) (2026-03-08)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fadmin%2Fv0.1.2...%40minerelay%2Fadmin%2Fv0.1.3)

## Bug Fixes

- **admin:** redirect unauthenticated users in server layout ([bda2a00](https://github.com/isaacismaelx14/minerelay/commit/bda2a0079a92db6fe1ce032f25e9081a18b72215))
- **admin:** keep exaroton stream active across views ([bb4c4f5](https://github.com/isaacismaelx14/minerelay/commit/bb4c4f574298375f30c2d29748be57696bf725db))

## Build

- **admin:** target node 24 for builds ([b8fd2f5](https://github.com/isaacismaelx14/minerelay/commit/b8fd2f5817ee526047b885c988afb98567afd7c0))

## Chores

- **admin:** pin dependency versions ([f1f3d0b](https://github.com/isaacismaelx14/minerelay/commit/f1f3d0bf7aca6339851211551589143b4af62e7a))

## [@minerelay/admin/v0.1.2](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fadmin%2Fv0.1.2) (2026-03-07)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fadmin%2Fv0.1.1...%40minerelay%2Fadmin%2Fv0.1.2)

## Bug Fixes

- **admin:** default launcher pairing API origin and preserve new active claims ([a441a0a](https://github.com/isaacismaelx14/minerelay/commit/a441a0a7934ddc2b36816573f25cef3a33bf2c9a))

## [@minerelay/admin/v0.1.1](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fadmin%2Fv0.1.1) (2026-03-07)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fadmin%2Fv0.1.0...%40minerelay%2Fadmin%2Fv0.1.1)

## Bug Fixes

- **admin:** remove brittle server login cookie gate ([efe134d](https://github.com/isaacismaelx14/minerelay/commit/efe134ddf911c2f436a04e75c5049e7b37620f49))
- **admin:** redirect unauthenticated users to login ([1d5b205](https://github.com/isaacismaelx14/minerelay/commit/1d5b2050461bc906cd9dff623d5a9d27599daec4))
- **admin:** use runtime api origin for browser requests ([6ec4337](https://github.com/isaacismaelx14/minerelay/commit/6ec433703c495edbedc04bdbdcc707499ec9eca4))
- **admin:** avoid SSR crash when bootstrap fetch fails ([90dbc4c](https://github.com/isaacismaelx14/minerelay/commit/90dbc4c20354683be7fe09cb0250935fceb56c55))
