/**
 * Base of the errors of the tool. Every subclass has a literal `kind`, which makes the union `DomainError` a
 * discriminated union: a `switch` on `kind` is checked for exhaustiveness by the compiler.
 */
export abstract class CraftTypeError extends Error {
  abstract readonly kind: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownModuleError extends CraftTypeError {
  readonly kind = 'unknown-module' as const;

  constructor(slug: string) {
    super(`Unknown module: ${slug}`);
  }
}

export class MissingPropertyError extends CraftTypeError {
  readonly kind = 'missing-property' as const;

  constructor(readonly key: string) {
    super(`Missing required property: ${key}`);
  }
}

export class InvalidPropertyError extends CraftTypeError {
  readonly kind = 'invalid-property' as const;

  constructor(
    readonly key: string,
    readonly reason: string,
  ) {
    super(`Invalid property ${key}: ${reason}`);
  }
}

/** A module reads a property it does not declare, or with another type: a defect in the module definition. */
export class PropertyAccessError extends CraftTypeError {
  readonly kind = 'property-access' as const;

  constructor(
    readonly key: string,
    reason: string,
  ) {
    super(`Property ${key} is not accessible: ${reason}`);
  }
}

/** The property definition of a module is inconsistent (reserved or duplicated key, key unusable as an option). */
export class InvalidPropertyDefinitionError extends CraftTypeError {
  readonly kind = 'invalid-property-definition' as const;

  constructor(key: string, reason: string) {
    super(`Invalid definition for property ${key}: ${reason}`);
  }
}

export class MissingModuleDependenciesError extends CraftTypeError {
  readonly kind = 'missing-module-dependencies' as const;

  constructor(
    slug: string,
    readonly missing: readonly string[],
  ) {
    super(`Module ${slug} requires these modules to be applied first: ${missing.join(', ')}`);
  }
}

export class UnknownPackageVersionError extends CraftTypeError {
  readonly kind = 'unknown-package-version' as const;

  constructor(packageName: string) {
    super(`Unknown version for ${packageName}: add it to resources/generator/dependencies`);
  }
}

/** A module declares the same destination file twice: a defect in the module definition, not in the project. */
export class DuplicateDestinationError extends CraftTypeError {
  readonly kind = 'duplicate-destination' as const;

  constructor(readonly destination: string) {
    super(`The module declares the file ${destination} twice`);
  }
}

/** A module declares a destination that is not a file path inside the project folder: a defect in the module definition. */
export class InvalidDestinationError extends CraftTypeError {
  readonly kind = 'invalid-destination' as const;

  constructor(
    readonly destination: string,
    reason: string,
  ) {
    super(`Invalid destination "${destination}": ${reason}`);
  }
}

/** A module wants to modify an existing file, but the file or its insertion needle is missing or ambiguous. */
export class NeedleError extends CraftTypeError {
  readonly kind = 'needle' as const;

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
  readonly kind = 'module-conflict' as const;

  constructor(readonly conflicts: readonly string[]) {
    super(
      `The module would overwrite existing elements with different content:\n${conflicts.map((conflict) => `  - ${conflict}`).join('\n')}`,
    );
  }
}

/** A file of the generated project (package.json, history) is unreadable or does not have the expected shape. */
export class InvalidProjectFileError extends CraftTypeError {
  readonly kind = 'invalid-project-file' as const;

  constructor(path: string, reason: string) {
    super(`Invalid file ${path}: ${reason}`);
  }
}

/** Every error of the tool: add a new error class here too, the `switch` on `kind` of the CLI then no longer compiles until it handles it. */
export type DomainError =
  | UnknownModuleError
  | MissingPropertyError
  | InvalidPropertyError
  | PropertyAccessError
  | InvalidPropertyDefinitionError
  | MissingModuleDependenciesError
  | UnknownPackageVersionError
  | DuplicateDestinationError
  | InvalidDestinationError
  | NeedleError
  | ModuleConflictError
  | InvalidProjectFileError;

/** `CraftTypeError` is abstract: any instance is one of the classes of `DomainError`. */
export const isDomainError = (error: unknown): error is DomainError => error instanceof CraftTypeError;
