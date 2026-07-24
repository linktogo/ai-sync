import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { reconcileHooks } from '../src/reconcile.js';

const boardPath = '/ws/.ai-sync/board.json'; // workspaceDir derives to /ws
const hookCommand = '/cli/workspace.js';

function expectedHooks(repo) {
  return {
    UserPromptSubmit: `${hookCommand} status ${repo} inprogress --board ${boardPath} --event UserPromptSubmit`,
    Notification: `${hookCommand} status ${repo} question --board ${boardPath} --event Notification`,
    Stop: `${hookCommand} status ${repo} question --board ${boardPath} --event Stop`,
  };
}

test('repo with hooks already matching current board/command -> up-to-date, no write', async () => {
  const config = { repos: [{ name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] }] };
  const installed = [];
  let inited;
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => true,
    readCurrentHooks: async () => expectedHooks('a'),
    installRepoHooks: async (...args) => { installed.push(args); },
    initBoard: async (bp, names) => { inited = { bp, names }; },
  });
  assert.deepEqual(results, [{ repo: 'a', status: 'up-to-date', checkout: '/ext/a' }]);
  assert.deepEqual(installed, []);
  assert.deepEqual(inited, { bp: boardPath, names: ['a'] });
});

test('repo with a stale command -> repointed, installRepoHooks called with current values', async () => {
  const config = { repos: [{ name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] }] };
  const installed = [];
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => true,
    readCurrentHooks: async () => ({
      UserPromptSubmit: '/old/bin/workspace.js status a inprogress --board /old/board.json --event UserPromptSubmit',
      Notification: '/old/bin/workspace.js status a question --board /old/board.json --event Notification',
      Stop: '/old/bin/workspace.js status a question --board /old/board.json --event Stop',
    }),
    installRepoHooks: async (...args) => { installed.push(args); },
    initBoard: async () => {},
  });
  assert.deepEqual(results, [{ repo: 'a', status: 'repointed', checkout: '/ext/a' }]);
  assert.deepEqual(installed, [['/ext/a', 'a', boardPath, { command: hookCommand }]]);
});

test('repo with no .claude/settings.local.json yet -> repointed (first install)', async () => {
  const config = { repos: [{ name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] }] };
  const installed = [];
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => true,
    readCurrentHooks: async () => null,
    installRepoHooks: async (...args) => { installed.push(args); },
    initBoard: async () => {},
  });
  assert.deepEqual(results, [{ repo: 'a', status: 'repointed', checkout: '/ext/a' }]);
  assert.equal(installed.length, 1);
});

test('repo with an existing settings file that has no hooks key yet -> repointed', async () => {
  const config = { repos: [{ name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] }] };
  const installed = [];
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => true,
    readCurrentHooks: async () => ({ UserPromptSubmit: undefined, Notification: undefined, Stop: undefined }),
    installRepoHooks: async (...args) => { installed.push(args); },
    initBoard: async () => {},
  });
  assert.deepEqual(results, [{ repo: 'a', status: 'repointed', checkout: '/ext/a' }]);
  assert.equal(installed.length, 1);
});

test('repo whose checkout does not exist -> skipped-missing, no read/write attempted', async () => {
  const config = { repos: [{ name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] }] };
  const reads = [];
  const installed = [];
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => false,
    readCurrentHooks: async (...args) => { reads.push(args); return null; },
    installRepoHooks: async (...args) => { installed.push(args); },
    initBoard: async () => {},
  });
  assert.deepEqual(results, [{ repo: 'a', status: 'skipped-missing', checkout: '/ext/a' }]);
  assert.deepEqual(reads, []);
  assert.deepEqual(installed, []);
});

test('a repo whose installRepoHooks throws is recorded as an error and does not stop the rest', async () => {
  const config = {
    repos: [
      { name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] },
      { name: 'b', url: 'u', path: '/ext/b', technologies: ['t'], targets: ['claude'] },
    ],
  };
  let inited;
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => true,
    readCurrentHooks: async () => null,
    installRepoHooks: async (dir, repo) => { if (repo === 'a') throw new Error('EACCES'); },
    initBoard: async (bp, names) => { inited = { bp, names }; },
  });
  assert.deepEqual(results, [
    { repo: 'a', status: 'error', error: 'EACCES', checkout: '/ext/a' },
    { repo: 'b', status: 'repointed', checkout: '/ext/b' },
  ]);
  assert.deepEqual(inited, { bp: boardPath, names: ['a', 'b'] });
});

test('path-based and workspaceDir-derived checkouts both resolve correctly; initBoard runs regardless of statuses', async () => {
  const config = {
    repos: [
      { name: 'a', url: 'u', path: '/ext/a', technologies: ['t'], targets: ['claude'] },
      { name: 'b', url: 'u', technologies: ['t'], targets: ['claude'] }, // no path -> derived from boardPath
    ],
  };
  let inited;
  const results = await reconcileHooks(config, {
    boardPath,
    hookCommand,
    exists: async () => false,
    readCurrentHooks: async () => null,
    installRepoHooks: async () => {},
    initBoard: async (bp, names) => { inited = { bp, names }; },
  });
  assert.deepEqual(results, [
    { repo: 'a', status: 'skipped-missing', checkout: '/ext/a' },
    { repo: 'b', status: 'skipped-missing', checkout: path.join('/ws', 'b') },
  ]);
  assert.deepEqual(inited, { bp: boardPath, names: ['a', 'b'] });
});

test('default exists/readCurrentHooks/installRepoHooks work end-to-end against the real filesystem', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reconcile-'));
  const checkout = path.join(dir, 'repo');
  await mkdir(checkout, { recursive: true });
  const config = { repos: [{ name: 'a', url: 'u', path: checkout, technologies: ['t'], targets: ['claude'] }] };
  const bp = path.join(dir, '.ai-sync', 'board.json');

  const results = await reconcileHooks(config, { boardPath: bp, hookCommand, initBoard: async () => {} });
  assert.deepEqual(results, [{ repo: 'a', status: 'repointed', checkout }]);
  const settings = JSON.parse(await readFile(path.join(checkout, '.claude', 'settings.local.json'), 'utf8'));
  assert.equal(
    settings.hooks.UserPromptSubmit[0].hooks[0].command,
    `${hookCommand} status a inprogress --board ${bp} --event UserPromptSubmit`,
  );

  const results2 = await reconcileHooks(config, { boardPath: bp, hookCommand, initBoard: async () => {} });
  assert.deepEqual(results2, [{ repo: 'a', status: 'up-to-date', checkout }]);
  await rm(dir, { recursive: true, force: true });
});

test('default exists returns false for a checkout missing on the real filesystem', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reconcile-'));
  const missing = path.join(dir, 'missing');
  const config = { repos: [{ name: 'a', url: 'u', path: missing, technologies: ['t'], targets: ['claude'] }] };
  const bp = path.join(dir, '.ai-sync', 'board.json');
  const results = await reconcileHooks(config, { boardPath: bp, hookCommand, initBoard: async () => {} });
  assert.deepEqual(results, [{ repo: 'a', status: 'skipped-missing', checkout: missing }]);
  await rm(dir, { recursive: true, force: true });
});

test('a repo with a settings file that has no hooks key gets hooks installed for real, preserving other settings', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reconcile-'));
  const checkout = path.join(dir, 'repo');
  await mkdir(path.join(checkout, '.claude'), { recursive: true });
  await writeFile(
    path.join(checkout, '.claude', 'settings.local.json'),
    JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }),
  );
  const config = { repos: [{ name: 'a', url: 'u', path: checkout, technologies: ['t'], targets: ['claude'] }] };
  const bp = path.join(dir, '.ai-sync', 'board.json');
  const results = await reconcileHooks(config, { boardPath: bp, hookCommand, initBoard: async () => {} });
  assert.deepEqual(results, [{ repo: 'a', status: 'repointed', checkout }]);
  const settings = JSON.parse(await readFile(path.join(checkout, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(settings.permissions, { allow: ['Bash(ls)'] });
  assert.ok(settings.hooks.UserPromptSubmit);
  await rm(dir, { recursive: true, force: true });
});

test('a repo whose settings.local.json cannot be read for a reason other than ENOENT is recorded as an error (real filesystem)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reconcile-'));
  const checkout = path.join(dir, 'repo');
  // A directory where the settings file is expected forces a non-ENOENT
  // (EISDIR) read failure, exercising defaultReadCurrentHooks' rethrow path.
  await mkdir(path.join(checkout, '.claude', 'settings.local.json'), { recursive: true });
  const config = { repos: [{ name: 'a', url: 'u', path: checkout, technologies: ['t'], targets: ['claude'] }] };
  const bp = path.join(dir, '.ai-sync', 'board.json');
  const results = await reconcileHooks(config, { boardPath: bp, hookCommand, initBoard: async () => {} });
  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'error');
  assert.equal(results[0].checkout, checkout);
  assert.match(results[0].error, /illegal operation on a directory|EISDIR/);
  await rm(dir, { recursive: true, force: true });
});

test('default initBoard seeds the board for real when not overridden', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reconcile-'));
  const checkout = path.join(dir, 'repo');
  await mkdir(checkout, { recursive: true });
  const config = { repos: [{ name: 'a', url: 'u', path: checkout, technologies: ['t'], targets: ['claude'] }] };
  const bp = path.join(dir, '.ai-sync', 'board.json');
  await reconcileHooks(config, { boardPath: bp, hookCommand });
  const board = JSON.parse(await readFile(bp, 'utf8'));
  assert.equal(board.repos.a.status, 'todo');
  await rm(dir, { recursive: true, force: true });
});
