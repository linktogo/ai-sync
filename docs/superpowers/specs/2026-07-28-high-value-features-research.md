# High-Value Features — Research

**Date:** 2026-07-28
**Status:** Research (pre-brainstorming — no implementation decisions locked)

## Purpose

Five candidate features were proposed for `ai-sync`. This document records the
research behind each one: what the current code already gives us, what actually
has to change, where the hidden architectural cost sits, and how the five relate
to each other. It is deliberately a *research* note, not a plan — each feature
that gets picked up should still go through `brainstorming` → `writing-plans`.

Current state this is written against: commit `8ba12ea`, four render targets
(`claude`, `copilot`, `cursor`, `windsurf`), Nx workspace, per-library 100%
line/function/branch coverage gate via `node --test`.

---

## Feature 1 — `--check` / drift detection

**Verdict: build this first. It is the keystone for features 3 and 5.**

### What already exists

`syncRepo` (`libs/skill-sync/src/pipeline.js:46`) already separates cleanly into
two halves. The first half is pure:

```js
const skills = await resolveSkills(skillsDir, repo.technologies, …);
const files = [];
for (const skill of skills)
  for (const target of repo.targets)
    files.push(getRenderer(target).render(skill));
```

Nothing above touches git. Everything below `if (dryRun)` does. Drift detection
is just "compute `files`, then compare against what is on disk" — no new
rendering logic at all.

`clone()` (`libs/git/src/git.js:35`) already accepts `{ depth }`, currently used
only by `loadConfigFromRepo`. A check run can shallow-clone the default branch
and never call `checkoutBranch`/`commitAll`/`push`.

### What has to change

1. **Extract `renderRepoFiles(repo, ctx)`** out of `syncRepo`. Both `sync` and
   `check` call it. Small, contained, keeps the coverage gate satisfiable.
2. **Two check modes**, not one:
   - *Remote*: `ai-sync --check` — shallow-clone each repo, compare, report.
     Useful from the ai-sync side ("which of my repos are stale?").
   - *Local*: `ai-sync --check --repo <name> --repo-dir .` — compare against a
     checkout already on disk. **This is the mode CI in a target repo needs**;
     it requires no clone and no git credentials for the target repo. Feature 5
     is unbuildable without it.
3. **Three drift categories.** `missing` (file absent) and `stale` (content
   differs) fall out of the file list for free. `orphan` (a managed file that no
   longer corresponds to any skill — e.g. a skill was renamed or a technology
   dropped) does **not**: it requires knowing which paths a renderer owns.
   Renderers currently only build paths, they can't recognise them. This needs a
   new bit of renderer API — `managedGlob` (`.claude/skills/*/SKILL.md`) or an
   `owns(path)` predicate.

   Orphan detection is the one genuinely new capability here. It is also
   skippable for v1 — `missing` + `stale` already cover the CI use case. Worth
   deferring rather than letting it hold up the feature.
4. **Exit codes and output formats.** `0` clean / `1` drift / `2` error, so CI
   fails on drift. Add `--format json` (for the action to parse) and
   `--format github` (emits `::error file=…::` workflow commands, which puts the
   drift inline on the PR diff — cheap, and the single nicest part of the whole
   CI story).

### Risk notes

- Comparison must be byte-exact against what the renderer produces. `buildDocument`
  ends every file with a trailing newline; any check that trims will produce
  false "clean" results.
- Shallow-cloning the *default* branch is the right target for check — comparing
  against the `ai-sync/update-skills` branch would report clean whenever a stale
  sync PR is still open, which is exactly backwards.

---

## Feature 2 — More render targets

**Verdict: worth doing, but the interface has to change first. `AGENTS.md` is
the single highest-leverage addition.**

### The finding that matters: targets come in two shapes

The current renderer contract is one skill → one file:

```js
render(skill) → { path, content }
```

Every existing target (`claude`, `copilot`, `cursor`, `windsurf`) is a
*directory-of-files* target, so the contract fits. Of the proposed additions,
only half do:

| Target | Shape | Path | Notes |
|---|---|---|---|
| Cline | per-skill | `.clinerules/<name>.md` | Reads all `.md`/`.txt` in the dir. Supports YAML frontmatter with `paths` for conditional rules → maps directly onto our `globs`. Contract fits as-is. |
| Roo Code | per-skill | `.roo/rules/<name>.md` | Plain markdown, read recursively, concatenated in alphabetical filename order. No frontmatter semantics — `globs` would be dropped. Contract fits. |
| **AGENTS.md** | **single file** | `AGENTS.md` (root) | Plain markdown, no required fields, no frontmatter. **Breaks the contract.** |
| **Aider** | **single file** | `CONVENTIONS.md` (root) | Free-form markdown. **Breaks the contract.** Also needs a consumer-side opt-in (`read-only: CONVENTIONS.md` in `.aider.conf.yml` or `--read`), which ai-sync cannot do for the user. |
| **Zed** | **single file** | `.rules` (root) | Single flat file, explicitly "no granularity". **Breaks the contract.** |

**Required change:** add an optional aggregate hook to the renderer interface —

```js
renderAll(skills) → files[]        // optional
// getRenderer(id).renderAll?.(skills) ?? skills.map((s) => render(s))
```

and move the pipeline's inner loop over to it. Contained change to
`libs/renderers/src/renderers/index.js` plus the `files` loop in `pipeline.js`.
Config validation needs nothing: it already derives valid targets from
`knownTargets()`, so new targets are accepted the moment they're registered.

### The second finding: aggregate files are co-owned with humans

`AGENTS.md` and `CONVENTIONS.md` are files people write by hand. Overwriting
them wholesale — which is what `syncRepo` does today, unconditionally
`writeFile`-ing every rendered path — would destroy real content.

These targets need a **managed-region splice**: sentinel comments
(`<!-- ai-sync:start -->` … `<!-- ai-sync:end -->`) with ai-sync only ever
rewriting between them, appending the block if absent.

That makes rendering depend on the *existing* file content, which the current
pure `render(skill)` signature has no way to express. Recommendation: keep
renderers pure (they emit only the managed block) and put the splice in the
pipeline as a shared helper. That also keeps drift detection honest — feature 1
compares the managed region, not the whole file.

Aggregate output also needs a **deterministic skill order** (sort by name).
`resolveSkills` returns `Map` insertion order, which follows the order of
`repo.technologies` in the config — so reordering that array today would
silently churn every aggregate file.

### Prioritisation

`AGENTS.md` is worth more than the other four combined. As of early 2026 it is
read natively by Claude Code, Codex CLI, Cursor, Aider, Devin, Copilot, Gemini
CLI, Windsurf and Amazon Q; the spec was donated to the Linux Foundation's
Agentic AI Foundation in December 2025.

That also makes **Zed close to redundant**: Zed resolves the first match from
`.rules` → `.cursorrules` → `.windsurfrules` → `.clinerules` →
`.github/copilot-instructions.md` → `AGENT.md` → `AGENTS.md` → `CLAUDE.md` →
`GEMINI.md`. Any repo already targeting `claude`, `cursor` or `windsurf` is
*already* feeding Zed. A dedicated `zed` target would mostly add a fourth copy
of the same content — and, because `.rules` wins the precedence race, would
*override* the richer per-skill `.claude/skills/` output. Recommend not building
it, or building it last and documenting the conflict.

Suggested order: `agents` → `cline` → `roo` → `aider` → (`zed`, probably never).

---

## Feature 3 — Bidirectional sync / reverse import

**Verdict: split it. Ship divergence *detection* (nearly free once feature 1
lands); defer write-back.**

### Why full reverse import is hard

The render is **lossy and target-specific**:

- `copilot` collapses `globs` into an `applyTo` string, substituting `**` when
  absent — so an absent `globs` and `globs: ['**']` render identically and
  cannot be told apart on the way back.
- `cursor` synthesises `alwaysApply` from whether globs exist, and writes
  `globs: ''` for the empty case.
- `claude` keeps `name` + `description` but drops `globs` entirely.
- Only the **body** survives verbatim (`body.trim()` in `skill.js`, re-trimmed by
  `buildDocument`). Body round-trips cleanly; frontmatter does not.

It is also **many-to-one**: one canonical `SKILL.md` fans out to N targets. If a
developer hand-edits `.cursor/rules/x.mdc` and someone else edits
`.claude/skills/x/SKILL.md` differently, there is no principled way to pick a
winner. Any automatic import has to answer "from which target?" and the tool
cannot answer it.

### What is cheap and genuinely useful

**Divergence detection**: "`.cursor/rules/x.mdc` in repo Y has been hand-edited
relative to what skill `x` would render." That is *exactly* the `stale` category
from feature 1 — the machinery is identical, only the framing differs (feature 1
asks "is the target behind?", feature 3 asks "did someone edit downstream?").
Present it as a unified diff and the hand-edit is visible and reviewable.

This captures most of the value at a fraction of the risk, and needs no new
API: attributing a platform file back to a skill is done by *generating* all
candidate paths and matching, not by parsing paths.

**Write-back**, if ever built, should be explicit and narrow: one skill, one
target, `ai-sync adopt <skill> --from <target> --repo <name>`, body-only, with
frontmatter left untouched. Not a bulk `--reverse` mode.

---

## Feature 4 — Board persistence & history

**Verdict: build it. Fully independent of the other four — good parallel track.
There is a blocking data-model bug to fix first.**

### The blocker: time-in-status is not currently derivable

`setStatus` (`libs/workspace-bootstrap/src/board.js`) records:

```js
events = [{ event: lastEvent, at }, ...(prev?.events ?? [])].slice(0, MAX_EVENTS)
board.repos[repo] = { status: state, updatedAt: at, lastEvent, events }
```

Each event stores **what happened** (`UserPromptSubmit`, `Stop`, …) and **when**
— but *not the status it moved to*. The current status exists only on the
top-level snapshot, which is overwritten on every write. So the event history
cannot answer "when did this repo enter `question`?", and no time-in-status
metric can be computed from the data we keep today.

Fix: events must carry the transition — `{ event, at, from, to }`. `readBoard`
already normalises legacy shapes (it back-fills `events` from `lastEvent`), so
there is an established place to keep old boards readable.

### The second problem: the 20-event cap is blown constantly

`HOOK_EVENTS` (`libs/workspace-bootstrap/src/hooks.js`) fires `UserPromptSubmit`
→ `inprogress` on **every single prompt** in a Claude Code session, plus `Stop`
→ `question` on every turn end. `MAX_EVENTS = 20` is therefore a handful of
turns of history — often less than an hour. Any metric built on `board.json`'s
`events` array is computing over a keyhole.

Two consequences:
- History belongs in an **append-only log**, not the snapshot.
- Metrics must **collapse consecutive identical statuses**, or "time in
  inprogress" becomes a count of prompts rather than a duration.

### Recommended shape

Keep `board.json` as the current-state snapshot (the server reads it whole on
every `/api/board` hit — it needs to stay small). Add
`.ai-sync/events.jsonl` alongside it, one JSON object per line, appended via
`fs.appendFile`:

```jsonl
{"ts":"2026-07-28T09:14:02.101Z","repo":"lk-mind","from":"todo","to":"inprogress","event":"UserPromptSubmit"}
```

**JSONL over SQLite.** Zero dependencies, crash-safe under append, greppable by
hand, and trivially tailable by the server. The volume is a few hundred lines a
day. SQLite would mean either `better-sqlite3` (native build, a real cost for a
CLI installed via `npx`) or `node:sqlite`, which exists in Node 22 — matching
this repo's `engines` — but is still experimental. Neither is worth it at this
volume; revisit only if cross-repo aggregate queries become the main use case.

Metrics worth surfacing, in rough value order:
1. **Time in current status** — computable *today* from `updatedAt` alone, no
   log needed. Cheapest possible win; belongs on the card in `Card.vue`.
2. Total time per status per repo (needs the log).
3. Count of entries into `question` — the literal "how often was this blocked on
   me" number.
4. Mean time-to-unblock: `question` → `inprogress` transition durations.

Server-side this is one new endpoint (`/api/events?repo=`) reading the tail of
the log; UI-side, `RepoDetail.vue` already renders `repo.events` in a list and is
the natural home for a timeline.

---

## Feature 5 — GitHub Action wrapper

**Verdict: build it, but strictly after feature 1. It is a thin wrapper — all
the substance is in `--check --repo-dir`.**

### Shape

A **composite** action, not Docker — it only needs to run Node. Living at
`.github/actions/ai-sync-check/action.yml` in this repo, consumers reference it
as `linktogo/ai-sync/.github/actions/ai-sync-check@v1`.

The body is essentially:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npx @linktogo/ai-sync@${{ inputs.version }} --check
       --repo ${{ inputs.repo }} --repo-dir . --config-repo ${{ inputs.config-repo }}
       --format github
```

The package already publishes to npm as `@linktogo/ai-sync` with provenance
(`publishConfig` in `package.json`), so `npx` works with no extra publishing
work.

### The two things that will actually bite

1. **Private config repo.** `--config-repo` points at `lk-config`, which is
   private. `loadConfigFromRepo` shells out to `git clone` with no credential
   handling, so an action running in a *different* repo has no way in. The action
   needs a `config-repo-token` input, wired via
   `git config --global url."https://x-access-token:$TOKEN@github.com/".insteadOf`
   — and the token must be masked, never interpolated into a `run:` line where it
   could land in logs. This is the one security-relevant part of the feature.
2. **Version pinning.** An action ref (`@v1`) and an npm version are two
   independent things; if the action defaults to `@latest`, a publish silently
   changes behaviour for every consumer mid-PR. Default `inputs.version` to the
   exact version the action ref was cut from.

### Trade-off to flag

A subdirectory action can be consumed by any repo that can read this one, but
**cannot be listed on the GitHub Marketplace** — Marketplace requires
`action.yml` at the root of its own repository. Fine for internal org use; if
public distribution is ever wanted, it needs a separate `ai-sync-action` repo.

---

## How these relate

```
Feature 1 (--check)
   ├──> Feature 5 (GitHub Action)      — pure wrapper, no value without 1
   └──> Feature 3 (divergence detect)  — same comparison, different framing

Feature 2 (render targets)   — independent; needs renderAll() interface change
Feature 4 (board history)    — fully independent; different library entirely
```

Two tracks can run in parallel: **1 → 5 → 3** (the sync/CI story) and
**4** (the board story). Feature 2 slots in anywhere, but note that landing new
targets *after* feature 1 means drift detection covers them from day one, while
landing them before means the aggregate-file splice logic gets written twice.

### Suggested sequencing

1. **`--check`, local + remote, `missing`/`stale` only** — defer orphan detection.
2. **GitHub Action** — thin, once 1 is real.
3. **`renderAll()` + `AGENTS.md`** — the interface change plus the one target
   that's worth more than the rest combined.
4. **Board event log + time-in-status** — fix the transition-recording gap first;
   ship "time in current status" immediately since it needs no log at all.
5. **Divergence detection** — mostly presentation over feature 1's comparison.
6. *Deferred:* `cline`/`roo`/`aider` targets, orphan detection, write-back
   (`adopt`). *Not recommended:* a `zed` target.

---

## Sources

- [AGENTS.md spec guide](https://www.morphllm.com/agents-md-guide) and
  [AGENTS.md complete guide 2026](https://codersera.com/blog/agents-md-complete-guide-2026/)
- [Zed AI rules documentation](https://github.com/zed-industries/zed/blob/main/docs/src/ai/rules.md)
- [Cline rules documentation](https://docs.cline.bot/customization/cline-rules)
- [Roo Code custom instructions](https://docs.roocode.com/features/custom-instructions)
- [Aider — specifying coding conventions](https://aider.chat/docs/usage/conventions.html)
