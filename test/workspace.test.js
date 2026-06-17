import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrap, main } from '../src/workspace.js';

function silentLogger() {
  return { log() {}, warn() {}, error() {} };
}

const config = {
  defaultTargets: ['claude'],
  repos: [
    { name: 'a', url: 'git@host:a.git', technologies: ['nestjs'], targets: ['claude'] },
    { name: 'b', url: 'git@host:b.git', technologies: ['nestjs'], targets: ['claude'] },
  ],
};

test('bootstrap requires a workspaceDir', async () => {
  await assert.rejects(() => bootstrap(config, { logger: silentLogger() }), /requires a workspaceDir/);
});

test('bootstrap rejects an unknown editor', async () => {
  await assert.rejects(
    () => bootstrap(config, { workspaceDir: '/tmp/x', editor: 'vim', logger: silentLogger() }),
    /Unknown editor "vim"/,
  );
});

test('clones missing repos, reuses present ones, and installs when package.json exists', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const execCalls = [];
  const present = new Set([path.join(ws, 'b'), path.join(ws, 'a', 'package.json')]);
  const result = await bootstrap(config, {
    workspaceDir: ws,
    clone: async (url, dir) => { cloned.push({ url, dir }); },
    exec: async (file, args, opts) => { execCalls.push({ file, args, opts }); },
    exists: async (p) => present.has(p),
    logger: silentLogger(),
  });

  assert.deepEqual(cloned, [{ url: 'git@host:a.git', dir: path.join(ws, 'a') }]);
  assert.deepEqual(result.results, [
    { repo: 'a', status: 'cloned', installed: true },
    { repo: 'b', status: 'reused', installed: false },
  ]);
  assert.deepEqual(execCalls, [{ file: 'pnpm', args: ['install'], opts: { cwd: path.join(ws, 'a') } }]);
  assert.equal(result.command, `cd ${ws} && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('--no-install path skips pnpm and the vscode editor yields a code command', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    editor: 'vscode',
    install: false,
    repoFilter: 'a',
    clone: async () => {},
    exec: async (...c) => { execCalls.push(c); },
    exists: async () => false,
    logger: silentLogger(),
  });

  assert.equal(execCalls.length, 0);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'cloned', installed: false }]);
  assert.equal(result.command, `code ${ws}`);
  await rm(ws, { recursive: true, force: true });
});

test('bootstrap works against the real filesystem (default exists)', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  // Pre-create repo "b" with a package.json so it is reused and installed.
  await mkdir(path.join(ws, 'b'), { recursive: true });
  await writeFile(path.join(ws, 'b', 'package.json'), '{}\n');

  const execCalls = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    clone: async (url, dir) => { await mkdir(dir, { recursive: true }); },
    exec: async (file, args, opts) => { execCalls.push({ file, opts }); },
    logger: silentLogger(),
  });

  assert.deepEqual(result.results, [
    { repo: 'a', status: 'cloned', installed: false },
    { repo: 'b', status: 'reused', installed: true },
  ]);
  assert.deepEqual(execCalls, [{ file: 'pnpm', opts: { cwd: path.join(ws, 'b') } }]);
  await rm(ws, { recursive: true, force: true });
});

test('dry-run reports actions without cloning or installing', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const execCalls = [];
  // "a" already checked out with a package.json -> reused + would install.
  // "b" absent -> would clone.
  const present = new Set([path.join(ws, 'a'), path.join(ws, 'a', 'package.json')]);
  const logs = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    dryRun: true,
    clone: async (url, dir) => { cloned.push({ url, dir }); },
    exec: async (...c) => { execCalls.push(c); },
    exists: async (p) => present.has(p),
    logger: { log: (m) => logs.push(m), warn() {}, error() {} },
  });

  assert.deepEqual(cloned, []);
  assert.deepEqual(execCalls, []);
  assert.deepEqual(result.results, [
    { repo: 'a', status: 'reused', installed: true },
    { repo: 'b', status: 'cloned', installed: false },
  ]);
  assert.ok(logs.some((m) => m.includes('[dry-run]') && m.includes('would clone')));
  assert.ok(logs.some((m) => m.includes('[dry-run]') && m.includes('would pnpm install')));
  await rm(ws, { recursive: true, force: true });
});

test('--worktree is only supported with the claude editor', async () => {
  await assert.rejects(
    () => bootstrap(config, { workspaceDir: '/tmp/x', editor: 'vscode', worktree: 'feat/x', logger: silentLogger() }),
    /--worktree is only supported with --editor claude/,
  );
});

test('claude + --worktree adds a worktree, installs in it, and launches there', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  // checkout "a" already present (reused); worktree absent; worktree has a package.json.
  const present = new Set([path.join(ws, 'a'), path.join(ws, 'a.feat-x', 'package.json')]);
  const result = await bootstrap(config, {
    workspaceDir: ws,
    editor: 'claude',
    worktree: 'feat/x',
    repoFilter: 'a',
    clone: async () => { throw new Error('should not clone'); },
    exec: async (file, args, opts) => { execCalls.push({ file, args, opts }); },
    exists: async (p) => present.has(p),
    logger: silentLogger(),
  });

  const wt = path.join(ws, 'a.feat-x');
  assert.deepEqual(execCalls, [
    { file: 'git', args: ['-C', path.join(ws, 'a'), 'worktree', 'add', wt, '-b', 'feat/x'], opts: {} },
    { file: 'pnpm', args: ['install'], opts: { cwd: wt } },
  ]);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'reused', installed: true }]);
  assert.equal(result.command, `cd ${wt} && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('reuses existing worktrees and launches at the workspace root for multiple repos', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  // both worktrees already exist -> reused; no package.json -> no install.
  const present = new Set([path.join(ws, 'a.feat'), path.join(ws, 'b.feat')]);
  const result = await bootstrap(config, {
    workspaceDir: ws,
    editor: 'claude',
    worktree: 'feat',
    clone: async () => {},
    exec: async (...c) => { execCalls.push(c); },
    exists: async (p) => present.has(p),
    logger: silentLogger(),
  });

  assert.deepEqual(result.results, [
    { repo: 'a', status: 'cloned', installed: false },
    { repo: 'b', status: 'cloned', installed: false },
  ]);
  assert.equal(execCalls.length, 0);
  assert.equal(result.command, `cd ${ws} && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('dry-run previews worktree creation without side effects', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  const logs = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    editor: 'claude',
    worktree: 'feat/y',
    repoFilter: 'a',
    dryRun: true,
    clone: async () => { throw new Error('should not clone'); },
    exec: async (...c) => { execCalls.push(c); },
    exists: async () => false,
    logger: { log: (m) => logs.push(m), warn() {}, error() {} },
  });

  assert.equal(execCalls.length, 0);
  assert.ok(logs.some((m) => m.includes('[dry-run]') && m.includes('would add worktree')));
  assert.equal(result.command, `cd ${path.join(ws, 'a.feat-y')} && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('main requires --config', async () => {
  await assert.rejects(
    () => main([], { loadConfig: async () => config, logger: silentLogger() }),
    /Missing required --config/,
  );
});

test('main requires --workspace', async () => {
  await assert.rejects(
    () => main(['--config', 'repos.json'], { loadConfig: async () => config, logger: silentLogger() }),
    /Missing required --workspace/,
  );
});

test('main loads config, resolves the workspace path, and forwards flags', async () => {
  let received;
  const code = await main(
    ['--config', 'repos.json', '--workspace', 'ws', '--editor', 'vscode', '--repo', 'a', '--worktree', 'feat/z', '--no-install', '--dry-run'],
    {
      loadConfig: async (p) => { assert.equal(p, 'repos.json'); return config; },
      runBootstrap: async (cfg, opts) => { received = opts; return {}; },
      logger: silentLogger(),
    },
  );

  assert.equal(code, 0);
  assert.equal(received.editor, 'vscode');
  assert.equal(received.repoFilter, 'a');
  assert.equal(received.worktree, 'feat/z');
  assert.equal(received.install, false);
  assert.equal(received.dryRun, true);
  assert.equal(received.workspaceDir, path.resolve('ws'));
});

test('main defaults editor to claude and install to true', async () => {
  let received;
  await main(['--config', 'repos.json', '--workspace', '/tmp/ws'], {
    loadConfig: async () => config,
    runBootstrap: async (cfg, opts) => { received = opts; return {}; },
    logger: silentLogger(),
  });

  assert.equal(received.editor, 'claude');
  assert.equal(received.install, true);
  assert.equal(received.dryRun, false);
  assert.equal(received.repoFilter, undefined);
});
