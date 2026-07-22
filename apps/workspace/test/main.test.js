import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { main } from '../src/main.js';

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
