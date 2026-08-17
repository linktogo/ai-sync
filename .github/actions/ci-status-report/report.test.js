import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const reportPath = fileURLToPath(new URL('./report.js', import.meta.url));

async function makeStatusRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'ci-status-report-git-'));
  const bare = path.join(root, 'origin.git');
  const seed = path.join(root, 'seed');
  execFileSync('git', ['init', '--bare', bare]);
  execFileSync('git', ['clone', bare, seed]);
  execFileSync('git', ['-C', seed, 'config', 'user.email', 't@t.dev']);
  execFileSync('git', ['-C', seed, 'config', 'user.name', 'T']);
  execFileSync('git', ['-C', seed, 'checkout', '--orphan', 'ci-status']);
  await mkdir(path.join(seed, 'updates'), { recursive: true });
  await writeFile(path.join(seed, 'updates', '.gitkeep'), '');
  execFileSync('git', ['-C', seed, 'add', '.']);
  execFileSync('git', ['-C', seed, 'commit', '-m', 'init ci-status']);
  execFileSync('git', ['-C', seed, 'push', 'origin', 'HEAD:ci-status']);
  return { root, bare };
}

async function cloneStatusRepo(root, bare) {
  const dest = path.join(root, `verify-${Math.random().toString(36).slice(2)}`);
  execFileSync('git', ['clone', '--branch', 'ci-status', '--single-branch', bare, dest]);
  return dest;
}

function baseEnv({ statusRepo, token, branch = 'ci-status', runId = '42' } = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    INPUT_TOKEN: token ?? 'sekrit-token-abc123',
    INPUT_STATUS_REPO: statusRepo,
    INPUT_BRANCH: branch,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REPOSITORY: 'linktogo/lk-myasso',
    GITHUB_ACTOR: 'fabien',
    GITHUB_RUN_ID: runId,
    GITHUB_WORKFLOW: 'CI',
    GITHUB_REF_NAME: 'main',
    GITHUB_SERVER_URL: 'https://github.com',
    JOB_STATUS: 'success',
  };
}

function runReport(env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [reportPath], { env }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

async function tempCloneDirs() {
  const entries = await readdir(tmpdir());
  return entries.filter((name) => name.startsWith('maggie-status-'));
}

test('a deposit writes updates/<login>/<repo>.json on the ci-status branch', async () => {
  const { root, bare } = await makeStatusRepo();
  const env = baseEnv({ statusRepo: bare });

  const result = await runReport(env);
  assert.equal(result.code, 0, result.stderr);

  const verify = await cloneStatusRepo(root, bare);
  const raw = await readFile(path.join(verify, 'updates', 'fabien', 'lk-myasso.json'), 'utf8');
  const update = JSON.parse(raw);
  assert.equal(update.repo, 'lk-myasso');
  assert.equal(update.actor, 'fabien');
  assert.equal(update.runId, 42);
  assert.equal(update.status, 'completed');
  assert.equal(update.conclusion, 'success');
  assert.equal(update.workflow, 'CI');
  assert.equal(update.branch, 'main');
  assert.equal(update.event, 'push');
  assert.equal(update.url, 'https://github.com/linktogo/lk-myasso/actions/runs/42');
});

test('a failed deposit removes the temp clone instead of leaving the token on disk', async () => {
  const { root } = await makeStatusRepo();
  const token = 'sekrit-token-def456';
  const missing = path.join(root, `does-not-exist-${token}`);
  const env = baseEnv({ statusRepo: missing, token });

  const before = await tempCloneDirs();
  const result = await runReport(env);
  const after = await tempCloneDirs();

  assert.equal(result.code, 1);
  const createdByThisRun = after.filter((name) => !before.includes(name));
  assert.deepEqual(createdByThisRun, []);
});

test('the token never appears in the output of a failed deposit', async () => {
  const { root } = await makeStatusRepo();
  const token = 'sekrit-token-ghi789';
  const missing = path.join(root, `does-not-exist-${token}`);
  const env = baseEnv({ statusRepo: missing, token });

  const result = await runReport(env);

  assert.equal(result.code, 1);
  assert.doesNotMatch(result.stdout, new RegExp(token));
  assert.doesNotMatch(result.stderr, new RegExp(token));
  assert.match(result.stderr, /\*\*\*/);
});

test('a run older than the one already reported is skipped', async () => {
  const { root, bare } = await makeStatusRepo();

  const seed = await cloneStatusRepo(root, bare);
  const newerUpdate = {
    repo: 'lk-myasso', actor: 'fabien', runId: 999, status: 'completed', conclusion: 'failure',
    workflow: 'CI', branch: 'main', event: 'push',
    url: 'https://github.com/linktogo/lk-myasso/actions/runs/999',
    startedAt: '2026-07-01T00:00:00.000Z', sentAt: '2026-07-01T00:00:00.000Z',
  };
  await mkdir(path.join(seed, 'updates', 'fabien'), { recursive: true });
  await writeFile(path.join(seed, 'updates', 'fabien', 'lk-myasso.json'), `${JSON.stringify(newerUpdate, null, 2)}\n`);
  execFileSync('git', ['-C', seed, 'config', 'user.email', 't@t.dev']);
  execFileSync('git', ['-C', seed, 'config', 'user.name', 'T']);
  execFileSync('git', ['-C', seed, 'add', '.']);
  execFileSync('git', ['-C', seed, 'commit', '-m', 'seed newer run']);
  execFileSync('git', ['-C', seed, 'push', 'origin', 'ci-status']);
  const shaBefore = execFileSync('git', ['-C', seed, 'rev-parse', 'ci-status']).toString().trim();

  const env = baseEnv({ statusRepo: bare, runId: '42' });
  const result = await runReport(env);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /already reported, skipping/);

  const shaAfter = execFileSync('git', ['-C', seed, 'ls-remote', bare, 'refs/heads/ci-status']).toString().trim();
  assert.match(shaAfter, new RegExp(shaBefore));

  const verify = await cloneStatusRepo(root, bare);
  const raw = await readFile(path.join(verify, 'updates', 'fabien', 'lk-myasso.json'), 'utf8');
  assert.equal(JSON.parse(raw).runId, 999);
});

test('report.js imports the libs by relative path so the runner needs no npm install', async () => {
  const source = await readFile(reportPath, 'utf8');
  assert.doesNotMatch(source, /from ['"]@linktogo\//);
});
