import { UnknownPackageVersionError } from './errors.js';

export class PackageVersions {
  constructor(private readonly versions: Readonly<Record<string, string>>) {}

  get(packageName: string): string {
    const version = this.versions[packageName];
    if (version === undefined) {
      throw new UnknownPackageVersionError(packageName);
    }
    return version;
  }
}

/** Port : lit le catalogue de versions (dossier resources/generator/dependencies). */
export interface NodePackagesVersionsReader {
  /** `common` pour les versions partagées, ou le nom d'un framework (`vue`). */
  get(source?: string): PackageVersions;
}
