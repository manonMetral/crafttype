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

/** Un module lit une propriété qu'il ne déclare pas, ou avec un autre type : défaut de définition du module. */
export class PropertyAccessError extends CraftTypeError {
  constructor(
    readonly key: string,
    reason: string,
  ) {
    super(`Propriété ${key} inaccessible : ${reason}`);
  }
}

/** La définition des propriétés d'un module est incohérente (clé réservée ou dupliquée, clé illisible en option). */
export class InvalidPropertyDefinitionError extends CraftTypeError {
  constructor(key: string, reason: string) {
    super(`Définition de la propriété ${key} invalide : ${reason}`);
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

/** Un module déclare deux fois le même fichier de destination : défaut de définition du module, pas du projet. */
export class DuplicateDestinationError extends CraftTypeError {
  constructor(readonly destination: string) {
    super(`Le module déclare deux fois le fichier ${destination}`);
  }
}

/** Un module veut modifier un fichier existant, mais le fichier ou son repère d'insertion est introuvable ou ambigu. */
export class NeedleError extends CraftTypeError {
  constructor(
    readonly path: string,
    readonly needle: string,
    reason: string,
  ) {
    super(`Impossible de modifier ${path} : ${reason} (${needle})`);
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
