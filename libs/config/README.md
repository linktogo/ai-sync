# @ai-sync/config

Loads and validates the repository config for
[ai-sync](https://github.com/linktogo/ai-sync), from either a local JSON file or
a shared git repository (shallow-cloned into a temp dir and cleaned up after).

```js
import { resolveConfigSource } from '@ai-sync/config';

const config = await resolveConfigSource({ config: 'repos.json' });
// or: { configRepo: 'https://github.com/example-org/ai-config.git', configFile: 'repos.json' }
```

Exactly one of `config` / `configRepo` must be provided. Each repo entry needs
`name`, `url`, and a non-empty `technologies` array.
