import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig as defaultLoadConfig } from '@ai-sync/config';
import {
  bootstrap,
  resolveBoardPath,
  setStatus as defaultSetStatus,
} from '@ai-sync/workspace-bootstrap';

export async function main(argv, deps = {}) {
  const [sub, ...rest] = argv;
  if (sub === 'status') return runStatus(rest, deps);
  if (sub === 'bootstrap') return runBootstrapMain(rest, deps);
  return runBootstrapMain(argv, deps);
}

async function runStatus(argv, deps = {}) {
  const { setStatus = defaultSetStatus, logger = console } = deps;
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { board: { type: 'string' }, event: { type: 'string' } },
  });
  const [repo, state] = positionals;
  if (!repo || !state) throw new Error('Usage: ai-workspace status <repo> <state> [--board <path>] [--event <name>]');
  const boardPath = resolveBoardPath({ board: values.board });
  await setStatus(boardPath, repo, state, { lastEvent: values.event ?? 'manual' });
  logger.log(`${repo} → ${state}`);
  return 0;
}

async function runBootstrapMain(argv, deps = {}) {
  const {
    loadConfig = defaultLoadConfig,
    runBootstrap = bootstrap,
    selectRepo,
    onExisting,
    isInteractive = process.stdin.isTTY,
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
      offline: { type: 'boolean', default: false },
    },
  });

  if (!values.config) throw new Error('Missing required --config <path>');
  if (!values.workspace) throw new Error('Missing required --workspace <dir>');

  const config = await loadConfig(values.config);

  // Without an explicit --repo, prompt for a single project to load when
  // running interactively; non-interactive runs keep bootstrapping every repo.
  let repoFilter = values.repo;
  if (!repoFilter && isInteractive) {
    repoFilter = await selectRepo(config.repos);
  }

  await runBootstrap(config, {
    workspaceDir: path.resolve(values.workspace),
    editor: values.editor,
    repoFilter,
    worktree: values.worktree,
    install: !values['no-install'],
    dryRun: values['dry-run'],
    offline: values.offline,
    onExisting: isInteractive ? onExisting : undefined,
    hookCommand: fileURLToPath(new URL('../bin/workspace.js', import.meta.url)),
    logger,
  });

  return 0;
}
