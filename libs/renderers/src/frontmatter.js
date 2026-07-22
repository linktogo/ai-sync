function serializeValue(value) {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  throw new Error(`Unsupported frontmatter value type: ${typeof value}`);
}

export function serializeFrontmatter(frontmatter) {
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${serializeValue(value)}`,
  );
  return `---\n${lines.join('\n')}\n---\n`;
}

export function buildDocument(frontmatter, body) {
  return `${serializeFrontmatter(frontmatter)}\n${body.trim()}\n`;
}
