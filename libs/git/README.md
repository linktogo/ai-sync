# @ai-sync/git

Thin wrapper around `git` and the GitHub `gh` CLI used by
[ai-sync](https://github.com/linktogo/ai-sync): clone, branch, commit, push, and
open pull requests. SSH and scp-style remotes are rewritten to HTTPS before
cloning.

```js
import { clone } from '@ai-sync/git';

await clone('https://github.com/example-org/example-api.git', '/tmp/checkout', { depth: 1 });
```
