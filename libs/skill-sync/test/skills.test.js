import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSkills } from '../src/skills.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/skills');

test('resolveSkills returns the union across technologies, skipping non-directories', async () => {
  const skills = await resolveSkills(fixtures, ['nestjs', 'react']);
  const names = skills.map((s) => s.name).sort();
  assert.deepEqual(names, ['nestjs-module-structure', 'react-component']);
});

test('resolveSkills warns and continues when a technology has no directory', async () => {
  const warnings = [];
  const skills = await resolveSkills(fixtures, ['nestjs', 'missing'], {
    warn: (m) => warnings.push(m),
  });
  assert.equal(skills.length, 1);
  assert.match(warnings[0], /No skills directory for technology "missing"/);
});

test('resolveSkills dedupes by skill name (last technology wins)', async () => {
  const skills = await resolveSkills(fixtures, ['nestjs', 'nestjs']);
  assert.equal(skills.length, 1);
});

test('resolveSkills rethrows non-ENOENT errors (e.g. ENOTDIR when techno resolves to a file)', async () => {
  await assert.rejects(
    () => resolveSkills(fixtures, ['nestjs/_notdir.txt']),
    (err) => err.code !== 'ENOENT',
  );
});
