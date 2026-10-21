export class CraftTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownModuleError extends CraftTypeError {
  constructor(slug: string) {
    super(`Unknown module: ${slug}`);
  }
}

export class MissingPropertyError extends CraftTypeError {
  constructor(readonly key: string) {
    super(`Missing required property: ${key}`);
  }
}

export class InvalidPropertyError extends CraftTypeError {
  constructor(
    readonly key: string,
    readonly reason: string,
  ) {
    super(`Invalid property ${key}: ${reason}`);
  }
}

/** A module reads a property it does not declare, or with another type: a defect in the module definition. */
export class PropertyAccessError extends CraftTypeError {
  constructor(
    readonly key: string,
    reason: string,
  ) {
    super(`Property ${key} is not accessible: ${reason}`);
  }
}

/** The property definition of a module is inconsistent (reserved or duplicated key, key unusable as an option). */
export class InvalidPropertyDefinitionError extends CraftTypeError {
  constructor(key: string, reason: string) {
    super(`Invalid definition for property ${key}: ${reason}`);
  }
}

export class MissingModuleDependenciesError extends CraftTypeError {
  constructor(
    slug: string,
    readonly missing: readonly string[],
  ) {
    super(`Module ${slug} requires these modules to be applied first: ${missing.join(', ')}`);
  }
}

export class UnknownPackageVersionError extends CraftTypeError {
  constructor(packageName: string) {
    super(`Unknown version for ${packageName}: add it to resources/generator/dependencies`);
  }
}

/** A module declares the same destination file twice: a defect in the module definition, not in the project. */
export class DuplicateDestinationError extends CraftTypeError {
  constructor(readonly destination: string) {
    super(`The module declares the file ${destination} twice`);
  }
}

/** A module declares a destination that is not a file path inside the project folder: a defect in the module definition. */
export class InvalidDestinationError extends CraftTypeError {
  constructor(
    readonly destination: string,
    reason: string,
  ) {
    super(`Invalid destination "${destination}": ${reason}`);
  }
}

/** A module wants to modify an existing file, but the file or its insertion needle is missing or ambiguous. */
export class NeedleError extends CraftTypeError {
  constructor(
    readonly path: string,
    readonly needle: string,
    reason: string,
  ) {
    super(`Cannot modify ${path}: ${reason} (${needle})`);
  }
}

/** The module would change existing elements of the project (files, package.json entries) to different content. */
export class ModuleConflictError extends CraftTypeError {
  constructor(readonly conflicts: readonly string[]) {
    super(
      `The module would overwrite existing elements with different content:\n${conflicts.map((conflict) => `  - ${conflict}`).join('\n')}`,
    );
  }
}

/** A file of the generated project (package.json, history) is unreadable or does not have the expected shape. */
export class InvalidProjectFileError extends CraftTypeError {
  constructor(path: string, reason: string) {
    super(`Invalid file ${path}: ${reason}`);
  }
}
