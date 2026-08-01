# @ai-sync/skill-sync

Resolves which skills apply to a repository — by matching its `technologies`
against `skills/<techno>/` — and drives the
[ai-sync](https://github.com/linktogo/ai-sync) pipeline: clone, render, branch,
commit, push, and optionally open a pull request.

```js
import { run } from '@ai-sync/skill-sync';

const results = await run(config, { skillsDir: 'skills', dryRun: true, logger: console });
```

Pass `strict: true` to turn "this technology matched no skills" from a warning
into an error — useful in CI to catch a typo'd technology.
