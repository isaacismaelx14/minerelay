---
description: Load these instructions whenever the task involves writing, editing, or suggesting git commit messages for this repository.
# applyTo: '**/*' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

# Commit Message Instructions

These instructions are mandatory for AI-generated commits in this repository.

## Required Title Format

Use exactly:

`type(scope): short summary`

Optional breaking format:

`type(scope)!: short summary`

Rules:
- `type` must be lowercase
- `scope` is mandatory
- summary should be concise, imperative, and without trailing period

## Allowed Types

Only these are allowed:
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

## Allowed Scopes

Only these are allowed:
- `api`
- `launcher`
- `platform`
- `desktop`
- `shared`
- `core`

Do not use any other scope (for example: `release` is invalid).

## Breaking Changes

When introducing breaking behavior:
1. Use `!` in title
2. Include body line:
   `BREAKING CHANGE: <what changed and migration guidance>`

## Multi-change Commit Bodies

When needed, body bullet lines must also be conventional:
- `* feat(api): ...`
- `* fix(shared): ...`

## Examples

Valid:
- `ci(platform): update semantic release workflow inputs`
- `feat(api): expose package version at root endpoint`
- `fix(launcher): show app version in compact header`

Invalid:
- `feat: add release flow` (missing scope)
- `feat(release): add release flow` (scope not allowed)
- `Update workflow` (not conventional)

## Enforcement

Husky `commit-msg` validates these rules from `release.config.json`.
If commit is rejected, rewrite it to match this file.
