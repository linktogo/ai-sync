import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { resolveHistoryPath, appendHistoryEntry } from './tokens.js';

export const STATES = ['todo', 'inprogress', 'question', 'done'];

export const MAX_EVENTS = 20;

export function resolveBoardPath({ board, env = process.env } = {}) {
  const p = board || env.AI_SYNC_BOARD;
  if (!p) throw new Error('No board path (pass --board <path> or set AI_SYNC_BOARD)');
  return path.resolve(p);
}

// board.json is disposable runtime state, regenerated continuously by hooks.
// Anything not already in the v2 `{ sessions: {...} }` shape (a v1 flat
// entry, or malformed data) is reset rather than migrated — hooks repopulate
// it within moments.
function normalizeRepoEntry(entry) {
  return entry?.sessions && typeof entry.sessions === 'object' ? entry : { sessions: {} };
}

export async function readBoard(boardPath, { read = readFile } = {}) {
  try {
    const parsed = JSON.parse(await read(boardPath, 'utf8'));
    const board = { ...parsed, version: 2, repos: { ...parsed.repos } };
    for (const [name, entry] of Object.entries(board.repos)) {
      board.repos[name] = normalizeRepoEntry(entry);
    }
    return board;
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 2, repos: {} };
    throw err;
  }
}

export async function writeBoard(boardPath, board, opts = {}) {
  const {
    write = writeFile,
    move = rename,
    ensureDir = mkdir,
    tmpSuffix = `.${process.pid}.tmp`,
  } = opts;
  await ensureDir(path.dirname(boardPath), { recursive: true });
  const tmp = `${boardPath}${tmpSuffix}`;
  await write(tmp, JSON.stringify(board, null, 2) + '\n');
  await move(tmp, boardPath);
}

export async function setSessionStatus(boardPath, repo, sessionId, state, opts = {}) {
  const {
    lastEvent = 'manual', title, lastPrompt, usage, startedAt, worktree,
    now = () => new Date().toISOString(), ...io
  } = opts;
  if (!STATES.includes(state)) {
    throw new Error(`Invalid state "${state}" (valid: ${STATES.join(', ')})`);
  }
  const board = await readBoard(boardPath, io);
  const at = now();
  const repoEntry = board.repos[repo] ?? { sessions: {} };
  const prevSession = repoEntry.sessions[sessionId];
  const events = [{ event: lastEvent, at }, ...(prevSession?.events ?? [])].slice(0, MAX_EVENTS);
  repoEntry.sessions[sessionId] = {
    status: state,
    updatedAt: at,
    lastEvent,
    title: prevSession?.title ?? title ?? null,               // set once, never overwritten
    lastPrompt: lastPrompt ?? prevSession?.lastPrompt ?? null, // overwritten every UserPromptSubmit
    startedAt: prevSession?.startedAt ?? startedAt ?? at,      // set once, never overwritten
    worktree: prevSession?.worktree ?? worktree ?? null,       // set once from the hook's --worktree flag
    usage: usage ?? prevSession?.usage ?? null,                // overwritten every Stop
    events,
  };
  board.repos[repo] = repoEntry;
  await writeBoard(boardPath, board, io);
  return board;
}

export async function removeSession(boardPath, repo, sessionId, opts = {}) {
  const board = await readBoard(boardPath, opts);
  if (board.repos[repo]) {
    delete board.repos[repo].sessions[sessionId];
  }
  await writeBoard(boardPath, board, opts);
  return board;
}

export async function closeSession(boardPath, repo, sessionId, opts = {}) {
  const {
    historyPath = resolveHistoryPath(boardPath),
    now = () => new Date().toISOString(),
    ...io
  } = opts;
  const board = await readBoard(boardPath, io);
  const session = board.repos[repo]?.sessions?.[sessionId];
  if (!session) return { closed: false };
  await appendHistoryEntry(historyPath, {
    repo, sessionId,
    title: session.title ?? null,
    startedAt: session.startedAt ?? null,
    endedAt: now(),
    usage: session.usage ?? null,
  }, io);
  delete board.repos[repo].sessions[sessionId];
  await writeBoard(boardPath, board, io);
  return { closed: true };
}

export async function initRepos(boardPath, repoNames, opts = {}) {
  const board = await readBoard(boardPath, opts);
  for (const name of repoNames) {
    if (!board.repos[name]) board.repos[name] = { sessions: {} };
  }
  await writeBoard(boardPath, board, opts);
  return board;
}
