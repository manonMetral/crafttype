import { posix } from 'node:path';
import type { PathNormalizer } from '../../domain/ports.js';

/** Adapter of the `PathNormalizer` port: the normalization is delegated to `node:path`, with `/` as separator. */
export class NodePathNormalizer implements PathNormalizer {
  normalize(path: string): string {
    return posix.normalize(path);
  }
}
