import { readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { defaultExec } from '@ai-sync/git';
import { parseUpdate, buildState, normalizeState } from '@ai-sync/ci-status';

const EMPTY = { version: 1, lastSyncAt: null, lastSyncError: null, repos: {} };

// Read-only consumer of the ci-status branch. It never writes to the branch:
// every board reads every contributor's folder, so a board that also deleted
// would erase updates another board has not read yet.
export function createCiReader({
  statusRepo = null,
  token = null,
  branch = 'ci-status',
  stateFile,
  cacheDir,
  exec = defaultExec,
  now = () => new Date().toISOString(),
  logger = console,
} = {}) {
  let running = false;

  // A git error message embeds the URL we passed it, token and all.
  function redact(message) {
    return token ? String(message).split(token).join('***') : String(message);
  }

  function cloneUrl() {
    if (!token) return statusRepo;
    return statusRepo.replace(/^https:\/\//, `https://x-access-token:${token}@`);
  }

  async function syncCheckout() {
    if (!existsSync(path.join(cacheDir, '.git'))) {
      await mkdir(path.dirname(cacheDir), { recursive: true });
      await exec('git', ['clone', '--depth', '1', '--branch', branch, '--single-branch', cloneUrl(), cacheDir], {});
      return;
    }
    await exec('git', ['fetch', '--depth', '1', 'origin', branch], { cwd: cacheDir });
    await exec('git', ['reset', '--hard', `origin/${branch}`], { cwd: cacheDir });
  }

  async function readEntries() {
    const root = path.join(cacheDir, 'updates');
    const logins = await readdir(root).catch(() => []);
    const entries = [];
    for (const login of logins) {
      // A non-directory here (`.gitkeep`) makes readdir throw ENOTDIR: skip it.
      const files = await readdir(path.join(root, login)).catch(() => []);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const repo = file.slice(0, -'.json'.length);
        const raw = await readFile(path.join(root, login, file), 'utf8');
        const parsed = parseUpdate(raw, { login, repo });
        if (!parsed.ok) {
          logger.warn(`  ⚠ ci: skipping updates/${login}/${file}: ${parsed.reason}`);
          continue;
        }
        entries.push({ login, repo, update: parsed.update });
      }
    }
    return entries;
  }

  async function readState() {
    try {
      return JSON.parse(await readFile(stateFile, 'utf8'));
    } catch {
      return EMPTY;
    }
  }

  async function writeState(state) {
    const tmp = `${stateFile}.tmp`;
    await mkdir(path.dirname(stateFile), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`);
    await rename(tmp, stateFile);
  }

  async function tick() {
    if (!statusRepo || running) return;
    running = true;
    try {
      await syncCheckout();
      const { repos } = buildState(await readEntries(), now());
      await writeState({ version: 1, lastSyncAt: now(), lastSyncError: null, repos });
    } catch (err) {
      const previous = await readState();
      await writeState({ ...previous, lastSyncError: redact(err.message) });
      logger.warn(`  ⚠ ci: sync failed: ${redact(err.message)}`);
    } finally {
      running = false;
    }
  }

  async function read(names = null) {
    const generatedAt = now();
    if (!statusRepo) {
      const repos = Object.fromEntries(
        (names ?? []).map((n) => [n, { users: {}, unavailable: 'status repo not configured' }]),
      );
      return { generatedAt, lastSyncError: null, repos };
    }
    const state = await readState();
    const wanted = names ?? Object.keys(state.repos ?? {});
    const repos = {};
    for (const name of wanted) {
      const users = state.repos?.[name]?.users ?? {};
      repos[name] = {
        users: Object.fromEntries(
          Object.entries(users).map(([login, run]) => [
            login,
            { state: normalizeState(run.status, run.conclusion), run },
          ]),
        ),
      };
    }
    return { generatedAt, lastSyncError: state.lastSyncError ?? null, repos };
  }

  return { tick, read };
}
