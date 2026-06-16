import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function defaultExec(file, args, options) {
  const { stdout } = await execFileAsync(file, args, options);
  return stdout;
}

export function createRepo(dir, { exec = defaultExec } = {}) {
  const git = (...args) => exec('git', args, { cwd: dir });
  return {
    dir,
    async checkoutBranch(branch) {
      await git('checkout', '-B', branch);
    },
    async hasChanges() {
      const out = await exec('git', ['status', '--porcelain'], { cwd: dir });
      return out.trim().length > 0;
    },
    async commitAll(message) {
      await git('add', '-A');
      await git('commit', '-m', message);
    },
    async push(branch) {
      await git('push', '-f', '-u', 'origin', branch);
    },
    async createPR(title, body) {
      await exec('gh', ['pr', 'create', '--title', title, '--body', body], { cwd: dir });
    },
  };
}

export async function clone(url, dir, { exec = defaultExec } = {}) {
  await exec('git', ['clone', url, dir], {});
  return createRepo(dir, { exec });
}
