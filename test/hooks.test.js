import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hookSettings, installHooks } from '../src/hooks.js';
import path from 'node:path';

test('hookSettings maps the three events to status commands', () => {
  const s = hookSettings('oc-be', '/ws/.ai-sync/board.json', { command: 'node /a/bin/workspace.js' });
  const cmd = (e) => s.hooks[e][0].hooks[0].command;
  assert.equal(s.hooks.UserPromptSubmit[0].matcher, undefined);
  assert.equal(cmd('UserPromptSubmit'),
    'node /a/bin/workspace.js status oc-be inprogress --board /ws/.ai-sync/board.json --event UserPromptSubmit');
  assert.equal(s.hooks.Notification[0].matcher, 'permission_prompt|idle_prompt');
  assert.equal(cmd('Notification'),
    'node /a/bin/workspace.js status oc-be question --board /ws/.ai-sync/board.json --event Notification');
  assert.equal(cmd('Stop'),
    'node /a/bin/workspace.js status oc-be question --board /ws/.ai-sync/board.json --event Stop');
  assert.equal(s.hooks.Stop[0].hooks[0].type, 'command');
});

test('hookSettings defaults the command to ai-workspace', () => {
  const s = hookSettings('a', '/b.json');
  assert.match(s.hooks.Stop[0].hooks[0].command, /^ai-workspace status a question /);
});

test('installHooks writes a fresh settings.local.json when none exists', async () => {
  const writes = [];
  const res = await installHooks('/ws/oc-be', 'oc-be', '/b.json', {
    command: 'ai-workspace',
    read: async () => { const e = new Error('x'); e.code = 'ENOENT'; throw e; },
    write: async (file, data) => writes.push({ file, data }),
    ensureDir: async () => {},
  });
  assert.equal(res.file, path.join('/ws/oc-be', '.claude', 'settings.local.json'));
  assert.equal(writes.length, 1);
  assert.ok(JSON.parse(writes[0].data).hooks.Stop);
});

test('installHooks merges hooks while preserving existing unrelated settings', async () => {
  let written;
  await installHooks('/ws/a', 'a', '/b.json', {
    read: async () => JSON.stringify({ permissions: { allow: ['Bash'] }, hooks: { PreToolUse: ['keep'] } }),
    write: async (_f, data) => { written = JSON.parse(data); },
    ensureDir: async () => {},
  });
  assert.deepEqual(written.permissions, { allow: ['Bash'] });
  assert.deepEqual(written.hooks.PreToolUse, ['keep']);
  assert.ok(written.hooks.UserPromptSubmit);
});

test('installHooks rethrows non-ENOENT read errors', async () => {
  await assert.rejects(() => installHooks('/ws/a', 'a', '/b.json', {
    read: async () => { const e = new Error('boom'); e.code = 'EACCES'; throw e; },
    write: async () => {}, ensureDir: async () => {},
  }), /boom/);
});
