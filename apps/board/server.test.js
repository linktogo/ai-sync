import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBoardServer, startFromArgv } from './server.js';

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

test('startFromArgv falls back to the next port when the chosen one is busy', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-'));
  const blocker = createServer((_req, res) => res.end());
  // Bind on all interfaces (no host) so it conflicts with startFromArgv's default bind.
  const busyPort = await new Promise((resolve) => blocker.listen(0, () => resolve(blocker.address().port)));
  const logs = [];
  const server = startFromArgv(
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
