import { readFile } from 'node:fs/promises';
import { knownTargets } from './renderers/index.js';

export async function loadConfig(filePath) {
  return parseConfig(await readFile(filePath, 'utf8'));
}

export function parseConfig(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in config: ${err.message}`);
  }
  const valid = knownTargets();
  const defaultTargets = parsed.defaultTargets ?? [];
  validateTargets(defaultTargets, valid, 'defaultTargets');
  if (!Array.isArray(parsed.repos) || parsed.repos.length === 0) {
    throw new Error('Config must define a non-empty "repos" array');
  }
  const repos = parsed.repos.map((repo, i) => normalizeRepo(repo, i, defaultTargets, valid));
  return { defaultTargets, repos };
}

function normalizeRepo(repo, index, defaultTargets, valid) {
  const label = repo.name ? `repos[${index}] (${repo.name})` : `repos[${index}]`;
  if (!repo.name) throw new Error(`repos[${index}]: missing "name"`);
  if (!repo.url) throw new Error(`${label}: missing "url"`);
  if (!Array.isArray(repo.technologies) || repo.technologies.length === 0) {
    throw new Error(`${label}: "technologies" must be a non-empty array`);
  }
  const targets = repo.targets ?? defaultTargets;
  validateTargets(targets, valid, `${label}.targets`);
  if (targets.length === 0) {
    throw new Error(`${label}: no targets (set repo.targets or defaultTargets)`);
  }
  return { name: repo.name, url: toHttpsUrl(repo.url), technologies: repo.technologies, targets };
}

// Clone over HTTPS rather than SSH: rewrite scp-style and ssh:// URLs.
export function toHttpsUrl(url) {
  const scp = url.match(/^[^@/]+@([^:/]+):(.+)$/);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  const ssh = url.match(/^ssh:\/\/(?:[^@/]+@)?(.+)$/);
  if (ssh) return `https://${ssh[1]}`;
  return url;
}

function validateTargets(targets, valid, label) {
  if (!Array.isArray(targets)) throw new Error(`${label} must be an array`);
  for (const target of targets) {
    if (!valid.includes(target)) {
      throw new Error(`${label}: unknown target "${target}" (known: ${valid.join(', ')})`);
    }
  }
}
