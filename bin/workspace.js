#!/usr/bin/env node
import { main } from '../src/workspace.js';

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (err) => {
    console.error(err.message);
    process.exitCode = 1;
  },
);
