# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is below `1.0.0`, minor releases may contain breaking changes.

## [Unreleased]

### Added

- Community and governance files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and this changelog.
- GitHub issue forms (bug, feature, skill proposal), a pull request template,
  a `CODEOWNERS` file, and a Dependabot configuration for npm and GitHub Actions.
- `ai-sync --skills <dir>` to point the CLI at a specific skills library.
- The board server (`apps/board`) now accepts `--config-repo`/`--config-file`
  (and `AI_SYNC_CONFIG_REPO`/`AI_SYNC_CONFIG_FILE`), matching `sync` and
  `workspace`, so it can serve `/api/config` straight from a shared config
  repo instead of a locally duplicated file.
- The five libraries are now published to npm as `@linktogo/ai-config`,
  `@linktogo/ai-git`, `@linktogo/ai-renderers`, `@linktogo/ai-skill-sync`, and
  `@linktogo/ai-workspace-bootstrap`, alongside the `@linktogo/ai-sync` CLI
  package — each with its own README, license, and metadata. All six release in
  lockstep on the same version. The applications under `apps/` stay private and
  keep their internal `@ai-sync/*` names.

### Fixed

- The published CLI package was unusable: `files` referenced paths that do not
  exist at the repository root, and no runtime dependencies were declared. It
  now ships `apps/sync`, `apps/workspace`, the bundled skills library, and real
  dependency ranges.
- `ai-sync` resolved its skills directory as `./skills` relative to the current
  directory, so a globally installed CLI found no skills at all. It now prefers
  a local `skills/` folder and falls back to the library bundled in the package.

### Changed

- Documentation and the `wk` script no longer hardcode the organization-private
  `lk-config` repository; `npm run wk` now runs against the bundled
  `repos.example.json`, and the docs use a placeholder config repo URL.
- Removed the local Verdaccio `publishConfig.registry` from the workspace
  libraries; the `publish:verdaccio` script passes `--registry` explicitly.
- Filled in the copyright line of the Apache-2.0 `LICENSE` appendix.

## [0.1.0]

Initial release.

### Added

- `ai-sync` CLI: resolve skills per repository from `skills/<techno>/<name>/SKILL.md`,
  render them for Claude Code, GitHub Copilot, Cursor, and Windsurf, then branch,
  commit, push, and optionally open a pull request.
- `--config` / `--config-repo` config sources, with `--config-file`, `--repo`,
  `--dry-run`, and a `--strict` guardrail that fails on a technology with no skills.
- `ai-workspace` CLI: clone the configured repositories into a workspace, install
  dependencies cache-first (npm/pnpm, Maven), support out-of-workspace checkouts
  via `path`, create git worktrees, and print the editor launch command.
- Kanban status tracking: Claude Code hooks per checkout writing to a shared
  `board.json`, plus a `status` subcommand to update it by hand.
- Board dashboard (Vue 3 + Tailwind) with a zero-dependency server, browser
  notifications, a summary header, filtering, and a repo detail panel.
- Starter skills library for NestJS, Postgres, Next.js, React, Angular, Vue, Nx,
  Firebase, and Cloudflare Workers.

[Unreleased]: https://github.com/linktogo/ai-sync/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/linktogo/ai-sync/releases/tag/v0.1.0
