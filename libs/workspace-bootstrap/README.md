# @ai-sync/workspace-bootstrap

Backs the `ai-workspace` CLI from
[ai-sync](https://github.com/linktogo/ai-sync): clones the configured
repositories into a workspace, installs their dependencies cache-first, wires
Claude Code status hooks into each checkout, and maintains the shared
`board.json` kanban state.

```js
import { setStatus } from '@ai-sync/workspace-bootstrap';

await setStatus('/ws/.ai-sync/board.json', 'example-api', 'done');
```

Board states are `todo`, `inprogress`, `question`, and `done`. Writes are
atomic and keep a bounded per-repo event history.
