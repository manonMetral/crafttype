import { gte, minVersion, satisfies, validRange } from 'semver';
import type { VersionComparator } from '../../domain/ports.js';

/** Adapter of the `VersionComparator` port: comparing versions and ranges is delegated to `semver`. */
export class SemverVersionComparator implements VersionComparator {
  keepsExistingVersion(existing: string, wanted: string): boolean {
    if (validRange(existing) === null || validRange(wanted) === null) {
      return false;
    }

    const existingMin = minVersion(existing);
    const wantedMin = minVersion(wanted);
    if (existingMin === null || wantedMin === null) {
      return false;
    }

    return satisfies(wantedMin, existing) || gte(existingMin, wantedMin);
  }
}
