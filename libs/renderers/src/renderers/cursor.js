import { buildDocument } from '../frontmatter.js';

export default {
  id: 'cursor',
  render(skill) {
    const hasGlobs = Array.isArray(skill.globs) && skill.globs.length > 0;
    const content = buildDocument(
      {
        description: skill.description,
        globs: hasGlobs ? skill.globs.join(',') : '',
        alwaysApply: !hasGlobs,
      },
      skill.body,
    );
    return { path: `.cursor/rules/${skill.name}.mdc`, content };
  },
};
