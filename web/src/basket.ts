import type { Catalog, ConflictPolicy, ModuleInfo, PreviewRequest, PropertyInfo, PropertyValue } from './types';

export interface BasketEntry {
  readonly slug: string;
  /** Added because a module needs it, not chosen: it goes when nothing needs it any more. */
  readonly auto: boolean;
}
export type Basket = readonly BasketEntry[];

const find = (catalog: Catalog, slug: string): ModuleInfo | undefined =>
  catalog.modules.find((module) => module.slug === slug);

/**
 * Puts a module in the basket, chosen, with what it needs and the project does not have, flagged as added
 * automatically. What was taken out by hand is not brought back by the modules that already needed it.
 */
export const addModule = (catalog: Catalog, applied: ReadonlySet<string>, basket: Basket, slug: string): Basket => {
  const wanted = find(catalog, slug);
  if (wanted === undefined || applied.has(slug)) {
    return basket;
  }
  const entries = new Map(basket.map((entry) => [entry.slug, entry]));
  entries.set(slug, { slug, auto: false });

  const addPrerequisitesOf = (module: ModuleInfo): void => {
    for (const dependency of module.dependsOn) {
      const known = find(catalog, dependency);
      if (applied.has(dependency) || entries.has(dependency) || known === undefined) {
        continue;
      }
      entries.set(dependency, { slug: dependency, auto: true });
      addPrerequisitesOf(known);
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

  const needed = new Set<string>();
  const visit = (module: string): void => {
    for (const dependency of find(catalog, module)?.dependsOn ?? []) {
      if (!needed.has(dependency)) {
        needed.add(dependency);
        visit(dependency);
      }
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

/** What a module of the basket needs, that the project does not have and the basket does not bring. */
export const missingPrerequisites = (
  catalog: Catalog,
  applied: ReadonlySet<string>,
  basket: Basket,
  slug: string,
): readonly string[] => {
  const inBasket = new Set(basket.map((entry) => entry.slug));
  return (find(catalog, slug)?.dependsOn ?? []).filter(
    (dependency) => !applied.has(dependency) && !inBasket.has(dependency),
  );
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
