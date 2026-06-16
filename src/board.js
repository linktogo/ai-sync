import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const STATES = ['todo', 'inprogress', 'question', 'done'];

export function resolveBoardPath({ board, env = process.env } = {}) {
  const p = board || env.AI_SYNC_BOARD;
  if (!p) throw new Error('No board path (pass --board <path> or set AI_SYNC_BOARD)');
  return path.resolve(p);
}

export async function readBoard(boardPath, { read = readFile } = {}) {
  try {
    const parsed = JSON.parse(await read(boardPath, 'utf8'));
    return { version: 1, repos: {}, ...parsed };
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
  board.repos[repo] = { status: state, updatedAt: now(), lastEvent };
  await writeBoard(boardPath, board, io);
  return board;
}
