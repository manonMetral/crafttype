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
  constructor(readonly key: string) {
    super(`Propriété obligatoire manquante : ${key}`);
  }
}

export class InvalidPropertyError extends CraftTypeError {
  constructor(
    readonly key: string,
    readonly reason: string,
  ) {
    super(`Propriété ${key} invalide : ${reason}`);
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

/** Le module modifierait des éléments existants du projet (fichiers, entrées du package.json) avec un contenu différent. */
export class ModuleConflictError extends CraftTypeError {
  constructor(readonly conflicts: readonly string[]) {
    super(`Le module écraserait des éléments existants différents :\n${conflicts.map((conflict) => `  - ${conflict}`).join('\n')}`);
  }
}

/** Un fichier du projet généré (package.json, historique) est illisible ou n'a pas la forme attendue. */
export class InvalidProjectFileError extends CraftTypeError {
  constructor(path: string, reason: string) {
    super(`Fichier ${path} invalide : ${reason}`);
  }
}
