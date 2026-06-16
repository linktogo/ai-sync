import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clone, createRepo } from '../src/git.js';

async function makeBareRemote() {
  const root = await mkdtemp(path.join(tmpdir(), 'git-'));
  const bare = path.join(root, 'origin.git');
  const seed = path.join(root, 'seed');
  execFileSync('git', ['init', '--bare', bare]);
  execFileSync('git', ['clone', bare, seed]);
  execFileSync('git', ['-C', seed, 'config', 'user.email', 't@t.dev']);
  execFileSync('git', ['-C', seed, 'config', 'user.name', 'T']);
  await writeFile(path.join(seed, 'README.md'), '# seed\n');
  execFileSync('git', ['-C', seed, 'add', '.']);
  execFileSync('git', ['-C', seed, 'commit', '-m', 'init']);
  execFileSync('git', ['-C', seed, 'push', 'origin', 'HEAD:main']);
  return { root, bare };
}

function configure(dir) {
  execFileSync('git', ['-C', dir, 'config', 'user.email', 't@t.dev']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'T']);
}

test('clone + checkoutBranch + commitAll + push round-trips through a bare remote', async () => {
  const { root, bare } = await makeBareRemote();
  const dest = path.join(root, 'work');
  const repo = await clone(bare, dest);
  configure(dest);
  await repo.checkoutBranch('ai-sync/update-skills');
  await writeFile(path.join(dest, 'new.txt'), 'hello\n');
  assert.equal(await repo.hasChanges(), true);
  await repo.commitAll('chore: sync');
  await repo.push('ai-sync/update-skills');

  const verify = path.join(root, 'verify');
  execFileSync('git', ['clone', '--branch', 'ai-sync/update-skills', bare, verify]);
  assert.equal(await readFile(path.join(verify, 'new.txt'), 'utf8'), 'hello\n');
});

test('hasChanges is false on a clean clone', async () => {
  const { root, bare } = await makeBareRemote();
  const dest = path.join(root, 'work');
  const repo = await clone(bare, dest);
  configure(dest);
  assert.equal(await repo.hasChanges(), false);
});

test('createPR invokes gh with title and body', async () => {
  const calls = [];
  const repo = createRepo('/somewhere', {
    exec: async (file, args) => {
      calls.push({ file, args });
      return '';
    },
  });
  await repo.createPR('My title', 'My body');
  assert.deepEqual(calls[0], {
    file: 'gh',
    args: ['pr', 'create', '--title', 'My title', '--body', 'My body'],
  });
});
