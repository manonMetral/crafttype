import { UnknownPackageVersionError } from './errors.js';
import { frozenRecord } from './frozen.js';

export class PackageVersions {
  private readonly versions: Readonly<Record<string, string>>;

  constructor(versions: Readonly<Record<string, string>>) {
    this.versions = frozenRecord(versions);
  }

  get(packageName: string): string {
    const version = this.versions[packageName];
    if (version === undefined) {
      throw new UnknownPackageVersionError(packageName);
    }
    return version;
  }
}

/** Port: reads the version catalog (resources/generator/dependencies folder). */
export interface NodePackagesVersionsReader {
  /** `common` for the shared versions, or the name of a framework (`vue`). */
  get(source?: string): PackageVersions;
}
