# Agent Commit Policy (mc-client-center)

This file defines how AI models must write commit messages in this repository.

## 1) Required Commit Format

Every commit title MUST follow this exact format:

`type(scope): short summary`

Optional breaking format:

`type(scope)!: short summary`

Rules:

- `type` is lowercase
- `scope` is required
- summary must be concise, imperative, and customer-neutral
- no trailing period in summary

## 2) Allowed Types

Use only one of:

- `feat`
- `fix`
- `perf`
- `refactor`
- `docs`
- `style`
- `chore`
- `build`
- `ci`
- `test`

## 3) Allowed Scopes

Use only one of:

- `api`
- `admin`
- `launcher`
- `platform`
- `desktop`
- `shared`
- `core`
- `release`

Scope mapping notes:

- `platform` and `desktop` map to launcher release target
- `core` maps to shared release target
- `release` is reserved for release automation commits

## 4) Breaking Changes

If a commit introduces a breaking change:

- use `!` in title, and
- include `BREAKING CHANGE: <what changed and migration guidance>` in body

Example:

- `feat(api)!: replace session token format`
- body line: `BREAKING CHANGE: tokens issued before v0.2.0 are invalid; users must re-authenticate`

## 5) Multi-change / Squash Commit Body

When a commit contains multiple meaningful changes, body lines MUST use conventional bullets:

- `* feat(api): ...`
- `* fix(shared): ...`

Do not add non-conventional bullets if the commit is expected to be used by release tooling.

## 6) Release and Customer-facing Safety

Do NOT include internal-sensitive wording in titles or body:

- internal ticket IDs
- private infrastructure names
- secrets/credentials
- vulnerability exploit details

Prefer user-impact wording for release-facing commits.

## 7) Good Examples

- `feat(api): expose base service metadata endpoint`
- `fix(launcher): show app version in compact header`
- `chore(shared): normalize package version to 0.1.0-beta.31`
- `ci(platform): trigger launcher build after shared tag release`
- `chore(release): @minerelay/api/v0.1.0-beta.32`

## 8) Bad Examples (invalid)

- `feat: add endpoint` (missing scope)
- `Update things` (non-conventional)
- `fix(API): ...` (scope case mismatch)
- `feat(unknown): ...` (unsupported scope)

## 9) Pre-commit Gate

This repository enforces commit titles via Husky `commit-msg` hook using `release.config.json`.
If commit formatting fails locally, rewrite the commit message to comply with this file.
