import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBoardServer, startFromArgv, resolveServerBoardPath } from './server.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function listening(server) {
  return new Promise((resolve) => server.on('listening', () => resolve(server.address().port)));
}

test('GET /api/board returns the board JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const boardPath = path.join(dir, 'board.json');
  await writeFile(boardPath, JSON.stringify({ version: 1, repos: { a: { status: 'todo' } } }));
  const server = createBoardServer({ boardPath, distDir: dir });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: 1, repos: { a: { status: 'todo' } } });
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/board returns an empty board when the file is missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const server = createBoardServer({ boardPath: path.join(dir, 'nope.json'), distDir: dir });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.deepEqual(await res.json(), { version: 1, repos: {} });
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('serves a static file from distDir', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  await writeFile(path.join(dir, 'index.html'), '<h1>board</h1>');
  const server = createBoardServer({ boardPath: path.join(dir, 'board.json'), distDir: dir });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(res.headers.get('content-type'), 'text/html');
  assert.equal(await res.text(), '<h1>board</h1>');
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('unknown path falls back to index.html (SPA)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  await writeFile(path.join(dir, 'index.html'), '<h1>spa</h1>');
  const server = createBoardServer({ boardPath: path.join(dir, 'board.json'), distDir: dir });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/anything`);
  assert.equal(await res.text(), '<h1>spa</h1>');
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/config maps repos.json to name -> metadata', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const configPath = path.join(dir, 'repos.json');
  await writeFile(configPath, JSON.stringify({
    repos: [{ name: 'oc-be', url: 'https://h/oc-be.git', technologies: ['nestjs'], targets: ['claude'] }],
  }));
  const server = createBoardServer({ boardPath: path.join(dir, 'board.json'), distDir: dir, configPath });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/api/config`);
  assert.deepEqual(await res.json(), {
    repos: { 'oc-be': { url: 'https://h/oc-be.git', technologies: ['nestjs'], targets: ['claude'] } },
  });
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/config returns empty repos when no config is configured', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const server = createBoardServer({ boardPath: path.join(dir, 'board.json'), distDir: dir });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/api/config`);
  assert.deepEqual(await res.json(), { repos: {} });
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/config returns empty repos when the config file is missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const server = createBoardServer({ boardPath: path.join(dir, 'board.json'), distDir: dir, configPath: path.join(dir, 'nope.json') });
  const port = await listen(server);
  const res = await fetch(`http://127.0.0.1:${port}/api/config`);
  assert.deepEqual(await res.json(), { repos: {} });
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('resolveServerBoardPath: explicit --board wins over everything', () => {
  const wkBoard = path.resolve('/c', 'wk', '.ai-sync', 'board.json');
  assert.equal(
    resolveServerBoardPath({ board: 'x/b.json', env: { AI_SYNC_BOARD: '/e.json' }, cwd: '/c', exists: () => true }),
    path.resolve('/c', 'x/b.json'),
  );
  assert.notEqual(resolveServerBoardPath({ board: 'x/b.json', cwd: '/c', exists: () => true }), wkBoard);
});

test('resolveServerBoardPath: AI_SYNC_BOARD wins over auto-detect', () => {
  assert.equal(
    resolveServerBoardPath({ env: { AI_SYNC_BOARD: '/e/board.json' }, cwd: '/c', exists: () => true }),
    path.resolve('/c', '/e/board.json'),
  );
});

test('resolveServerBoardPath: auto-detects wk/.ai-sync/board.json when present', () => {
  const wkBoard = path.resolve('/c', 'wk', '.ai-sync', 'board.json');
  assert.equal(
    resolveServerBoardPath({ env: {}, cwd: '/c', exists: (p) => p === wkBoard }),
    wkBoard,
  );
});

test('resolveServerBoardPath: falls back to ./board.json when no workspace board exists', () => {
  assert.equal(
    resolveServerBoardPath({ env: {}, cwd: '/c', exists: () => false }),
    path.resolve('/c', 'board.json'),
  );
});

test('startFromArgv falls back to the next port when the chosen one is busy', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const blocker = createServer((_req, res) => res.end());
  // Bind on all interfaces (no host) so it conflicts with startFromArgv's default bind.
  const busyPort = await new Promise((resolve) => blocker.listen(0, () => resolve(blocker.address().port)));
  const logs = [];
  const server = await startFromArgv(
    ['--board', path.join(dir, 'board.json'), '--port', String(busyPort), '--dist', dir],
    { log: (m) => logs.push(m) },
  );
  const boundPort = await listening(server);
  assert.equal(boundPort, busyPort + 1);
  assert.ok(logs.some((m) => m.includes(`Port ${busyPort} is already in use`)));
  server.close();
  blocker.close();
  await rm(dir, { recursive: true, force: true });
});

test('startFromArgv reconciles a repo\'s hooks on start and logs what changed', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const checkout = path.join(dir, 'checkout');
  await mkdir(checkout, { recursive: true });
  const boardPath = path.join(dir, '.ai-sync', 'board.json');
  const configPath = path.join(dir, 'repos.json');
  await writeFile(configPath, JSON.stringify({
    repos: [{ name: 'demo', url: 'https://h/demo.git', path: checkout, technologies: ['nestjs'], targets: ['claude'] }],
  }));
  const logs = [];
  const server = await startFromArgv(
    ['--board', boardPath, '--config', configPath, '--port', '0', '--dist', dir],
    { log: (m) => logs.push(m) },
  );
  await listening(server);
  assert.ok(logs.some((m) => m.includes('✓ demo: hooks repointed')));
  const settings = JSON.parse(await readFile(path.join(checkout, '.claude', 'settings.local.json'), 'utf8'));
  assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /status demo inprogress --board/);
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('startFromArgv logs "all up to date" on a second start once hooks are already correct', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const checkout = path.join(dir, 'checkout');
  await mkdir(checkout, { recursive: true });
  const boardPath = path.join(dir, '.ai-sync', 'board.json');
  const configPath = path.join(dir, 'repos.json');
  await writeFile(configPath, JSON.stringify({
    repos: [{ name: 'demo', url: 'https://h/demo.git', path: checkout, technologies: ['nestjs'], targets: ['claude'] }],
  }));
  const firstServer = await startFromArgv(
    ['--board', boardPath, '--config', configPath, '--port', '0', '--dist', dir],
    { log: () => {} },
  );
  await listening(firstServer);
  firstServer.close();

  const logs = [];
  const secondServer = await startFromArgv(
    ['--board', boardPath, '--config', configPath, '--port', '0', '--dist', dir],
    { log: (m) => logs.push(m) },
  );
  await listening(secondServer);
  assert.ok(logs.some((m) => m.includes('hooks verified for 1 repo(s), all up to date')));
  secondServer.close();
  await rm(dir, { recursive: true, force: true });
});

test('startFromArgv performs no hook reconciliation when --config is not given', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const boardPath = path.join(dir, 'board.json');
  const logs = [];
  const server = await startFromArgv(
    ['--board', boardPath, '--port', '0', '--dist', dir],
    { log: (m) => logs.push(m) },
  );
  await listening(server);
  assert.ok(!logs.some((m) => m.includes('hooks')));
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('startFromArgv logs a warning and still starts when the config file is invalid', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const boardPath = path.join(dir, 'board.json');
  const configPath = path.join(dir, 'repos.json');
  await writeFile(configPath, '{not json');
  const logs = [];
  const server = await startFromArgv(
    ['--board', boardPath, '--config', configPath, '--port', '0', '--dist', dir],
    { log: (m) => logs.push(m) },
  );
  await listening(server);
  assert.ok(logs.some((m) => m.includes('⚠ hook reconciliation skipped')));
  server.close();
  await rm(dir, { recursive: true, force: true });
});
