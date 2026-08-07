import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfigSource } from '@linktogo/ai-config';
import {
  bootstrap,
  resolveBoardPath,
  setSessionStatus as defaultSetSessionStatus,
  removeSession as defaultRemoveSession,
} from '@linktogo/ai-workspace-bootstrap';

const TITLE_MAX = 60;

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function readStdinJSON(stdin) {
  if (stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function main(argv, deps = {}) {
  const [sub, ...rest] = argv;
  if (sub === 'status') return runStatus(rest, deps);
  if (sub === 'session-end') return runSessionEnd(rest, deps);
  if (sub === 'bootstrap') return runBootstrapMain(rest, deps);
  return runBootstrapMain(argv, deps);
}

async function runStatus(argv, deps = {}) {
  const { setSessionStatus = defaultSetSessionStatus, logger = console, stdin = process.stdin } = deps;
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { board: { type: 'string' }, event: { type: 'string' }, session: { type: 'string' } },
  });
  const [repo, state] = positionals;
  if (!repo || !state) throw new Error('Usage: ai-workspace status <repo> <state> [--board <path>] [--event <name>] [--session <id>]');
  const boardPath = resolveBoardPath({ board: values.board });
  const payload = await readStdinJSON(stdin);
  const sessionId = values.session ?? payload.session_id ?? 'manual';
  const opts = { lastEvent: values.event ?? 'manual' };
  if (payload.hook_event_name === 'UserPromptSubmit' && typeof payload.prompt === 'string') {
    opts.title = truncate(payload.prompt, TITLE_MAX);
    opts.lastPrompt = payload.prompt;
  }
  await setSessionStatus(boardPath, repo, sessionId, state, opts);
  logger.log(`${repo} [${sessionId}] → ${state}`);
  return 0;
}

async function runSessionEnd(argv, deps = {}) {
  const { removeSession = defaultRemoveSession, logger = console, stdin = process.stdin } = deps;
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { board: { type: 'string' } },
  });
  const [repo] = positionals;
  if (!repo) throw new Error('Usage: ai-workspace session-end <repo> [--board <path>]');
  const boardPath = resolveBoardPath({ board: values.board });
  const payload = await readStdinJSON(stdin);
  const sessionId = payload.session_id ?? 'manual';
  await removeSession(boardPath, repo, sessionId);
  logger.log(`${repo} [${sessionId}] session ended`);
  return 0;
}

async function runBootstrapMain(argv, deps = {}) {
  const {
    loadConfig,
    loadConfigFromRepo,
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
      'config-repo': { type: 'string' },
      'config-file': { type: 'string' },
      workspace: { type: 'string' },
      editor: { type: 'string', default: 'claude' },
      repo: { type: 'string' },
      worktree: { type: 'string' },
      'no-install': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
    },
  });

  const config = await resolveConfigSource(
    { config: values.config, configRepo: values['config-repo'], configFile: values['config-file'] },
    { loadConfig, loadConfigFromRepo },
  );
  if (!values.workspace) throw new Error('Missing required --workspace <dir>');

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
