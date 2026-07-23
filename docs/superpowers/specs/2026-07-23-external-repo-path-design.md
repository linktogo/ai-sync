# External Repo Path — Design

**Date:** 2026-07-23
**Status:** Approved (pending written-spec review)

## Purpose

Today, `ai-workspace bootstrap` only tracks a repo (status board + hooks + install)
if it clones it into the managed `--workspace` folder (`wk/`). In practice, repos
the user actively works on (e.g. `lk-mind`, `oc-be`) already exist as checkouts
elsewhere on disk (e.g. `~/workspace/linktogo-org/lk-mind`), outside of `wk/`. Those
repos currently never appear on the board because they're never bootstrapped.

This feature lets `repos.json` point a repo at its existing external checkout, so
bootstrap wires up hooks/install/board-tracking there instead of forcing a fresh
clone under `wk/`.

## Decisions (locked during brainstorming)

- **Location is specified explicitly**: an optional `path` field per repo in
  `repos.json`, not auto-detection by convention. Explicit and unambiguous.
- **Missing path still gets cloned**: if `path` doesn't exist yet, `bootstrap`
  clones the repo straight into that path (creating parent directories as
  needed) rather than erroring.
- **`sync` (skill-push PRs) is unaffected** — it already clones into its own
  temporary `workDir` regardless of `path`; the field is only consumed by
  `workspace-bootstrap`.
- **One shared board regardless of location** — hooks installed into an
  external checkout still report into the same `<workspaceDir>/.ai-sync/board.json`
  as `wk/`-cloned repos. There is one board per `--workspace` invocation, mixing
  local and external repos.

## Architecture overview

```
repos.json
  { name: "lk-mind", url: …, path: "/Users/fabien/workspace/linktogo-org/lk-mind", … }
  { name: "oc-fe",   url: …,  /* no path */ … }
        │
        ▼
ai-workspace bootstrap --config repos.json --workspace wk
        │
        ├─ lk-mind → checkout = repo.path (clone-if-missing, else reuse in place)
        └─ oc-fe   → checkout = wk/oc-fe   (today's behavior, unchanged)
        │
        ▼  (identical downstream handling for both)
   installHooks(checkout, name, boardPath) + dependency install
        │
        ▼
   wk/.ai-sync/board.json  ← both lk-mind and oc-fe report here
```

## Section 1 — Config schema (`libs/config/src/config.js`)

- `normalizeRepo` accepts an optional `path` (string, not validated beyond
  type — same posture as `technologies`/`targets`, no existence check at parse
  time since the repo may not be cloned yet).
- Passed through untouched on the normalized repo object: `{ name, url,
  technologies, targets, path }` (`path` omitted/`undefined` when absent).
- No change to `defaultTargets` or target validation.

```json
{
  "name": "lk-mind",
  "url": "https://github.com/linktogo-org/lk-mind.git",
  "path": "/Users/fabien/workspace/linktogo-org/lk-mind",
  "technologies": ["nestjs", "postgres"],
  "targets": ["claude"]
}
```

## Section 2 — Bootstrap changes (`libs/workspace-bootstrap/src/bootstrap.js`)

Single-point change to how the initial `checkout` path is computed:

```js
let checkout = repo.path
  ? path.resolve(repo.path)
  : path.join(workspaceDir, repo.name);
```

Everything downstream is already location-agnostic and needs no further change:

- **Exists-check / reuse branching** — `exists(checkout)` and the
  reuse/reinstall/timestamp logic operate the same regardless of whether
  `checkout` is under `wk/` or external. A pre-existing external checkout is
  **reused** by default, exactly like a pre-existing `wk/` one.
- **Clone-if-missing** — if the external path doesn't exist, `clone(repo.url,
  checkout)` clones straight into it (Node's `git clone <url> <dest>` creates
  missing parent directories), same call as today's in-`wk/` clone.
- **Worktree placement** — `path.join(workspaceDir, ...)` becomes
  `path.join(path.dirname(checkout), ...)`. This is a **no-op for existing
  `wk/`-based repos** (`dirname(wk/name) === wk`) but correctly places a
  `--worktree` checkout beside an external repo instead of inside `wk/`.
- **Reinstall/timestamp re-clone placement** — same `dirname(checkout)`
  treatment applies to the interactive "existing checkout, re-clone
  elsewhere" branch (`onExisting` returning `reinstall`/`timestamp`), not
  just worktrees. Without this, choosing "reinstall" on a `path`-based repo
  would silently re-clone it into `workspaceDir` instead of beside its real
  location — the same no-op-for-`wk/` reasoning as worktree placement
  applies. Added during implementation (Task 2) for consistency; noted here
  after the fact.
- **Hook install** — `installHooks(checkout, repo.name, boardPath, …)` writes
  `.claude/settings.local.json` at `checkout`, wherever it is, pointing hook
  commands at the one shared `boardPath`.
- **Dependency install** — `planInstall`/`exec` run in `checkout` unchanged.
- **Board registration** — `initRepos(boardPath, names)` only ever stored
  repos by `name`; it doesn't know or care about paths, so no change needed.

## Section 3 — Docs (`README.md`)

- Config table: document the new optional `path` field ("point at an existing
  local checkout instead of cloning into the workspace folder").
- "Status tracking" section: clarify that external (`path`-based) repos are
  tracked exactly like `wk/`-cloned ones, and that the board still lives under
  the `--workspace` dir regardless of where individual repos live.

## Section 4 — Testing

- **`libs/config`**: `parseConfig`/`normalizeRepo` — optional `path` accepted
  and passed through; absent `path` leaves the normalized repo unchanged
  (regression check).
- **`libs/workspace-bootstrap`**:
  - `path` pointing at an existing directory → reused in place, no clone
    call, hooks/install run there.
  - `path` pointing at a missing directory → cloned directly into `path`
    (assert the `clone` fake receives `(url, resolvedPath)`), parent dirs
    implied by the clone call itself.
  - `--worktree` combined with a `path` repo → worktree created beside
    `path` (`dirname(path)`), not inside `workspaceDir`.
  - Regression: existing `wk/`-only scenarios (no `path` field) behave
    byte-for-byte as before.

## Out of scope (YAGNI)

- Auto-detection of external paths by convention (org-derived sibling dirs) —
  explicit `path` only, per the locked decision.
- Surfacing the resolved path in the board UI/detail panel — not requested;
  the board only ever needed `name`.
- Validating `path` at config-parse time (e.g. rejecting a `path` that isn't
  a git repo) — `bootstrap` already handles a missing/invalid directory via
  its existing exists-check + clone path.
