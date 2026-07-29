# Board CI Status — Design

**Date:** 2026-07-29
**Status:** Approved (pending written-spec review)

## Purpose

The workspace board answers "what is Claude doing in each repo?" but says
nothing about whether the work actually passes CI. A repo can sit in `done`
with a red pipeline and the board looks identical to one that is green.

This feature puts each managed repo's latest CI outcome on its board card,
using a **push** model: every managed repo reports its own CI result via a
GitHub Action that commits an update file into this repository's `ci-status`
branch. The board server consumes those updates, folds them into a durable
local state file, and deletes them.

Push was chosen over the board polling the GitHub REST API. Polling N private
repos every few seconds burns the 5000 req/hr limit and requires the dashboard
to hold a token with read access to every managed repo. In the push model the
dashboard reads exactly one repository, and each managed repo holds a
credential scoped to writing one branch here.

## Decisions (locked during brainstorming)

- **Push, not poll.** No `api.github.com` calls from the board server. The
  server's only network dependency is `git fetch`/`git push` against this
  repository's `ci-status` branch.
- **Drop zone is an orphan branch `ci-status` of `linktogo/ai-sync`**, folder
  `updates/`, one file per run: `updates/<repo>-<runId>.json`. An orphan
  branch keeps CI-status commits out of the code history, and `ci.yml` only
  listens on `main`, so deposits never trigger this repo's CI. A separate
  `ai-sync-status` repository was considered and rejected: one more repo to
  create, authorize and clone, for isolation the orphan branch already gives.
- **Transport is git clone/commit/push**, not the GitHub Contents API. The
  retry cost this implies is paid once, in a shared composite action, rather
  than duplicated across N repo workflows.
- **The retry loop lives in a composite action hosted here**
  (`.github/actions/ci-status-report`), so managed repos embed ~4 lines and
  the logic is fixed in one place.
- **Both trigger styles are supported**, chosen per repo: a standalone
  `workflow_run: completed` workflow (non-intrusive, sees the whole
  workflow's real conclusion including `cancelled`), or a final
  `if: always()` step inside an existing CI job (no second run, but only sees
  that one job and reports nothing when the run is cancelled).
- **The action sends raw `status`/`conclusion`; the server normalizes.** The
  mapping to display states can then be corrected without redeploying every
  managed repo.
- **State is durable in `ci.json`.** Because updates are deleted on
  consumption they are messages, not state. Without a local store, a server
  restart would blank every badge.
- **Explicit per-repo state, never silent.** Unknown is a rendered state with
  a reason, so a misconfigured token is distinguishable from a repo that has
  no CI.
- **Not built:** a CI count tile in `SummaryHeader` (considered and dropped —
  the badge plus the filter already surface failures).

## Architecture overview

```text
managed repo, CI finishes
  │
  └─ .github/actions/ci-status-report (composite, hosted here)
        │  node report.js  →  buildUpdate(env, event)
        │  clone ci-status branch, write updates/<repo>-<runId>.json
        └─ fetch + rebase + push, 5 attempts with backoff
                    │
                    ▼
        linktogo/ai-sync @ ci-status : updates/*.json
                    │
  board server tick (default 60s, in-flight lock)
        │
        ├─ git fetch origin ci-status && git reset --hard origin/ci-status
        ├─ read updates/*.json → parseUpdate → mergeUpdates
        ├─ write wk/.ai-sync/ci.json   (atomic: temp + rename)   ← state first
        └─ git rm consumed && commit && push (non-force, retry)  ← delete after
                    │
        GET /api/ci ─┴─ reads ci.json only, never the network
                    │
        useCi.js (poll 30s) → App.vue → Column → Card (badge)
                                     → RepoDetail (block)
                                     → FilterBar (CI filter)
```

## Components

### `libs/ci-status` (new lib, `@ai-sync/ci-status`)

Same shape as `libs/git`: `package.json`, `project.json` with the
`node --test` 100% line/function/branch command, `src/ci-status.js`,
`test/ci-status.test.js`. Pure functions only — no I/O, no git, no network.

| Export | Signature | Behaviour |
|---|---|---|
| `buildUpdate` | `(env, event) → update` | Resolves the payload from **either** context. `env.GITHUB_EVENT_NAME === 'workflow_run'` → reads `event.workflow_run` (`conclusion`, `head_branch`, `html_url`, `run_started_at`, `id`, `name`, `event`, actor). Otherwise → reads the `github.*` context vars plus `JOB_STATUS`, and uses the current time for `startedAt`. Both branches emit the identical shape. |
| `normalizeState` | `(status, conclusion) → state` | `status !== 'completed'` → `running`. Else `success` → `success`; `failure`/`timed_out`/`startup_failure`/`action_required` → `failure`; `cancelled`/`skipped`/`neutral`/`stale` → `neutral`; anything unrecognised → `neutral`. |
| `parseUpdate` | `(raw) → {ok, update} \| {ok:false, reason}` | Parses and validates one update file. Rejects bad JSON, missing `repo`/`runId`/`status`, and wrong types. Never throws. |
| `mergeUpdates` | `(state, updates, now) → state` | Folds updates into the durable state, keyed by `repo`. An update whose `runId` is not newer than the stored one is ignored, which is what makes replay after a failed push a no-op. Returns a new object; does not mutate. |

### `.github/actions/ci-status-report/` (new composite action)

`action.yml` inputs: `token` (required), `status-repo` (default
`linktogo/ai-sync`), `branch` (default `ci-status`).

`report.js` is deliberately thin — it calls `buildUpdate`, writes the file,
and shells out for the git sequence. It imports `libs/ci-status` by relative
path (`../../../libs/ci-status/src/ci-status.js`) so the runner needs no
`npm install`; the lib has zero dependencies, and the import is version-locked
to whatever ref the action was referenced at.

Consumer usage, standalone workflow form:

```yaml
name: ai-sync status
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: linktogo/ai-sync/.github/actions/ci-status-report@main
        with:
          token: ${{ secrets.AI_SYNC_STATUS_TOKEN }}
```

In-job form: the same `uses:` block as a final step with `if: always()`.

### `apps/board` — server side

- `ciConsumer.js`: `createCiConsumer({ statusRepo, token, stateFile, exec, intervalMs, now })`
  exposing `tick()` (one fetch/merge/delete cycle) and `read()` (the current
  state for `/api/ci`, no I/O beyond reading `ci.json`). `exec` is injected
  exactly as `libs/git` does, so every path is testable without git or
  network.
- `server.js`: builds the consumer in `createBoardServer`, adds
  `if (url.pathname === '/api/ci') return await serveCi(...)`, and starts the
  interval. No git or parsing logic in the server itself.
- `libs/git`: `push()` currently runs `git push -f`. Force-pushing `ci-status`
  would destroy updates deposited between fetch and push. Add a
  `{ force = false }` option to `push(branch, opts)`; the existing caller in
  the sync pipeline passes `force: true` explicitly so its behaviour is
  unchanged.

### `apps/board` — client side

- `useCi.js`: polls `/api/ci` every 30s. Self-starting, `onUnmounted`
  cleanup, injectable `fetchImpl` — same contract as `useBoard.js`.
- `Card.vue`: a compact pill right of the repo name (the card stays two
  lines). `success` emerald dot, `failure` red dot on a pale red pill,
  `running` blue `animate-pulse` dot, `neutral` slate dot, `none` and
  `unavailable` a light grey dot with the reason in `title`.
- `Column.vue`: relays a `ci` prop down to `Card`. Its only change.
- `RepoDetail.vue`: an `Intégration continue` block before `Historique` —
  workflow name, branch, conclusion, actor, relative time, and a link to the
  run. Under `unavailable` the block renders the reason rather than
  disappearing. The relative time is what guards against a stale green: a
  three-day-old success stays green but is visibly dated.
- `FilterBar.vue`: a third `<select>` — `CI : tous / en échec / OK / inconnu`,
  applied in `App.vue` alongside the existing name and technology filters.
  Labels are French, matching the rest of the UI.

## Data contracts

Update file deposited by the action:

```json
{
  "repo": "lk-myasso",
  "runId": 42,
  "status": "completed",
  "conclusion": "failure",
  "workflow": "CI",
  "branch": "feat/x",
  "event": "push",
  "actor": "fabien",
  "url": "https://github.com/linktogo/lk-myasso/actions/runs/42",
  "startedAt": "2026-07-29T18:40:00.000Z",
  "sentAt": "2026-07-29T18:41:12.000Z"
}
```

Durable state, `wk/.ai-sync/ci.json` (beside `board.json`; overridable with
`--ci-state`):

```json
{
  "version": 1,
  "lastSyncAt": "2026-07-29T18:41:30.000Z",
  "lastSyncError": null,
  "repos": {
    "lk-myasso": { "runId": 42, "status": "completed", "conclusion": "failure",
                   "workflow": "CI", "branch": "feat/x", "event": "push",
                   "actor": "fabien", "url": "https://github.com/…",
                   "startedAt": "…", "receivedAt": "…" }
  }
}
```

`GET /api/ci` response — `state` is computed at read time by `normalizeState`:

```json
{
  "generatedAt": "2026-07-29T18:41:35.000Z",
  "lastSyncError": null,
  "repos": {
    "lk-myasso": { "state": "failure", "run": { "…": "as stored above" } },
    "lk-mind":   { "state": "none", "run": null }
  }
}
```

State resolution, in order:

1. **Consumer not configured** (no status repo or no token) — *every* entry is
   `{ state: "unavailable", reason: "status repo not configured", run: null }`.
   `unavailable` is a global condition, never per-repo: nothing in this design
   can fail for one repo and succeed for another.
2. **Configured, repo has no stored run** — `{ state: "none", run: null }`.
   This is the state of a repo that has never reported, e.g. one without the
   workflow installed yet.
3. **Configured, repo has a stored run** — `normalizeState(status, conclusion)`
   with the stored run attached.

A repo in `ci.json` but not on the board is not returned. A transient sync
failure does not change any repo's state; it only sets `lastSyncError`.

## Configuration

| Setting | Source (first wins) | Default |
|---|---|---|
| Status repo URL | `--status-repo`, `AI_SYNC_STATUS_REPO` | none — consumer disabled |
| Write token | `AI_SYNC_STATUS_TOKEN` | none — consumer disabled |
| Consumer interval | `--ci-interval <seconds>` | 60 |
| State file | `--ci-state <path>` | `<dirname(boardPath)>/ci.json` |

The token is injected into the clone URL as
`https://x-access-token:$TOKEN@github.com/…` and must never reach a log line
— including the existing `board on http://… (data: …)` startup message.

## Prerequisite

The orphan branch must exist before the first deposit:

```sh
git checkout --orphan ci-status
git rm -rf .
mkdir updates && touch updates/.gitkeep
git add -A && git commit -m "chore: seed ci-status drop branch"
git push -u origin ci-status
git checkout main
```

Until it exists the clone fails; that is treated as "no updates", logged once,
and does not crash the server. This goes in the README.

## Error handling

| Failure | Behaviour |
|---|---|
| Network or git unavailable | State unchanged. `/api/ci` keeps serving the last `ci.json` and sets `lastSyncError`; the UI shows a "désynchronisé" banner. |
| `ci-status` branch missing | Same as above, with an explicit reason. No crash, no retry storm. |
| Malformed update file | `parseUpdate` rejects it; the file is **deleted anyway** and the reason logged. Leaving it would make it a poison message reprocessed forever. |
| Push rejected after 5 attempts | Files stay; they are re-consumed next tick. `mergeUpdates` is idempotent, so replay has no effect. |
| Crash between state write and delete | State was written first, so the updates simply replay — again a no-op. |
| Slow tick | An in-flight lock prevents overlapping consumptions. |
| Token or status repo unset | No git command is run at all; every entry is `unavailable` with a reason. |

## Testing

- **`libs/ci-status`** — `node --test`, 100% line/function/branch gate.
  Table-driven cases for `normalizeState` covering every `conclusion` GitHub
  emits plus an unrecognised one; `buildUpdate` exercised on **both**
  contexts; `parseUpdate` against bad JSON, missing fields and wrong types;
  `mergeUpdates` for idempotence, newer-`runId`-wins and non-mutation.
- **`ciConsumer`** — injected `exec` and `fs`, so no real git and no network,
  including the push-conflict retry path, the missing-branch path and the
  poison-file path.
- **`server.js`** — `/api/ci` route added to `server.test.js` (`node --test`).
- **Vue** — Vitest for the badge per state, the detail block including the
  `unavailable` reason, the FilterBar option, `useCi` polling, and `App.vue`
  filtering.
- **`libs/git`** — a test pinning that `push()` defaults to non-force and that
  `force: true` still emits `-f`.

Known blind spot: the composite action itself does not run under test. That is
why `report.js` is kept to a call of `buildUpdate` plus file and git
plumbing — the logic that can be wrong lives in the covered lib.

## Out of scope

- Time-series or history of CI results — only the latest run per repo is kept.
- Re-running or cancelling workflows from the board. Read-only.
- Any drift-detection or `--check` work (tracked separately in the
  high-value-features research note).
