import { parseArgs } from 'node:util';
import path from 'node:path';
import { mkdir, access } from 'node:fs/promises';
import { clone as defaultClone, defaultExec } from './git.js';
import { loadConfig as defaultLoadConfig } from './config.js';

const EDITORS = {
  claude: (dir) => `cd ${dir} && claude`,
  vscode: (dir) => `code ${dir}`,
};

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function bootstrap(config, options = {}) {
  const {
    workspaceDir,
    editor = 'claude',
    repoFilter,
    worktree,
    install = true,
    dryRun = false,
    clone = defaultClone,
    exec = defaultExec,
    exists = pathExists,
    logger = console,
  } = options;

  if (!workspaceDir) throw new Error('bootstrap requires a workspaceDir');
  if (!EDITORS[editor]) {
    throw new Error(`Unknown editor "${editor}" (known: ${Object.keys(EDITORS).join(', ')})`);
  }
  if (worktree && editor !== 'claude') {
    throw new Error('--worktree is only supported with --editor claude');
  }

  const tag = dryRun ? '[dry-run] ' : '';
  const repos = repoFilter
    ? config.repos.filter((r) => r.name === repoFilter)
    : config.repos;

  if (!dryRun) await mkdir(workspaceDir, { recursive: true });

  const results = [];
  const workDirs = [];
  for (const repo of repos) {
    const checkout = path.join(workspaceDir, repo.name);

    let status;
    if (await exists(checkout)) {
      logger.log(`${tag}= ${repo.name}: reusing existing checkout`);
      status = 'reused';
    } else {
      if (!dryRun) await clone(repo.url, checkout);
      logger.log(`${tag}✓ ${repo.name}: ${dryRun ? 'would clone' : 'cloned'}`);
      status = 'cloned';
    }

    let workDir = checkout;
    if (worktree) {
      const wt = path.join(workspaceDir, `${repo.name}.${worktree.replace(/\//g, '-')}`);
      if (await exists(wt)) {
        logger.log(`  ${tag}${repo.name}: reusing worktree ${path.basename(wt)}`);
      } else {
        if (!dryRun) await exec('git', ['-C', checkout, 'worktree', 'add', wt, '-b', worktree], {});
        logger.log(`  ${tag}${repo.name}: ${dryRun ? 'would add' : 'added'} worktree ${path.basename(wt)} (${worktree})`);
      }
      workDir = wt;
    }
    workDirs.push(workDir);

    let installed = false;
    if (install && (await exists(path.join(workDir, 'package.json')))) {
      if (!dryRun) await exec('pnpm', ['install'], { cwd: workDir });
      logger.log(`  ${tag}${repo.name}: ${dryRun ? 'would pnpm install' : 'pnpm install done'}`);
      installed = true;
    }

    results.push({ repo: repo.name, status, installed });
  }

  const launchDir = worktree && workDirs.length === 1 ? workDirs[0] : workspaceDir;
  const command = EDITORS[editor](launchDir);
  logger.log(`\nWorkspace ready at ${workspaceDir}`);
  logger.log(`Launch ${editor}:\n  ${command}`);
  if (editor === 'claude' && !worktree) {
    logger.log('\n→ Tip: isolate your work in a git worktree with --worktree <branch>');
  }

  return { workspaceDir, editor, command, results };
}

export async function main(argv, deps = {}) {
  const {
    loadConfig = defaultLoadConfig,
    runBootstrap = bootstrap,
    logger = console,
  } = deps;

  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      workspace: { type: 'string' },
      editor: { type: 'string', default: 'claude' },
      repo: { type: 'string' },
      worktree: { type: 'string' },
      'no-install': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  if (!values.config) throw new Error('Missing required --config <path>');
  if (!values.workspace) throw new Error('Missing required --workspace <dir>');

  const config = await loadConfig(values.config);
  await runBootstrap(config, {
    workspaceDir: path.resolve(values.workspace),
    editor: values.editor,
    repoFilter: values.repo,
    worktree: values.worktree,
    install: !values['no-install'],
    dryRun: values['dry-run'],
    logger,
  });

  return 0;
}
