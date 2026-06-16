import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const STATES = ['todo', 'inprogress', 'question', 'done'];

export function resolveBoardPath({ board, env = process.env } = {}) {
  const p = board || env.AI_SYNC_BOARD;
  if (!p) throw new Error('No board path (pass --board <path> or set AI_SYNC_BOARD)');
  return path.resolve(p);
}
