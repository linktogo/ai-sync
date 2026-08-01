# `ai-sync` CLI

Renders the [skills library](skills-library.md) into every configured repo and
pushes the result on a branch.

Examples call the CLI through its source entry (`node apps/sync/bin/sync.js`).
Once the package is installed the same commands are available as `ai-sync`.

## What a run does

For each repo in the [config](configuration.md):

1. Clone it into a temporary work dir (`--work-dir` to choose the parent).
2. Resolve the skills matching the repo's `technologies`.
3. Render each skill for each of the repo's `targets`.
4. Check out `ai-sync/update-skills`, write the files, commit, force-push.
5. Optionally open a PR with `gh` (`--pr`).

The branch is rewritten on every sync — it is a throwaway output branch, not a
place to commit by hand.

## Flags

| Flag | Meaning |
|---|---|
| `--config <path>` | Read the config from a local file. |
| `--config-repo <url>` | Read it from a git repository instead. |
| `--config-file <path>` | Path inside the config repo. Default `repos.json`. |
| `--repo <name>` | Restrict the run to one repo. |
| `--dry-run` | Print the files that would be written; no clone, no git. |
| `--strict` | Fail (non-zero exit) when a technology resolves to zero skills. |
| `--pr` | Open a pull request via the `gh` CLI after pushing. |
| `--work-dir <path>` | Parent directory for the temporary clones. |

`--config` and `--config-repo` are mutually exclusive and one is required — see
[Configuration](configuration.md).

## Examples

```bash
# Local config file
node apps/sync/bin/sync.js --config repos.example.json

# Shared config repo
node apps/sync/bin/sync.js --config-repo https://github.com/linktogo-org/lk-config.git

# Preview only — no clone, no git
node apps/sync/bin/sync.js --config-repo <url> --dry-run

# One repo, and open a PR
node apps/sync/bin/sync.js --config-repo <url> --repo example-api --pr

# CI guard: fail if a technology has no skills
node apps/sync/bin/sync.js --config-repo <url> --strict
```

## Exit behaviour

A repo that fails is recorded as `error` and the run continues to the next one;
the process exits non-zero at the end if any repo failed. Without `--strict`, a
technology with no skills is a warning and does not affect the exit code.
