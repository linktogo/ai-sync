import { test } from 'node:test';
import assert from 'node:assert/strict';
import claude from '../../src/renderers/claude.js';

const skill = {
  name: 'nestjs-module-structure',
  description: 'How to structure NestJS modules',
  globs: ['**/*.ts'],
  body: '# Module structure',
};

test('claude renders SKILL.md path and name/description frontmatter', () => {
  const { path, content } = claude.render(skill);
  assert.equal(path, '.claude/skills/nestjs-module-structure/SKILL.md');
  assert.equal(
    content,
    '---\nname: "nestjs-module-structure"\ndescription: "How to structure NestJS modules"\n---\n\n# Module structure\n',
  );
});

test('claude id is "claude"', () => {
  assert.equal(claude.id, 'claude');
});
