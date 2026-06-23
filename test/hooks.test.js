import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hookSettings } from '../src/hooks.js';

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
