import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { STATES, resolveBoardPath, readBoard, writeBoard, setStatus, initRepos } from '../src/board.js';

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

test('readBoard parses an existing board and backfills an empty events array', async () => {
  const read = async () => JSON.stringify({ repos: { a: { status: 'done' } } });
  assert.deepEqual(await readBoard('/x', { read }), { version: 1, repos: { a: { status: 'done', events: [] } } });
});

test('readBoard backfills events from lastEvent for legacy files', async () => {
  const read = async () => JSON.stringify({ repos: { a: { status: 'done', lastEvent: 'pushed', updatedAt: 'T' } } });
  const board = await readBoard('/x', { read });
  assert.deepEqual(board.repos.a.events, [{ event: 'pushed', at: 'T' }]);
});

test('readBoard backfills with a null timestamp when updatedAt is absent', async () => {
  const read = async () => JSON.stringify({ repos: { a: { status: 'done', lastEvent: 'pushed' } } });
  const board = await readBoard('/x', { read });
  assert.deepEqual(board.repos.a.events, [{ event: 'pushed', at: null }]);
});

test('readBoard leaves an existing events array untouched', async () => {
  const events = [{ event: 'x', at: 'T' }];
  const read = async () => JSON.stringify({ repos: { a: { status: 'done', lastEvent: 'x', updatedAt: 'T', events } } });
  const board = await readBoard('/x', { read });
  assert.deepEqual(board.repos.a.events, events);
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
  assert.deepEqual(board.repos['oc-be'], {
    status: 'question',
    updatedAt: '2026-06-16T10:00:00Z',
    lastEvent: 'Notification',
    events: [{ event: 'Notification', at: '2026-06-16T10:00:00Z' }],
  });
  assert.match(written, /"status": "question"/);
});

test('setStatus prepends events newest-first and caps the history', async () => {
  const prior = Array.from({ length: 20 }, (_, i) => ({ event: `e${i}`, at: 'old' }));
  const board = await setStatus('/x', 'a', 'done', {
    lastEvent: 'pushed', now: () => 'NOW',
    read: async () => JSON.stringify({ version: 1, repos: { a: { status: 'inprogress', events: prior } } }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.equal(board.repos.a.events.length, 20);
  assert.deepEqual(board.repos.a.events[0], { event: 'pushed', at: 'NOW' });
  assert.equal(board.repos.a.events[19].event, 'e18'); // oldest entry dropped
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
test('setStatus stamps an ISO timestamp by default', async () => {
  const board = await setStatus('/x', 'a', 'done', {
    read: async () => '{"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.match(board.repos.a.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('initRepos adds missing repos as todo without clobbering existing ones', async () => {
  const board = await initRepos('/x', ['a', 'b'], {
    now: () => 'T',
    read: async () => JSON.stringify({ version: 1, repos: { a: { status: 'done', updatedAt: 'old', lastEvent: 'done' } } }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(board.repos.a, { status: 'done', updatedAt: 'old', lastEvent: 'done', events: [{ event: 'done', at: 'old' }] });
  assert.deepEqual(board.repos.b, { status: 'todo', updatedAt: 'T', lastEvent: 'init', events: [{ event: 'init', at: 'T' }] });
});
test('initRepos stamps an ISO timestamp by default', async () => {
  const board = await initRepos('/x', ['a'], {
    read: async () => '{"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.match(board.repos.a.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
