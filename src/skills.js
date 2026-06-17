import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSkill } from './skill.js';

export async function resolveSkills(skillsDir, technologies, { warn = console.warn } = {}) {
  const byName = new Map();
  for (const techno of technologies) {
    const technoDir = path.join(skillsDir, techno);
    let entries;
    try {
      entries = await readdir(technoDir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        warn(`No skills directory for technology "${techno}" (${technoDir})`);
        continue;
      }
      throw err;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(technoDir, entry.name, 'SKILL.md');
      const skill = parseSkill(await readFile(skillFile, 'utf8'), skillFile);
      byName.set(skill.name, skill);
    }
  }
  return [...byName.values()];
}
