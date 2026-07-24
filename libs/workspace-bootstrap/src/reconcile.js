import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { hookSettings, installHooks, HOOK_EVENTS as HOOK_EVENT_DEFS } from './hooks.js';
import { initRepos } from './board.js';

const HOOK_EVENTS = HOOK_EVENT_DEFS.map((h) => h.event);

async function defaultExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function flattenHooks(hooks) {
  const flat = {};
  for (const event of HOOK_EVENTS) {
    flat[event] = hooks?.[event]?.[0]?.hooks?.[0]?.command;
  }
  return flat;
}

async function defaultReadCurrentHooks(checkoutDir, { read = readFile } = {}) {
  const file = path.join(checkoutDir, '.claude', 'settings.local.json');
  let parsed;
  try {
    parsed = JSON.parse(await read(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return null;
  }
  return flattenHooks(parsed.hooks);
}

function hooksMatch(before, expectedHooks) {
  if (!before) return false;
  const expected = flattenHooks(expectedHooks);
  return HOOK_EVENTS.every((event) => before[event] === expected[event]);
}

// Every repo whose checkout already exists gets its hooks compared against
// what hookSettings() would produce today, and repointed if they differ (or
// don't exist yet). A repo's own failure is recorded, not thrown, so one bad
// repo can't stop the rest from being checked.
export async function reconcileHooks(config, options = {}) {
  const {
    boardPath,
    hookCommand,
    exists = defaultExists,
    readCurrentHooks = defaultReadCurrentHooks,
    installRepoHooks = installHooks,
    initBoard = initRepos,
  } = options;

  // Assumes boardPath always follows bootstrap()'s <workspaceDir>/.ai-sync/board.json
  // layout (confirmed during design — see docs/superpowers/specs/2026-07-23-board-startup-hook-reconciliation-design.md).
  const workspaceDir = path.dirname(path.dirname(boardPath));
  const results = [];

  for (const repo of config.repos) {
    const checkout = repo.path ? path.resolve(repo.path) : path.join(workspaceDir, repo.name);
    try {
      if (!(await exists(checkout))) {
        results.push({ repo: repo.name, status: 'skipped-missing', checkout });
        continue;
      }
      const before = await readCurrentHooks(checkout);
      const expected = hookSettings(repo.name, boardPath, { command: hookCommand }).hooks;
      if (hooksMatch(before, expected)) {
        results.push({ repo: repo.name, status: 'up-to-date', checkout });
        continue;
      }
      await installRepoHooks(checkout, repo.name, boardPath, { command: hookCommand });
      results.push({ repo: repo.name, status: 'repointed', checkout });
    } catch (err) {
      results.push({ repo: repo.name, status: 'error', error: err.message, checkout });
    }
  }

  await initBoard(boardPath, config.repos.map((r) => r.name));
  return results;
}
