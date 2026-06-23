import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Each Claude Code lifecycle event maps to the board state the running session
// is in: a fresh prompt means work resumed (inprogress); a permission/idle
// notification or a Stop means the session is waiting on the human (question).
const HOOK_EVENTS = [
  { event: 'UserPromptSubmit', state: 'inprogress', matcher: undefined },
  { event: 'Notification', state: 'question', matcher: 'permission_prompt|idle_prompt' },
  { event: 'Stop', state: 'question', matcher: undefined },
];

export function hookSettings(repo, boardPath, { command = 'ai-workspace' } = {}) {
  const hooks = {};
  for (const { event, state, matcher } of HOOK_EVENTS) {
    const group = {
      hooks: [{
        type: 'command',
        command: `${command} status ${repo} ${state} --board ${boardPath} --event ${event}`,
      }],
    };
    if (matcher) group.matcher = matcher;
    hooks[event] = [group];
  }
  return { hooks };
}

export async function installHooks(checkoutDir, repo, boardPath, opts = {}) {
  const { read = readFile, write = writeFile, ensureDir = mkdir, command } = opts;
  const dir = path.join(checkoutDir, '.claude');
  const file = path.join(dir, 'settings.local.json');
  let existing = {};
  try {
    existing = JSON.parse(await read(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const { hooks } = hookSettings(repo, boardPath, { command });
  const merged = { ...existing, hooks: { ...existing.hooks, ...hooks } };
  await ensureDir(dir, { recursive: true });
  await write(file, JSON.stringify(merged, null, 2) + '\n');
  return { file, merged };
}
