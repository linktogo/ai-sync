import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const STATES = ['todo', 'inprogress', 'question', 'done'];

export const MAX_EVENTS = 20;

export function resolveBoardPath({ board, env = process.env } = {}) {
  const p = board || env.AI_SYNC_BOARD;
  if (!p) throw new Error('No board path (pass --board <path> or set AI_SYNC_BOARD)');
  return path.resolve(p);
}

export async function readBoard(boardPath, { read = readFile } = {}) {
  try {
    const parsed = JSON.parse(await read(boardPath, 'utf8'));
    const board = { version: 1, repos: {}, ...parsed };
    for (const entry of Object.values(board.repos)) {
      if (!Array.isArray(entry.events)) {
        entry.events = entry.lastEvent ? [{ event: entry.lastEvent, at: entry.updatedAt ?? null }] : [];
      }
    }
    return board;
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 1, repos: {} };
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

export async function setStatus(boardPath, repo, state, opts = {}) {
  const { lastEvent = 'manual', now = () => new Date().toISOString(), ...io } = opts;
  if (!STATES.includes(state)) {
    throw new Error(`Invalid state "${state}" (valid: ${STATES.join(', ')})`);
  }
  const board = await readBoard(boardPath, io);
  const at = now();
  const prev = board.repos[repo];
  const events = [{ event: lastEvent, at }, ...(prev?.events ?? [])].slice(0, MAX_EVENTS);
  board.repos[repo] = { status: state, updatedAt: at, lastEvent, events };
  await writeBoard(boardPath, board, io);
  return board;
}

export async function initRepos(boardPath, repoNames, opts = {}) {
  const { now = () => new Date().toISOString(), ...io } = opts;
  const board = await readBoard(boardPath, io);
  for (const name of repoNames) {
    if (!board.repos[name]) {
      const at = now();
      board.repos[name] = { status: 'todo', updatedAt: at, lastEvent: 'init', events: [{ event: 'init', at }] };
    }
  }
  await writeBoard(boardPath, board, io);
  return board;
}
