import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { clone as defaultClone } from '@ai-sync/git';
import { resolveSkills as defaultResolveSkills } from './skills.js';
import { getRenderer as defaultGetRenderer } from '@ai-sync/renderers';

const BRANCH = 'ai-sync/update-skills';
const COMMIT_MESSAGE = 'chore: sync AI agent skills';
const PR_TITLE = 'Sync AI agent skills';
const PR_BODY = 'Automated skill sync from ai-sync.';

export async function run(config, options = {}) {
  const {
    skillsDir,
    workDir,
    pr = false,
    dryRun = false,
    repoFilter,
    clone = defaultClone,
    resolveSkills = defaultResolveSkills,
    getRenderer = defaultGetRenderer,
    logger = console,
  } = options;

  const repos = repoFilter
    ? config.repos.filter((repo) => repo.name === repoFilter)
    : config.repos;

  const results = [];
  for (const repo of repos) {
    try {
      results.push(await syncRepo(repo, {
        skillsDir, workDir, pr, dryRun, clone, resolveSkills, getRenderer, logger,
      }));
    } catch (err) {
      logger.error(`✗ ${repo.name}: ${err.message}`);
      results.push({ repo: repo.name, status: 'error', error: err.message });
    }
  }

  report(results, logger);
  return results;
}

async function syncRepo(repo, ctx) {
  const { skillsDir, workDir, pr, dryRun, clone, resolveSkills, getRenderer, logger } = ctx;
  const skills = await resolveSkills(skillsDir, repo.technologies, {
    warn: (m) => logger.warn(m),
  });

  const files = [];
  for (const skill of skills) {
    for (const target of repo.targets) {
      files.push(getRenderer(target).render(skill));
    }
  }

  if (dryRun) {
    for (const file of files) logger.log(`[dry-run] ${repo.name}: ${file.path}`);
    return { repo: repo.name, status: 'dry-run', files: files.length };
  }

  const dest = path.join(workDir, repo.name);
  await rm(dest, { recursive: true, force: true });
  const gitRepo = await clone(repo.url, dest);
  await gitRepo.checkoutBranch(BRANCH);

  for (const file of files) {
    const full = path.join(dest, file.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.content);
  }

  if (!(await gitRepo.hasChanges())) {
    logger.log(`= ${repo.name}: no changes`);
    return { repo: repo.name, status: 'skipped', files: files.length };
  }

  await gitRepo.commitAll(COMMIT_MESSAGE);
  await gitRepo.push(BRANCH);
  if (pr) await gitRepo.createPR(PR_TITLE, PR_BODY);

  logger.log(`✓ ${repo.name}: ${files.length} files pushed${pr ? ' + PR' : ''}`);
  return { repo: repo.name, status: pr ? 'pr' : 'pushed', files: files.length };
}

function report(results, logger) {
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  logger.log(`\nSummary: ${JSON.stringify(counts)}`);
}
