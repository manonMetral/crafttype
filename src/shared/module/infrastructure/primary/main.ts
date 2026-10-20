#!/usr/bin/env node
import { createModulesApplicationService } from '../../../../composition.js';
import { runCli } from './cli.js';

process.exitCode = runCli(process.argv.slice(2), createModulesApplicationService(), console.log);
