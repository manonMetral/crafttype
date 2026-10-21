import { afterAll } from 'vitest';
import { removeTmpDirsOfTests } from './tmpDirs.js';

afterAll(removeTmpDirsOfTests);
