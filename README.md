# ai-sync

Tools to sync AI agent skills, practices, and workflows across repositories.

Skills are authored once under `skills/<techno>/<name>/SKILL.md` and translated
into each target platform's format (Claude Code, GitHub Copilot, Cursor, Windsurf).

## Usage

```bash
node bin/sync.js --config repos.json          # clone, generate, branch, commit, push
node bin/sync.js --config repos.json --pr      # also open a PR via gh
node bin/sync.js --config repos.json --dry-run # preview generated files, no git
node bin/sync.js --config repos.json --repo oc-be   # one repo only
```

## Tests

```bash
npm test   # runs all tests with a strict 100% coverage gate on src/
```
