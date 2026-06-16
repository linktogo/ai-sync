import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { STATES, resolveBoardPath } from '../src/board.js';

test('STATES are the four kanban columns in order', () => {
  assert.deepEqual(STATES, ['todo', 'inprogress', 'question', 'done']);
});
test('resolveBoardPath prefers the explicit board option', () => {
  assert.equal(resolveBoardPath({ board: 'b.json', env: {} }), path.resolve('b.json'));
});
test('resolveBoardPath falls back to AI_SYNC_BOARD', () => {
  assert.equal(resolveBoardPath({ env: { AI_SYNC_BOARD: '/tmp/x/board.json' } }), '/tmp/x/board.json');
});
test('resolveBoardPath throws when neither is set', () => {
  assert.throws(() => resolveBoardPath({ env: {} }), /No board path/);
});
