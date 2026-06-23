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
