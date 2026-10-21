#!/usr/bin/env node
import { createModulesApplicationService, packageVersion } from '../../../../composition.js';
import { runCli } from './cli.js';

process.exitCode = runCli(process.argv.slice(2), createModulesApplicationService(), {
  out: console.log,
  err: console.error,
  version: packageVersion(),
});
