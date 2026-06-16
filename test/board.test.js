import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { STATES, resolveBoardPath, readBoard, writeBoard, setStatus } from '../src/board.js';

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

test('readBoard parses an existing board and fills defaults', async () => {
  const read = async () => JSON.stringify({ repos: { a: { status: 'done' } } });
  assert.deepEqual(await readBoard('/x', { read }), { version: 1, repos: { a: { status: 'done' } } });
});
test('readBoard returns an empty board when the file is missing', async () => {
  const read = async () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; };
  assert.deepEqual(await readBoard('/x', { read }), { version: 1, repos: {} });
});
test('readBoard rethrows non-ENOENT errors', async () => {
  const read = async () => { const e = new Error('boom'); e.code = 'EACCES'; throw e; };
  await assert.rejects(() => readBoard('/x', { read }), /boom/);
});

test('writeBoard ensures the dir, writes a temp file, then renames (atomic)', async () => {
  const calls = [];
  await writeBoard('/d/board.json', { version: 1, repos: {} }, {
    ensureDir: async (dir, opts) => calls.push(['ensureDir', dir, opts]),
    write: async (file, data) => calls.push(['write', file, data]),
    move: async (from, to) => calls.push(['move', from, to]),
    tmpSuffix: '.tmp',
  });
  assert.deepEqual(calls, [
    ['ensureDir', '/d', { recursive: true }],
    ['write', '/d/board.json.tmp', '{\n  "version": 1,\n  "repos": {}\n}\n'],
    ['move', '/d/board.json.tmp', '/d/board.json'],
  ]);
});

test('setStatus reads, applies the transition with timestamp + event, and writes', async () => {
  let written;
  const board = await setStatus('/x', 'oc-be', 'question', {
    lastEvent: 'Notification',
    now: () => '2026-06-16T10:00:00Z',
    read: async () => JSON.stringify({ version: 1, repos: { 'oc-be': { status: 'inprogress' } } }),
    write: async (_f, data) => { written = data; },
    move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(board.repos['oc-be'], { status: 'question', updatedAt: '2026-06-16T10:00:00Z', lastEvent: 'Notification' });
  assert.match(written, /"status": "question"/);
});
test('setStatus defaults lastEvent to manual', async () => {
  const board = await setStatus('/x', 'a', 'done', {
    now: () => 'T', read: async () => '{"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.equal(board.repos.a.lastEvent, 'manual');
});
test('setStatus rejects an invalid state', async () => {
  await assert.rejects(() => setStatus('/x', 'a', 'bogus', {}), /Invalid state "bogus"/);
});
