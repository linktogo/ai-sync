import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeFrontmatter, buildDocument } from '../src/frontmatter.js';

test('serializeFrontmatter quotes strings and renders booleans bare', () => {
  const out = serializeFrontmatter({ name: 'a', alwaysApply: true });
  assert.equal(out, '---\nname: "a"\nalwaysApply: true\n---\n');
});

test('serializeFrontmatter escapes quotes and backslashes', () => {
  const out = serializeFrontmatter({ description: 'say "hi"\\done' });
  assert.equal(out, '---\ndescription: "say \\"hi\\"\\\\done"\n---\n');
});

test('serializeFrontmatter rejects unsupported value types', () => {
  assert.throws(() => serializeFrontmatter({ n: 5 }), /Unsupported frontmatter value/);
});

test('buildDocument joins frontmatter and trimmed body with one blank line', () => {
  const out = buildDocument({ name: 'a' }, '\n# Title\nBody\n\n');
  assert.equal(out, '---\nname: "a"\n---\n\n# Title\nBody\n');
});
