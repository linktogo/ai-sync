# @linktogo/ai-workspace-bootstrap

Backs the `ai-workspace` CLI from
[ai-sync](https://github.com/linktogo/ai-sync): clones the configured
repositories into a workspace, installs their dependencies cache-first, wires
Claude Code status hooks into each checkout, and maintains the shared
`board.json` kanban state.

```js
import { setSessionStatus } from '@linktogo/ai-workspace-bootstrap';

await setSessionStatus('/ws/.ai-sync/board.json', 'example-api', 'sess-1', 'done');
```

Board states are `todo`, `inprogress`, `question`, and `done`. Each repo tracks
one entry per Claude Code session (keyed by `session_id`); writes are atomic
and keep a bounded per-session event history.
