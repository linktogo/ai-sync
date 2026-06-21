import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseConfig, loadConfig, toHttpsUrl } from '../src/config.js';

test('parseConfig resolves repo targets, falling back to defaultTargets', () => {
  const cfg = parseConfig(JSON.stringify({
    defaultTargets: ['claude', 'copilot'],
    repos: [
      { name: 'a', url: 'u1', technologies: ['nestjs'] },
      { name: 'b', url: 'u2', technologies: ['react'], targets: ['cursor'] },
    ],
  }));
  assert.deepEqual(cfg.repos[0].targets, ['claude', 'copilot']);
  assert.deepEqual(cfg.repos[1].targets, ['cursor']);
});

test('parseConfig rejects invalid JSON', () => {
  assert.throws(() => parseConfig('{not json'), /Invalid JSON in config/);
});

test('parseConfig requires a non-empty repos array', () => {
  assert.throws(() => parseConfig('{"repos": []}'), /non-empty "repos" array/);
});

test('parseConfig rejects unknown default targets', () => {
  assert.throws(
    () => parseConfig('{"defaultTargets":["bad"],"repos":[{"name":"a","url":"u","technologies":["t"]}]}'),
    /unknown target "bad"/,
  );
});

test('parseConfig rejects unknown per-repo targets', () => {
  assert.throws(
    () => parseConfig('{"repos":[{"name":"a","url":"u","technologies":["t"],"targets":["bad"]}]}'),
    /unknown target "bad"/,
  );
});

test('parseConfig requires name', () => {
  assert.throws(() => parseConfig('{"repos":[{"url":"u","technologies":["t"]}]}'), /missing "name"/);
});

test('parseConfig requires url', () => {
  assert.throws(() => parseConfig('{"repos":[{"name":"a","technologies":["t"]}]}'), /missing "url"/);
});

test('parseConfig requires non-empty technologies', () => {
  assert.throws(
    () => parseConfig('{"repos":[{"name":"a","url":"u","technologies":[]}]}'),
    /"technologies" must be a non-empty array/,
  );
});

test('parseConfig rejects a repo that ends up with no targets', () => {
  assert.throws(
    () => parseConfig('{"repos":[{"name":"a","url":"u","technologies":["t"]}]}'),
    /no targets/,
  );
});

test('parseConfig rejects non-array defaultTargets', () => {
  assert.throws(
    () => parseConfig('{"defaultTargets":"claude","repos":[{"name":"a","url":"u","technologies":["t"]}]}'),
    /must be an array/,
  );
});

test('toHttpsUrl rewrites scp-style SSH urls to https', () => {
  assert.equal(
    toHttpsUrl('git@github.com:linktog/repo1.git'),
    'https://github.com/linktog/repo1.git',
  );
});

test('toHttpsUrl rewrites ssh:// urls to https', () => {
  assert.equal(
    toHttpsUrl('ssh://git@github.com/linktog/repo1.git'),
    'https://github.com/linktog/repo1.git',
  );
});

test('toHttpsUrl leaves https urls untouched', () => {
  assert.equal(
    toHttpsUrl('https://github.com/linktog/repo1.git'),
    'https://github.com/linktog/repo1.git',
  );
});

test('parseConfig normalizes a repo SSH url to https', () => {
  const cfg = parseConfig(JSON.stringify({
    repos: [{ name: 'a', url: 'git@github.com:org/a.git', technologies: ['t'], targets: ['claude'] }],
  }));
  assert.equal(cfg.repos[0].url, 'https://github.com/org/a.git');
});

test('loadConfig reads and parses a file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cfg-'));
  const file = path.join(dir, 'repos.json');
  await writeFile(file, '{"defaultTargets":["claude"],"repos":[{"name":"a","url":"u","technologies":["t"]}]}');
  const cfg = await loadConfig(file);
  assert.equal(cfg.repos[0].name, 'a');
});
