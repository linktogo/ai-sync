#!/usr/bin/env node
import { select } from '@inquirer/prompts';
import { main } from '../src/workspace.js';

// Interactive single-project picker shown when --repo is omitted on a TTY.
function selectRepo(repos) {
  return select({
    message: 'Quel projet charger dans le workspace ?',
    choices: repos.map((repo) => ({
      name: `${repo.name} (${repo.technologies.join(', ')})`,
      value: repo.name,
    })),
  });
}

// Shown when a checkout already exists: reuse it, reinstall fresh, or clone
// into a new timestamped directory.
function onExisting(repo) {
  return select({
    message: `${repo.name} existe déjà dans le workspace. Que faire ?`,
    choices: [
      { name: 'Réutiliser le checkout existant', value: 'reuse' },
      { name: `Réinstaller à neuf (${repo.name}-reinstall)`, value: 'reinstall' },
      { name: `Nouveau dossier horodaté (${repo.name}-<timestamp>)`, value: 'timestamp' },
    ],
  });
}

main(process.argv.slice(2), { selectRepo, onExisting }).then(
  (code) => { process.exitCode = code; },
  (err) => {
    console.error(err.message);
    process.exitCode = 1;
  },
);
