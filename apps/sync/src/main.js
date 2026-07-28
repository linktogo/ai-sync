import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { resolveConfigSource } from '@ai-sync/config';
import { run as defaultRun } from '@ai-sync/skill-sync';

export async function main(argv, deps = {}) {
  const {
    loadConfig,
    loadConfigFromRepo,
    runPipeline = defaultRun,
    logger = console,
  } = deps;

  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      'config-repo': { type: 'string' },
      'config-file': { type: 'string' },
      pr: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      'work-dir': { type: 'string' },
      repo: { type: 'string' },
    },
  });

  const config = await resolveConfigSource(
    { config: values.config, configRepo: values['config-repo'], configFile: values['config-file'] },
    { loadConfig, loadConfigFromRepo },
  );
  const results = await runPipeline(config, {
    skillsDir: path.resolve('skills'),
    workDir: values['work-dir'] ?? path.join(os.tmpdir(), 'ai-sync'),
    pr: values.pr,
    dryRun: values['dry-run'],
    strict: values.strict,
    repoFilter: values.repo,
    logger,
  });

  return results.some((r) => r.status === 'error') ? 1 : 0;
}
