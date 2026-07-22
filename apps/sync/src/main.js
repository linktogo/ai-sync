import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { loadConfig as defaultLoadConfig } from '@ai-sync/config';
import { run as defaultRun } from '@ai-sync/skill-sync';

export async function main(argv, deps = {}) {
  const {
    loadConfig = defaultLoadConfig,
    runPipeline = defaultRun,
    logger = console,
  } = deps;

  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      pr: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'work-dir': { type: 'string' },
      repo: { type: 'string' },
    },
  });

  if (!values.config) throw new Error('Missing required --config <path>');

  const config = await loadConfig(values.config);
  const results = await runPipeline(config, {
    skillsDir: path.resolve('skills'),
    workDir: values['work-dir'] ?? path.join(os.tmpdir(), 'ai-sync'),
    pr: values.pr,
    dryRun: values['dry-run'],
    repoFilter: values.repo,
    logger,
  });

  return results.some((r) => r.status === 'error') ? 1 : 0;
}
