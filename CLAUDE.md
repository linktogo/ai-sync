# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

`ai-sync` is a repository for synchronizing AI agent skills, practices, and workflows across projects in the `linktogo-org` organization.

## Superpowers Plugin

This project has the [Superpowers](https://github.com/obra/superpowers) plugin installed locally in `.claude/skills/`. These skills are available via the `Skill` tool:

| Skill | When to use |
|---|---|
| `brainstorming` | Before any implementation — refines requirements with the user |
| `writing-plans` | After brainstorming — creates a structured implementation plan |
| `executing-plans` | Runs the plan with review checkpoints |
| `test-driven-development` | Red/green/refactor TDD cycle |
| `systematic-debugging` | Four-phase root cause investigation before any fix |
| `subagent-driven-development` | Delegates engineering tasks to subagents with code review |
| `requesting-code-review` / `receiving-code-review` | Code review workflow |
| `verification-before-completion` | Verifies work before marking done |
| `finishing-a-development-branch` | Branch cleanup and PR preparation |
| `dispatching-parallel-agents` | Parallelizes independent tasks |
| `using-git-worktrees` | Isolates work across branches |
| `writing-skills` | Authors new Superpowers skills |
