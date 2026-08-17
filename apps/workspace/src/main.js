import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfigSource } from '@linktogo/maggie-config';
import {
  bootstrap,
  resolveBoardPath,
  readBoard as defaultReadBoard,
  setSessionStatus as defaultSetSessionStatus,
  removeSession as defaultRemoveSession,
  readTranscriptUsage as defaultReadTranscriptUsage,
  resolveHistoryPath,
  appendHistoryEntry as defaultAppendHistoryEntry,
} from '@linktogo/maggie-workspace-bootstrap';

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
  const {
    setSessionStatus = defaultSetSessionStatus,
    readTranscriptUsage = defaultReadTranscriptUsage,
    logger = console,
    stdin = process.stdin,
  } = deps;
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { board: { type: 'string' }, event: { type: 'string' }, session: { type: 'string' } },
  });
  const [repo, state] = positionals;
  if (!repo || !state) throw new Error('Usage: maggie-workspace status <repo> <state> [--board <path>] [--event <name>] [--session <id>]');
  const boardPath = resolveBoardPath({ board: values.board });
  const payload = await readStdinJSON(stdin);
  const sessionId = values.session ?? payload.session_id ?? 'manual';
  const opts = { lastEvent: values.event ?? 'manual' };
  if (payload.hook_event_name === 'UserPromptSubmit' && typeof payload.prompt === 'string') {
    opts.title = truncate(payload.prompt, TITLE_MAX);
    opts.lastPrompt = payload.prompt;
  }
  if (payload.hook_event_name === 'Stop' && typeof payload.transcript_path === 'string') {
    opts.usage = await readTranscriptUsage(payload.transcript_path);
  }
  await setSessionStatus(boardPath, repo, sessionId, state, opts);
  logger.log(`${repo} [${sessionId}] → ${state}`);
  return 0;
}

async function runSessionEnd(argv, deps = {}) {
  const {
    removeSession = defaultRemoveSession,
    readBoard = defaultReadBoard,
    readTranscriptUsage = defaultReadTranscriptUsage,
    appendHistoryEntry = defaultAppendHistoryEntry,
    now = () => new Date().toISOString(),
    logger = console,
    stdin = process.stdin,
  } = deps;
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { board: { type: 'string' } },
  });
  const [repo] = positionals;
  if (!repo) throw new Error('Usage: maggie-workspace session-end <repo> [--board <path>]');
  const boardPath = resolveBoardPath({ board: values.board });
  const payload = await readStdinJSON(stdin);
  const sessionId = payload.session_id ?? 'manual';

  // Removing the session from the board is the load-bearing behavior here —
  // a failure recording token-usage history must never leave a zombie card
  // stuck on the board forever (SessionEnd only fires once).
  try {
    const board = await readBoard(boardPath);
    const session = board.repos[repo]?.sessions?.[sessionId];
    if (session) {
      const usage = typeof payload.transcript_path === 'string'
        ? await readTranscriptUsage(payload.transcript_path)
        : session.usage ?? null;
      await appendHistoryEntry(resolveHistoryPath(boardPath), {
        repo,
        sessionId,
        title: session.title ?? null,
        startedAt: session.startedAt ?? null,
        endedAt: now(),
        usage,
      });
    }
  } catch (err) {
    logger.warn(`${repo} [${sessionId}] failed to record token-usage history: ${err.message}`);
  }

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
