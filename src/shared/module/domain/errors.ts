export class CraftTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownModuleError extends CraftTypeError {
  constructor(slug: string) {
    super(`Module inconnu : ${slug}`);
  }
}

export class MissingPropertyError extends CraftTypeError {
  constructor(key: string) {
    super(`Propriété obligatoire manquante : ${key}`);
  }
}

export class MissingModuleDependenciesError extends CraftTypeError {
  constructor(slug: string, missing: readonly string[]) {
    super(`Le module ${slug} requiert d'abord : ${missing.join(', ')}`);
  }
}

export class UnknownPackageVersionError extends CraftTypeError {
  constructor(packageName: string) {
    super(`Version inconnue pour ${packageName} : à ajouter dans resources/generator/dependencies`);
  }
}
