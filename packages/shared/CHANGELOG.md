# Changelog

## [@minerelay/shared/v0.2.3](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fshared%2Fv0.2.3) (2026-03-10)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fshared%2Fv0.2.2...%40minerelay%2Fshared%2Fv0.2.3)

## Chores

- **core:** add commit message guidelines for repository ([e9ddbf6](https://github.com/isaacismaelx14/minerelay/commit/e9ddbf6d869fd4475b2da2477aee297b85b12f81))

## Refactoring

- **core:** improve file handling in check-staged-format and lint-staged scripts ([e9ddbf6](https://github.com/isaacismaelx14/minerelay/commit/e9ddbf6d869fd4475b2da2477aee297b85b12f81))

## CI

- **core:** disable incompatible react rules to stabilize CI ([449b956](https://github.com/isaacismaelx14/minerelay/commit/449b956c4b53363224136d1c537ddb276ee2a330))

## [@minerelay/shared/v0.2.2](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fshared%2Fv0.2.2) (2026-03-08)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fshared%2Fv0.2.1...%40minerelay%2Fshared%2Fv0.2.2)

## Chores

- **core:** sync workspace dependency lock updates ([78621ad](https://github.com/isaacismaelx14/minerelay/commit/78621ada49ad01e70505a7931ca3c3b8d539334e))
- **shared:** pin dependency versions ([7e7d9d6](https://github.com/isaacismaelx14/minerelay/commit/7e7d9d6639adb012e1649d6ed66af7113af02732))
- **core:** pin node and update prettier ignore ([92e695b](https://github.com/isaacismaelx14/minerelay/commit/92e695b00983d78479cd764bc3ab04c58109d0ac))

## [@minerelay/shared/v0.2.1](https://github.com/isaacismaelx14/minerelay/releases/tag/%40minerelay%2Fshared%2Fv0.2.1) (2026-03-07)

[Full Changelog](https://github.com/isaacismaelx14/minerelay/compare/%40minerelay%2Fshared%2Fv0.2.0...%40minerelay%2Fshared%2Fv0.2.1)

## Bug Fixes

- **core:** normalize release asset names in updater validation ([f3ddfb6](https://github.com/isaacismaelx14/minerelay/commit/f3ddfb6f5dc667082d625d1c4161e088659f34b4))

## [@minerelay/shared/v0.2.0](https://github.com/isaacismaelx14/minerelay/releases/tag/%40mss%2Fshared%2Fv0.2.0) (2026-03-05)

[Release Tag](https://github.com/isaacismaelx14/minerelay/releases/tag/%40mss%2Fshared%2Fv0.2.0)

## CI

- **core:** run builds and deploys only on release tags ([2b3dabd](https://github.com/isaacismaelx14/minerelay/commit/2b3dabdc08c77b7ef27f8da5baf7fda31cf1d256))
- **core:** log AI scope inference recovery and skip low-confidence commits ([af2a759](https://github.com/isaacismaelx14/minerelay/commit/af2a759c7685a35d4c71502be68b1f4329ba160a))
- **core:** add AI scope inference option for semantic release ([0a92607](https://github.com/isaacismaelx14/minerelay/commit/0a926076a3e84b070ae9e153c90a75cad2f9d446))
- **core:** add auto target support to semantic release tooling ([ac0c8c6](https://github.com/isaacismaelx14/minerelay/commit/ac0c8c6bea2f3fd7c7c567f5db95c87f49728502))
- **core:** normalize workflow_dispatch inputs and defaults for semantic release ([b38c97a](https://github.com/isaacismaelx14/minerelay/commit/b38c97af4efa3b762c8cfaf9cdea48040705a658))
- **core:** remove lint check from pre-push hook ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))

## Chores

- **core:** tighten lint/commit tooling and format shared schemas ([f7795e5](https://github.com/isaacismaelx14/minerelay/commit/f7795e57c9b7044736f8833236a61ce71b30546d))
  - chore(core): format shared package exports and zod schemas
  - chore(core): silence eslint ignored-file warnings in lint-staged
  - chore(core): wrap commit-msg validation output for readability

## Styles

- **core:** normalize markdown and workflow formatting ([7c7bd19](https://github.com/isaacismaelx14/minerelay/commit/7c7bd190cc7de5575bfe174b99daf8af849259b0))

## Bug Fixes

- **core:** batch AI scope inference requests and harden JSON parsing ([aecdba4](https://github.com/isaacismaelx14/minerelay/commit/aecdba4385cecbd0ad632908bf32b5bc1e1a453c))

## Features

- **core:** implement semantic release workflow ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))
- **core:** implement AI-generated release notes functionality ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))
- **core:** add scripts for checking staged files with Prettier and linting API files with ESLint ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))
- **core:** add support for parsing checklist and numbered body entries from squash commits ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))
- **shared:** Implement remote lock caching in AppState and enhance fetch_remote_lock logic ([283bb81](https://github.com/isaacismaelx14/minerelay/commit/283bb815e909ea2e43b312928a08d117904ff022))

## Tests

- **shared:** allow vitest to pass when no tests are present ([5befa8f](https://github.com/isaacismaelx14/minerelay/commit/5befa8f21a67d2a3005bbe661850246ba041620c))

## Documentation

- **shared:** add legal and contribution documentation including LICENSE, CODE_OF_CONDUCT, and CONTRIBUTING guidelines ([8a19558](https://github.com/isaacismaelx14/minerelay/commit/8a195585b68029af5a6763411cb034a4aa46eaf0))

## Refactoring

- **shared:** Refactor fancyMenu and lockJson types to use object instead of Prisma.InputJsonValue ([75e586c](https://github.com/isaacismaelx14/minerelay/commit/75e586ca4f0204b79cb8d490f6f124551da7ae94))
