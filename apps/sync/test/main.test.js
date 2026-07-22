import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/main.js';

function silentLogger() {
  return { log() {}, warn() {}, error() {} };
}

const fakeConfig = { defaultTargets: ['claude'], repos: [] };

test('main requires --config', async () => {
  await assert.rejects(
    () => main([], { loadConfig: async () => fakeConfig, runPipeline: async () => [], logger: silentLogger() }),
    /Missing required --config/,
  );
});

test('main passes parsed flags to the pipeline and returns 0 on success', async () => {
  let received;
  const code = await main(
    ['--config', 'repos.json', '--pr', '--repo', 'a', '--work-dir', '/tmp/x'],
    {
      loadConfig: async (p) => { assert.equal(p, 'repos.json'); return fakeConfig; },
      runPipeline: async (config, opts) => { received = opts; return [{ status: 'pushed' }]; },
      logger: silentLogger(),
    },
  );
  assert.equal(code, 0);
  assert.equal(received.pr, true);
  assert.equal(received.repoFilter, 'a');
  assert.equal(received.workDir, '/tmp/x');
  assert.equal(received.dryRun, false);
});

test('main defaults pr/dryRun to false and derives a workDir', async () => {
  let received;
  await main(['--config', 'repos.json'], {
    loadConfig: async () => fakeConfig,
    runPipeline: async (config, opts) => { received = opts; return []; },
    logger: silentLogger(),
  });
  assert.equal(received.pr, false);
  assert.equal(received.dryRun, false);
  assert.match(received.workDir, /ai-sync$/);
  assert.match(received.skillsDir, /skills$/);
});

test('main returns 1 when any repo errored', async () => {
  const code = await main(['--config', 'repos.json'], {
    loadConfig: async () => fakeConfig,
    runPipeline: async () => [{ status: 'pushed' }, { status: 'error', error: 'x' }],
    logger: silentLogger(),
  });
  assert.equal(code, 1);
});
