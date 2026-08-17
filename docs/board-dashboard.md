# Board dashboard

A read-only kanban dashboard (Vue 3 + Tailwind) showing each repo's status, fed
by the `board.json` that [`maggie-workspace` status tracking](workspace-cli.md#status-tracking)
writes. It lives in `apps/board/` with a zero-dependency Node server.

## Running it

`npm start` builds the front-end and then serves it:

```bash
npm start                                          # build + serve on http://localhost:4180
npm start -- --board /tmp/board.json               # a specific board file
AI_SYNC_BOARD=/tmp/board.json npm start            # board path via env
npm start -- --board /tmp/board.json --port 8080   # custom port
npm start -- --config repos.example.json           # also serve repo metadata
npm run board:build                                # build only, no server
```

### Flags

| Flag | Env | Default |
|---|---|---|
| `--board <path>` | `AI_SYNC_BOARD` | auto-detected, see below |
| `--config <path>` | `AI_SYNC_CONFIG` | none — degraded mode |
| `--port <n>` | — | `4180` |
| `--dist <path>` | — | the built front-end next to the server |

CI status adds five more flags — see [CI status](ci-status.md).

### Board path resolution

First match wins:

1. `--board <path>`
2. `AI_SYNC_BOARD`
3. auto-detected `wk/.maggie/board.json`
4. `board.json` in the current directory

So a plain `npm start` from the repo root picks up a live `wk/` workspace
automatically; `--board` / `AI_SYNC_BOARD` is only needed for a workspace
elsewhere. The startup log prints the resolved path (`board on … (data: …)`) —
check it first if the board looks empty.

If the chosen port is already in use the server falls back to the next free one
and prints where it settled, so avoid starting a second instance by accident.

## Endpoints

| Endpoint | Serves |
|---|---|
| `GET /api/board` | The raw `board.json`. Returns an empty board when the file does not exist. |
| `GET /api/config` | Repo metadata (url, technologies, targets) when started with `--config`. |
| `GET /api/ci` | Per-contributor CI status — see [CI status](ci-status.md). |
| anything else | The built front-end, with an SPA fallback to `index.html`. |

## `board.json`

```json
{
  "version": 1,
  "repos": {
    "example-api": {
      "status": "inprogress",
      "updatedAt": "2026-07-29T18:41:00.000Z",
      "lastEvent": "UserPromptSubmit",
      "events": [{ "event": "UserPromptSubmit", "at": "2026-07-29T18:41:00.000Z" }]
    }
  }
}
```

`status` is one of `todo`, `inprogress`, `question`, `done`. `events` is a
bounded per-repo history (last 20, newest first).

The version stays `1`: `events` is additive and legacy files are backfilled
transparently on read. The dashboard only reads the file — writers work whether
or not the server is running.

## What the UI does

- **Four columns**, one per status.
- **Browser notification** plus a tab-title badge whenever a repo moves into
  `question` (an agent is blocked on you) or `done`. An optional sound toggle is
  off by default and persisted in `localStorage`.
- **Summary header** with per-status counts and a done-progress bar.
- **Filter bar** narrowing by repo name, technology, or CI state.
- **Detail side panel** on click: repo URL, technology and target chips, CI
  breakdown per contributor, and the event timeline.

Without `--config` the board still runs, in a degraded mode with no repo links
and no technology filter.

## Hook reconciliation on start

When started with `--config`, the server re-verifies every configured repo's
Claude Code hooks and silently repoints any that drifted — a CLI path that moved,
or hooks writing to a different `board.json` than the one being served. Repos
with no checkout on disk are skipped; nothing is cloned and no dependencies are
installed. A short summary is logged.

This exists because both kinds of drift are invisible otherwise: the symptom is
a card that simply never moves.
