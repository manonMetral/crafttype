import type { Catalog, ConflictPolicy, ModuleInfo, PreviewRequest, PropertyInfo, PropertyValue } from './types';

export interface BasketEntry {
  readonly slug: string;
  /** Added because a module needs it, not chosen: it goes when nothing needs it any more. */
  readonly auto: boolean;
}
export type Basket = readonly BasketEntry[];

const find = (catalog: Catalog, slug: string): ModuleInfo | undefined =>
  catalog.modules.find((module) => module.slug === slug);

/** The modules of the catalog that bring a capability, in the order of the catalog. */
const providersOf = (catalog: Catalog, capability: string): readonly ModuleInfo[] =>
  catalog.modules.filter(({ provides }) => provides.includes(capability));

export interface Exclusion {
  readonly capability: string;
  /** The module, in the project or in the basket, that brings the capability already. */
  readonly by: string;
}

/**
 * The module that keeps another one out: a project has at most one module for a capability, so a module that provides
 * what the project or the basket already has from another module cannot be added.
 */
export const exclusionOf = (
  catalog: Catalog,
  applied: ReadonlySet<string>,
  basket: Basket,
  slug: string,
): Exclusion | undefined => {
  const inBasket = new Set(basket.map((entry) => entry.slug));
  for (const capability of find(catalog, slug)?.provides ?? []) {
    const by = providersOf(catalog, capability).find(
      (provider) => provider.slug !== slug && (applied.has(provider.slug) || inBasket.has(provider.slug)),
    );
    if (by !== undefined) {
      return { capability, by: by.slug };
    }
  }
  return undefined;
};

/**
 * Puts a module in the basket, chosen, with what it needs and the project does not have, flagged as added
 * automatically. What was taken out by hand is not brought back by the modules that already needed it. A capability
 * is brought by its module when only one provides it: when several do, the person chooses, so none is added. A module
 * that another module of the project or of the basket keeps out is not added.
 */
export const addModule = (catalog: Catalog, applied: ReadonlySet<string>, basket: Basket, slug: string): Basket => {
  const wanted = find(catalog, slug);
  if (wanted === undefined || applied.has(slug) || exclusionOf(catalog, applied, basket, slug) !== undefined) {
    return basket;
  }
  const entries = new Map(basket.map((entry) => [entry.slug, entry]));
  entries.set(slug, { slug, auto: false });

  const bring = (module: ModuleInfo): void => {
    entries.set(module.slug, { slug: module.slug, auto: true });
    addPrerequisitesOf(module);
  };
  const addPrerequisitesOf = (module: ModuleInfo): void => {
    for (const dependency of module.dependsOn) {
      const known = find(catalog, dependency);
      if (!applied.has(dependency) && !entries.has(dependency) && known !== undefined) {
        bring(known);
      }
    }
    for (const capability of module.requires) {
      const providers = providersOf(catalog, capability);
      const there = providers.some(({ slug: provider }) => applied.has(provider) || entries.has(provider));
      const [only] = providers;
      if (!there && providers.length === 1 && only !== undefined) {
        bring(only);
      }
    }
  };
  addPrerequisitesOf(wanted);
  return [...entries.values()];
};

/** Takes a module out of the basket, then what was added automatically and nothing needs any more. */
export const removeModule = (catalog: Catalog, basket: Basket, slug: string): Basket => {
  if (!basket.some((entry) => entry.slug === slug)) {
    return basket;
  }
  const remaining = basket.filter((entry) => entry.slug !== slug);
  const inRemaining = new Set(remaining.map((entry) => entry.slug));

  const needed = new Set<string>();
  const need = (module: string): void => {
    if (!needed.has(module)) {
      needed.add(module);
      visit(module);
    }
  };
  const visit = (module: string): void => {
    const known = find(catalog, module);
    known?.dependsOn.forEach(need);
    // What brings a capability the module requires: the modules of the basket that provide it.
    for (const capability of known?.requires ?? []) {
      providersOf(catalog, capability)
        .filter((provider) => inRemaining.has(provider.slug))
        .forEach((provider) => need(provider.slug));
    }
  };
  remaining.filter(({ auto }) => !auto).forEach(({ slug: chosen }) => visit(chosen));

  return remaining.filter(({ auto, slug: kept }) => !auto || needed.has(kept));
};

/** In the order of the catalog, which lists a module after the modules it depends on. */
export const inCatalogOrder = (catalog: Catalog, basket: Basket): Basket => {
  const entries = new Map(basket.map((entry) => [entry.slug, entry]));
  return catalog.modules.flatMap(({ slug }) => entries.get(slug) ?? []);
};

export interface Need {
  /** A module, or a capability with the module that brings it (`front: vue-app`) or those that could. */
  readonly name: string;
  readonly status: 'applied' | 'in-basket' | 'missing';
}

/**
 * What a module needs, each as the project has it, the basket holds it, or neither: the modules it depends on, then the
 * capabilities it requires. A capability is met by any module that provides it, the one of the project first.
 */
export const listNeeds = (
  catalog: Catalog,
  applied: ReadonlySet<string>,
  inBasket: ReadonlySet<string>,
  module: ModuleInfo,
): readonly Need[] => {
  const modules = module.dependsOn.map((slug): Need => ({
    name: slug,
    status: applied.has(slug) ? 'applied' : inBasket.has(slug) ? 'in-basket' : 'missing',
  }));
  const capabilities = module.requires.map((capability): Need => {
    const providers = providersOf(catalog, capability).map(({ slug }) => slug);
    const there = providers.find((slug) => applied.has(slug));
    const brought = providers.find((slug) => inBasket.has(slug));
    if (there !== undefined) {
      return { name: `${capability}: ${there}`, status: 'applied' };
    }
    return brought !== undefined
      ? { name: `${capability}: ${brought}`, status: 'in-basket' }
      : { name: `${capability}: ${providers.join(' or ')}`, status: 'missing' };
  });
  return [...modules, ...capabilities];
};

/** What a module of the basket needs, that the project does not have and the basket does not bring. */
export const missingPrerequisites = (
  catalog: Catalog,
  applied: ReadonlySet<string>,
  basket: Basket,
  slug: string,
): readonly string[] => {
  const module = find(catalog, slug);
  if (module === undefined) {
    return [];
  }
  const inBasket = new Set(basket.map((entry) => entry.slug));
  return listNeeds(catalog, applied, inBasket, module)
    .filter(({ status }) => status === 'missing')
    .map(({ name }) => name);
};

export interface SharedProperty extends PropertyInfo {
  /** The modules of the basket that read it, in the order of the catalog. */
  readonly usedBy: readonly string[];
}

/** The properties of the modules of the basket, each once: several modules read `serverPort`, it is asked once. */
export const sharedProperties = (catalog: Catalog, basket: Basket): readonly SharedProperty[] => {
  const shared = new Map<string, SharedProperty>();
  for (const { slug, properties } of inCatalogOrder(catalog, basket).flatMap(({ slug }) => find(catalog, slug) ?? [])) {
    for (const property of properties) {
      const known = shared.get(property.key);
      shared.set(
        property.key,
        known === undefined
          ? { ...property, usedBy: [slug] }
          : { ...known, mandatory: known.mandatory || property.mandatory, usedBy: [...known.usedBy, slug] },
      );
    }
  }
  return [...shared.values()];
};

/** The value the project proposes for each shared property: that of the first module of the catalog that has one. */
export const presetValues = (
  catalog: Catalog,
  basket: Basket,
  presets: Readonly<Record<string, Readonly<Record<string, PropertyValue>>>>,
): Readonly<Record<string, PropertyValue>> => {
  const proposals = inCatalogOrder(catalog, basket)
    .flatMap(({ slug }) => find(catalog, slug) ?? [])
    .flatMap(({ slug, properties }) =>
      properties.flatMap(({ key }) => {
        const proposed = presets[slug]?.[key];
        return proposed === undefined ? [] : [[key, proposed] as const];
      }),
    );
  // `Object.fromEntries` keeps the last entry of a key: the order is reversed so that the first module of the catalog wins.
  return Object.fromEntries([...proposals].reverse());
};

/**
 * What to send to preview the basket. A value that is empty is left out so that the module uses its default (the
 * server refuses a property that no module of the basket reads, so those are left out too).
 */
export const toRequest = (
  catalog: Catalog,
  basket: Basket,
  values: Readonly<Record<string, PropertyValue | undefined>>,
  onConflict: ConflictPolicy,
  projectFolder: string | undefined,
): PreviewRequest => {
  const read = new Set(sharedProperties(catalog, basket).map(({ key }) => key));
  const properties = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => read.has(key) && value !== undefined && value !== ''),
  ) as Record<string, PropertyValue>;
  return {
    ...(projectFolder === undefined || projectFolder === '' ? {} : { projectFolder }),
    modules: inCatalogOrder(catalog, basket).map(({ slug }) => slug),
    ...(Object.keys(properties).length === 0 ? {} : { properties }),
    onConflict,
  };
};
