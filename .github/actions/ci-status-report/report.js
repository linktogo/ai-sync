#!/usr/bin/env node
// Deposits this run's CI status into the ai-sync `ci-status` branch as
// updates/<login>/<repo>.json. Imported by relative path so the runner needs no
// npm install: both libs are dependency-free.
import { readFile, writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildUpdate, parseUpdate } from '../../../libs/ci-status/src/ci-status.js';
import { clone } from '../../../libs/git/src/git.js';

const ATTEMPTS = 5;

async function readEvent(file) {
  if (!file) return {};
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

// Reset-and-rewrite rather than rebase: each attempt lays our single file on top
// of whatever the remote currently holds, so there is never a conflict to
// resolve. The runId comparison stops two runs landing out of order from
// flip-flopping the file.
async function deposit(repo, dir, update, branch) {
  const rel = path.join('updates', update.actor, `${update.repo}.json`);
  const file = path.join(dir, rel);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const existing = await readFile(file, 'utf8').catch(() => null);
    if (existing) {
      const parsed = parseUpdate(existing, { login: update.actor, repo: update.repo });
      if (parsed.ok && parsed.update.runId > update.runId) {
        console.log(`ai-sync: run ${parsed.update.runId} already reported, skipping ${update.runId}`);
        return;
      }
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(update, null, 2)}\n`);
    if (!(await repo.hasChanges())) {
      console.log('ai-sync: status unchanged, nothing to push');
      return;
    }
    await repo.commitAll(`chore(ci-status): ${update.actor}/${update.repo} ${update.conclusion ?? update.status}`);
    try {
      await repo.push(branch);
      console.log(`ai-sync: reported ${rel}`);
      return;
    } catch (err) {
      if (attempt === ATTEMPTS) throw err;
      console.log(`ai-sync: push rejected (attempt ${attempt}/${ATTEMPTS}), retrying`);
      await new Promise((r) => setTimeout(r, 2 ** attempt * 250));
      await repo.fetchReset(branch);
    }
  }
}

const { INPUT_TOKEN, INPUT_STATUS_REPO, INPUT_BRANCH, GITHUB_EVENT_PATH } = process.env;
const url = `https://x-access-token:${INPUT_TOKEN}@github.com/${INPUT_STATUS_REPO}.git`;
const update = buildUpdate(process.env, await readEvent(GITHUB_EVENT_PATH), new Date().toISOString());
const dir = path.join(await mkdtemp(path.join(tmpdir(), 'ai-sync-status-')), 'repo');

try {
  const repo = await clone(url, dir, { depth: 1, branch: INPUT_BRANCH });
  await repo.configureIdentity('ai-sync[bot]', 'ai-sync@users.noreply.github.com');
  await deposit(repo, dir, update, INPUT_BRANCH);
} catch (err) {
  // Never let the token reach the log, even through a git error message.
  console.error(`ai-sync: ${String(err.message).split(INPUT_TOKEN).join('***')}`);
  process.exit(1);
} finally {
  await rm(path.dirname(dir), { recursive: true, force: true });
}
