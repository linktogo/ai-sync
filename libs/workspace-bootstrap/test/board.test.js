import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { STATES, resolveBoardPath, readBoard, writeBoard, setSessionStatus, removeSession, initRepos } from '../src/board.js';

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

test('readBoard parses an existing v2 board and leaves sessions untouched', async () => {
  const sessions = { s1: { status: 'done', updatedAt: 'T', lastEvent: 'x', title: null, lastPrompt: null, events: [] } };
  const read = async () => JSON.stringify({ version: 2, repos: { a: { sessions } } });
  assert.deepEqual(await readBoard('/x', { read }), { version: 2, repos: { a: { sessions } } });
});

test('readBoard normalizes a v1 flat repo entry into the empty v2 sessions shape', async () => {
  const read = async () => JSON.stringify({ version: 1, repos: { a: { status: 'done', updatedAt: 'T', lastEvent: 'x', events: [] } } });
  const board = await readBoard('/x', { read });
  assert.deepEqual(board, { version: 2, repos: { a: { sessions: {} } } });
});

test('readBoard normalizes a repo entry with no sessions key to empty sessions', async () => {
  const read = async () => JSON.stringify({ repos: { a: {} } });
  const board = await readBoard('/x', { read });
  assert.deepEqual(board.repos.a, { sessions: {} });
});

test('readBoard returns an empty v2 board when the file is missing', async () => {
  const read = async () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; };
  assert.deepEqual(await readBoard('/x', { read }), { version: 2, repos: {} });
});
test('readBoard rethrows non-ENOENT errors', async () => {
  const read = async () => { const e = new Error('boom'); e.code = 'EACCES'; throw e; };
  await assert.rejects(() => readBoard('/x', { read }), /boom/);
});

test('writeBoard ensures the dir, writes a temp file, then renames (atomic)', async () => {
  const calls = [];
  await writeBoard('/d/board.json', { version: 2, repos: {} }, {
    ensureDir: async (dir, opts) => calls.push(['ensureDir', dir, opts]),
    write: async (file, data) => calls.push(['write', file, data]),
    move: async (from, to) => calls.push(['move', from, to]),
    tmpSuffix: '.tmp',
  });
  assert.deepEqual(calls, [
    ['ensureDir', '/d', { recursive: true }],
    ['write', '/d/board.json.tmp', '{\n  "version": 2,\n  "repos": {}\n}\n'],
    ['move', '/d/board.json.tmp', '/d/board.json'],
  ]);
});

test('setSessionStatus creates a new session on a repo not yet on the board, storing the given title/lastPrompt', async () => {
  const board = await setSessionStatus('/x', 'oc-be', 'sess-1', 'question', {
    lastEvent: 'Notification', title: 'first prompt', lastPrompt: 'first prompt',
    now: () => '2026-06-16T10:00:00Z',
    read: async () => JSON.stringify({ version: 2, repos: {} }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(board.repos['oc-be'].sessions['sess-1'], {
    status: 'question',
    updatedAt: '2026-06-16T10:00:00Z',
    lastEvent: 'Notification',
    title: 'first prompt',
    lastPrompt: 'first prompt',
    events: [{ event: 'Notification', at: '2026-06-16T10:00:00Z' }],
  });
});

test('setSessionStatus updates an existing session without touching a sibling session', async () => {
  const board = await setSessionStatus('/x', 'oc-be', 'sess-1', 'inprogress', {
    lastEvent: 'UserPromptSubmit',
    now: () => 'T2',
    read: async () => JSON.stringify({
      version: 2,
      repos: { 'oc-be': { sessions: {
        'sess-1': { status: 'question', updatedAt: 'T1', lastEvent: 'Stop', title: 'a', lastPrompt: 'a', events: [] },
        'sess-2': { status: 'done', updatedAt: 'T1', lastEvent: 'Stop', title: 'b', lastPrompt: 'b', events: [] },
      } } },
    }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.equal(board.repos['oc-be'].sessions['sess-1'].status, 'inprogress');
  assert.deepEqual(board.repos['oc-be'].sessions['sess-2'], { status: 'done', updatedAt: 'T1', lastEvent: 'Stop', title: 'b', lastPrompt: 'b', events: [] });
});

test('setSessionStatus sets title only on the first write and preserves it afterwards', async () => {
  const read = async () => JSON.stringify({
    version: 2,
    repos: { a: { sessions: { s1: { status: 'inprogress', updatedAt: 'T1', lastEvent: 'x', title: 'first prompt', lastPrompt: 'first prompt', events: [] } } } },
  });
  const board = await setSessionStatus('/x', 'a', 's1', 'question', {
    title: 'a different title', now: () => 'T2', read,
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.equal(board.repos.a.sessions.s1.title, 'first prompt');
});

test('setSessionStatus overwrites lastPrompt when passed and preserves the previous value when omitted', async () => {
  const read = async () => JSON.stringify({
    version: 2,
    repos: { a: { sessions: { s1: { status: 'inprogress', updatedAt: 'T1', lastEvent: 'x', title: 't', lastPrompt: 'old prompt', events: [] } } } },
  });
  const io = { now: () => 'T2', write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp' };

  const withNewPrompt = await setSessionStatus('/x', 'a', 's1', 'inprogress', { ...io, read, lastPrompt: 'new prompt' });
  assert.equal(withNewPrompt.repos.a.sessions.s1.lastPrompt, 'new prompt');

  const withoutPrompt = await setSessionStatus('/x', 'a', 's1', 'question', { ...io, read });
  assert.equal(withoutPrompt.repos.a.sessions.s1.lastPrompt, 'old prompt');
});

test('setSessionStatus prepends events newest-first and caps history at MAX_EVENTS per session', async () => {
  const prior = Array.from({ length: 20 }, (_, i) => ({ event: `e${i}`, at: 'old' }));
  const board = await setSessionStatus('/x', 'a', 's1', 'done', {
    lastEvent: 'pushed', now: () => 'NOW',
    read: async () => JSON.stringify({ version: 2, repos: { a: { sessions: { s1: { status: 'inprogress', events: prior } } } } }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  const events = board.repos.a.sessions.s1.events;
  assert.equal(events.length, 20);
  assert.deepEqual(events[0], { event: 'pushed', at: 'NOW' });
  assert.equal(events[19].event, 'e18'); // oldest entry dropped
});
test('setSessionStatus defaults lastEvent to manual', async () => {
  const board = await setSessionStatus('/x', 'a', 's1', 'done', {
    now: () => 'T', read: async () => '{"version":2,"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.equal(board.repos.a.sessions.s1.lastEvent, 'manual');
});
test('setSessionStatus rejects an invalid state', async () => {
  await assert.rejects(() => setSessionStatus('/x', 'a', 's1', 'bogus', {}), /Invalid state "bogus"/);
});
test('setSessionStatus stamps an ISO timestamp by default', async () => {
  const board = await setSessionStatus('/x', 'a', 's1', 'done', {
    read: async () => '{"version":2,"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.match(board.repos.a.sessions.s1.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('removeSession deletes one session and leaves a sibling session and other repos intact', async () => {
  const board = await removeSession('/x', 'a', 's1', {
    read: async () => JSON.stringify({
      version: 2,
      repos: {
        a: { sessions: { s1: { status: 'done' }, s2: { status: 'inprogress' } } },
        b: { sessions: { s3: { status: 'todo' } } },
      },
    }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(Object.keys(board.repos.a.sessions), ['s2']);
  assert.deepEqual(Object.keys(board.repos.b.sessions), ['s3']);
});
test('removeSession is a no-op when the repo is not on the board', async () => {
  const board = await removeSession('/x', 'unknown', 's1', {
    read: async () => '{"version":2,"repos":{}}',
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(board.repos, {});
});
test('removeSession is a no-op when the session is not on the repo', async () => {
  const board = await removeSession('/x', 'a', 'unknown-session', {
    read: async () => JSON.stringify({ version: 2, repos: { a: { sessions: { s1: { status: 'done' } } } } }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(Object.keys(board.repos.a.sessions), ['s1']);
});

test('initRepos adds missing repos with empty sessions without clobbering existing ones', async () => {
  const board = await initRepos('/x', ['a', 'b'], {
    read: async () => JSON.stringify({ version: 2, repos: { a: { sessions: { s1: { status: 'done' } } } } }),
    write: async () => {}, move: async () => {}, ensureDir: async () => {}, tmpSuffix: '.tmp',
  });
  assert.deepEqual(board.repos.a, { sessions: { s1: { status: 'done' } } });
  assert.deepEqual(board.repos.b, { sessions: {} });
});
