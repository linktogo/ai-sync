# @linktogo/maggie-workspace-bootstrap

Backs the `maggie-workspace` CLI from
[maggie](https://github.com/linktogo/maggie): clones the configured
repositories into a workspace, installs their dependencies cache-first, wires
Claude Code status hooks into each checkout, and maintains the shared
`board.json` kanban state.

```js
import { setSessionStatus } from '@linktogo/maggie-workspace-bootstrap';

await setSessionStatus('/ws/.maggie/board.json', 'example-api', 'sess-1', 'done');
```

Board states are `todo`, `inprogress`, `question`, and `done`. Each repo tracks
one entry per Claude Code session (keyed by `session_id`); writes are atomic
and keep a bounded per-session event history.

Each session also tracks `startedAt` (set once) and `usage` — an
`{ inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens }`
object recomputed from the session's transcript on every `Stop` event, kept
`null` until the first one. See `tokens.js` for the transcript-parsing and
`history.jsonl` helpers.
