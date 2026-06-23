import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrap, main, formatTimestamp } from '../src/workspace.js';

function silentLogger() {
  return { log() {}, warn() {}, error() {} };
}

const rel = (p) => path.relative(process.cwd(), p) || '.';

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
  assert.deepEqual(execCalls, [{ file: 'pnpm', args: ['install', '--prefer-offline'], opts: { cwd: path.join(ws, 'a') } }]);
  assert.equal(result.command, `cd "${rel(ws)}" && claude`);
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
  assert.equal(result.command, `code "${rel(path.join(ws, 'a'))}"`);
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
    { file: 'pnpm', args: ['install', '--prefer-offline'], opts: { cwd: wt } },
  ]);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'reused', installed: true }]);
  assert.equal(result.command, `cd "${rel(wt)}" && claude`);
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
  assert.equal(result.command, `cd "${rel(ws)}" && claude`);
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
  assert.equal(result.command, `cd "${rel(path.join(ws, 'a.feat-y'))}" && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('launch command falls back to "." when the launch dir is the cwd', async () => {
  const result = await bootstrap(config, {
    workspaceDir: process.cwd(),
    dryRun: true,
    clone: async () => {},
    exec: async () => {},
    exists: async () => false,
    logger: silentLogger(),
  });

  assert.equal(result.command, 'cd "." && claude');
});

test('formatTimestamp renders a zero-padded YYYYMMDD-HHMMSS stamp', () => {
  assert.equal(formatTimestamp(new Date(2026, 5, 21, 14, 30, 5)), '20260621-143005');
});

test('onExisting "reuse" keeps the existing checkout and does not clone', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    onExisting: async (repo) => { assert.equal(repo.name, 'a'); return 'reuse'; },
    clone: async (url, dir) => { cloned.push(dir); },
    exec: async () => {},
    exists: async (p) => p === path.join(ws, 'a'),
    logger: silentLogger(),
  });

  assert.deepEqual(cloned, []);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'reused', installed: false }]);
  await rm(ws, { recursive: true, force: true });
});

test('onExisting "reinstall" clones into <name>-reinstall (no removal when absent)', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const removed = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    onExisting: async () => 'reinstall',
    clone: async (url, dir) => { cloned.push(dir); },
    exec: async () => {},
    remove: async (p) => { removed.push(p); },
    exists: async (p) => p === path.join(ws, 'a'),
    logger: silentLogger(),
  });

  assert.deepEqual(removed, []);
  assert.deepEqual(cloned, [path.join(ws, 'a-reinstall')]);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'cloned', installed: false }]);
  assert.equal(result.command, `cd "${rel(path.join(ws, 'a-reinstall'))}" && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('onExisting "reinstall" removes a previous -reinstall checkout first', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const removed = [];
  const present = new Set([path.join(ws, 'a'), path.join(ws, 'a-reinstall')]);
  await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    onExisting: async () => 'reinstall',
    clone: async (url, dir) => { cloned.push(dir); },
    exec: async () => {},
    remove: async (p) => { removed.push(p); },
    exists: async (p) => present.has(p),
    logger: silentLogger(),
  });

  assert.deepEqual(removed, [path.join(ws, 'a-reinstall')]);
  assert.deepEqual(cloned, [path.join(ws, 'a-reinstall')]);
  await rm(ws, { recursive: true, force: true });
});

test('onExisting "timestamp" clones into a uniquely stamped directory', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    onExisting: async () => 'timestamp',
    timestamp: () => '20260621-143005',
    clone: async (url, dir) => { cloned.push(dir); },
    exec: async () => {},
    exists: async (p) => p === path.join(ws, 'a'),
    logger: silentLogger(),
  });

  assert.deepEqual(cloned, [path.join(ws, 'a-20260621-143005')]);
  assert.equal(result.command, `cd "${rel(path.join(ws, 'a-20260621-143005'))}" && claude`);
  await rm(ws, { recursive: true, force: true });
});

test('dry-run reinstall previews removal and clone without side effects', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const cloned = [];
  const removed = [];
  const logs = [];
  const present = new Set([path.join(ws, 'a'), path.join(ws, 'a-reinstall')]);
  await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    dryRun: true,
    onExisting: async () => 'reinstall',
    clone: async (url, dir) => { cloned.push(dir); },
    exec: async () => {},
    remove: async (p) => { removed.push(p); },
    exists: async (p) => present.has(p),
    logger: { log: (m) => logs.push(m), warn() {}, error() {} },
  });

  assert.deepEqual(removed, []);
  assert.deepEqual(cloned, []);
  assert.ok(logs.some((m) => m.includes('[dry-run]') && m.includes('would remove')));
  assert.ok(logs.some((m) => m.includes('[dry-run]') && m.includes('would clone into a-reinstall')));
  await rm(ws, { recursive: true, force: true });
});

test('reinstall against the real filesystem removes the stale dir (default remove)', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  await mkdir(path.join(ws, 'a'), { recursive: true });
  await mkdir(path.join(ws, 'a-reinstall'), { recursive: true });
  await writeFile(path.join(ws, 'a-reinstall', 'stale.txt'), 'x');

  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    install: false,
    onExisting: async () => 'reinstall',
    clone: async (url, dir) => { await mkdir(dir, { recursive: true }); },
    exec: async () => {},
    logger: silentLogger(),
  });

  assert.deepEqual(result.results, [{ repo: 'a', status: 'cloned', installed: false }]);
  await assert.rejects(() => access(path.join(ws, 'a-reinstall', 'stale.txt')));
  await rm(ws, { recursive: true, force: true });
});

test('offline mode installs with --offline and logs it', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  const logs = [];
  await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    offline: true,
    clone: async () => {},
    exec: async (file, args) => { execCalls.push({ file, args }); },
    exists: async (p) => p === path.join(ws, 'a', 'package.json'),
    logger: { log: (m) => logs.push(m), warn() {}, error() {} },
  });

  assert.deepEqual(execCalls, [{ file: 'pnpm', args: ['install', '--offline'] }]);
  assert.ok(logs.some((m) => m.includes('ran pnpm install (offline)')));
  await rm(ws, { recursive: true, force: true });
});

test('a Maven project runs dependency:go-offline', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    clone: async () => {},
    exec: async (file, args) => { execCalls.push({ file, args }); },
    exists: async (p) => p === path.join(ws, 'a', 'pom.xml'),
    logger: silentLogger(),
  });

  assert.deepEqual(execCalls, [{ file: 'mvn', args: ['dependency:go-offline'] }]);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'cloned', installed: true }]);
  await rm(ws, { recursive: true, force: true });
});

test('a repo with no recognised marker file is not installed', async () => {
  const ws = await mkdtemp(path.join(tmpdir(), 'ws-'));
  const execCalls = [];
  const result = await bootstrap(config, {
    workspaceDir: ws,
    repoFilter: 'a',
    clone: async () => {},
    exec: async (...c) => { execCalls.push(c); },
    exists: async () => false,
    logger: silentLogger(),
  });

  assert.equal(execCalls.length, 0);
  assert.deepEqual(result.results, [{ repo: 'a', status: 'cloned', installed: false }]);
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
    ['--config', 'repos.json', '--workspace', 'ws', '--editor', 'vscode', '--repo', 'a', '--worktree', 'feat/z', '--no-install', '--dry-run', '--offline'],
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
  assert.equal(received.offline, true);
  assert.equal(received.workspaceDir, path.resolve('ws'));
});

test('main prompts for a single repo and forwards onExisting on an interactive TTY', async () => {
  let promptedWith;
  let received;
  const onExisting = async () => 'reuse';
  await main(['--config', 'repos.json', '--workspace', '/tmp/ws'], {
    loadConfig: async () => config,
    isInteractive: true,
    selectRepo: async (repos) => { promptedWith = repos; return 'b'; },
    onExisting,
    runBootstrap: async (cfg, opts) => { received = opts; return {}; },
    logger: silentLogger(),
  });

  assert.deepEqual(promptedWith, config.repos);
  assert.equal(received.repoFilter, 'b');
  assert.equal(received.onExisting, onExisting);
});

test('main does not prompt when --repo is provided even interactively', async () => {
  let prompted = false;
  let received;
  await main(['--config', 'repos.json', '--workspace', '/tmp/ws', '--repo', 'a'], {
    loadConfig: async () => config,
    isInteractive: true,
    selectRepo: async () => { prompted = true; return 'b'; },
    runBootstrap: async (cfg, opts) => { received = opts; return {}; },
    logger: silentLogger(),
  });

  assert.equal(prompted, false);
  assert.equal(received.repoFilter, 'a');
});

test('main routes the status subcommand to setStatus', async () => {
  const calls = [];
  const code = await main(['status', 'oc-be', 'question', '--board', '/b.json', '--event', 'Stop'], {
    setStatus: async (boardPath, repo, state, o) => { calls.push({ boardPath, repo, state, o }); },
    logger: silentLogger(),
  });
  assert.equal(code, 0);
  assert.deepEqual(calls, [{ boardPath: path.resolve('/b.json'), repo: 'oc-be', state: 'question', o: { lastEvent: 'Stop' } }]);
});

test('status subcommand requires repo and state', async () => {
  await assert.rejects(
    () => main(['status', 'oc-be', '--board', '/b.json'], { setStatus: async () => {}, logger: silentLogger() }),
    /Usage: .*status <repo> <state>/,
  );
});

test('status subcommand defaults lastEvent to manual', async () => {
  let received;
  await main(['status', 'a', 'done', '--board', '/b.json'], {
    setStatus: async (_p, _r, _s, o) => { received = o; }, logger: silentLogger(),
  });
  assert.deepEqual(received, { lastEvent: 'manual' });
});

test('main accepts an explicit bootstrap subcommand', async () => {
  let received;
  await main(['bootstrap', '--config', 'repos.json', '--workspace', '/tmp/ws'], {
    loadConfig: async () => config, runBootstrap: async (_c, opts) => { received = opts; return {}; },
    logger: silentLogger(),
  });
  assert.equal(received.editor, 'claude');
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
  assert.equal(received.offline, false);
  assert.equal(received.repoFilter, undefined);
});
