# Contributing to ai-sync

Thanks for taking the time to contribute. This document covers how to get the
project running locally, what the test bar is, and how changes get merged.

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

Requirements: **Node.js >= 22** and **npm** (see below — npm is not optional here).

```bash
git clone https://github.com/linktogo/ai-sync.git
cd ai-sync
npm ci
npm test
```

The repo is an [Nx](https://nx.dev) monorepo using npm workspaces: applications
in `apps/`, shared libraries in `libs/`, the skills library in `skills/`. See
[Project layout](README.md#project-layout) for what each project does.

> **Keep `package-lock.json` as the only lockfile.** Nx detects the package
> manager from the lockfile; adding a `pnpm-lock.yaml` or `yarn.lock` breaks the
> project graph and the CI build.

## Running things locally

```bash
npm test            # nx run-many -t test — every lib/app, 100% coverage gate each (except board)
npm run test:board  # apps/board only: server (node:test) + front-end (vitest)
npm run lint        # nx run-many -t lint
npm run build       # nx run-many -t build
npm start           # build + serve the kanban dashboard
```

To exercise the CLIs against the sample config without touching any real repo:

```bash
node apps/sync/bin/sync.js --config repos.example.json --dry-run
node apps/workspace/bin/workspace.js --config repos.example.json --workspace /tmp/ws --dry-run
```

## Tests and the coverage gate

Every library and CLI app enforces a **100% coverage gate** (`apps/board` is
exempt). A patch that lowers coverage fails CI, so new code needs new tests.

This project is developed test-first: write the failing test, make it pass, then
refactor. If a change is genuinely untestable, say so in the pull request rather
than lowering the threshold.

Tests live next to the code they cover:

- `libs/*/test/*.test.js` and `apps/{sync,workspace}/test/*.test.js` — `node:test`
- `apps/board/src/*.test.js` — `vitest` + `@vue/test-utils`

## Adding a skill

Skills are the reason this project exists, and they are the easiest contribution
to make. Create `skills/<techno>/<name>/SKILL.md` with YAML frontmatter followed
by the guidance body:

```markdown
---
name: query-performance
description: Diagnose and fix slow Postgres queries.
globs: ["**/*.sql"]
---

Guidance body in Markdown…
```

- `<techno>` is matched against each repo's `technologies` list in the config.
- `name` and `description` are required; `globs` is optional.
- Keep guidance concrete and reviewable — a skill is read by an agent about to
  edit someone's production code.

Renderers translate the same source into each target format (Claude Code, GitHub
Copilot, Cursor, Windsurf); you do not need to write per-platform variants.

## Architecture boundaries

Nx enforces module boundaries by `scope:*` tags (see `eslint.config.js`). Import
another project only through its package entry (`@ai-sync/<name>`), never by a
deep relative path across project roots. `npm run lint` catches violations.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(renderers): add windsurf target
fix(config): reject a config with both --config and --config-repo
docs: document the board path resolution order
chore(ci): pin actions/checkout to v4
```

Scopes usually map to a project (`sync`, `workspace`, `board`, `config`, `git`,
`renderers`, `skill-sync`) or to `skills` / `ci` / `docs`.

## Pull requests

1. Branch off `main`.
2. Make the change with tests; keep the diff focused on one concern.
3. Run `npm run lint && npm test && npm run build` before pushing.
4. Open the pull request and fill in the template — what changed, why, and how
   you verified it.
5. CI (`nx run-many -t lint test build`) must be green before review.

For anything larger than a bug fix, open an issue first so the design can be
discussed before you invest in the implementation.

## Releasing

Six packages ship from this repository and are versioned **in lockstep**: the
CLI package `@linktogo/ai-sync` (the repo root) and the five `@ai-sync/*`
libraries under `libs/`. The libraries depend on each other by caret range
(`^0.1.0`), so a version that moves in one place must move everywhere.

1. Bump `version` in the root `package.json` and in all five `libs/*/package.json`
   to the same value.
2. Update the internal `@ai-sync/*` dependency ranges to match the new version
   (root `dependencies`, plus the `libs/*` and `apps/*` manifests).
3. Update `CHANGELOG.md`: move `Unreleased` entries under the new version, and
   add the comparison links at the bottom.
4. Run `npm install` so `package-lock.json` picks up the new versions, then
   `npm run lint && npm test && npm run build`.
5. Merge, then publish a GitHub Release tagged `vX.Y.Z`.

The release triggers `.github/workflows/publish.yml`, which refuses to publish
unless every publishable package already carries the tag's version, then pushes
the libraries first and the CLI package second (it depends on them).

To rehearse a release against a local registry:

```bash
npm run publish:verdaccio   # publishes the five libraries to http://localhost:4873
```

Check what a tarball would actually contain before releasing:

```bash
npm pack --dry-run                                # the CLI package
npm pack --dry-run --workspace @ai-sync/renderers # one library
```

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/linktogo/ai-sync/issues/new/choose).
For anything security-sensitive, do **not** open a public issue — follow
[SECURITY.md](SECURITY.md) instead.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE) that covers this project.
