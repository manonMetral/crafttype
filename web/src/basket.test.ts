import { describe, expect, it } from 'vitest';
import {
  addModule,
  exclusionOf,
  inCatalogOrder,
  listNeeds,
  missingPrerequisites,
  presetValues,
  removeModule,
  sharedProperties,
  toRequest,
  type Basket,
} from './basket';
import type { Catalog, ModuleInfo, PropertyInfo } from './types';

const port: PropertyInfo = { key: 'serverPort', type: 'number', mandatory: false, description: 'HTTP port' };
const name: PropertyInfo = { key: 'projectName', type: 'string', mandatory: false, description: 'Project name' };

const mod = (
  slug: string,
  dependsOn: string[] = [],
  properties: PropertyInfo[] = [],
  { requires = [], provides = [] }: { requires?: string[]; provides?: string[] } = {},
): ModuleInfo => ({
  slug,
  group: 'G',
  description: slug,
  dependsOn,
  requires,
  provides,
  tags: [],
  properties,
});

/** init <- typescript <- vitest <- fastify-server (and typescript) <- auth (and vitest). */
const catalog: Catalog = {
  modules: [
    mod('init', [], [name]),
    mod('typescript', ['init']),
    mod('vitest', ['typescript']),
    mod('fastify-server', ['typescript', 'vitest'], [port]),
    mod('auth', ['fastify-server', 'vitest']),
    mod('prettier', ['init']),
  ],
};
const none: ReadonlySet<string> = new Set();
const slugs = (basket: Basket) => basket.map(({ slug }) => slug);
const entry = (slug: string, auto = false) => ({ slug, auto });
const sorted = (basket: Basket) => slugs(inCatalogOrder(catalog, basket));

describe('adding a module to the basket', () => {
  it('adds a module that needs nothing', () => {
    expect(addModule(catalog, none, [], 'init')).toEqual([entry('init')]);
  });

  it('adds what the module needs, down to what nothing needs, flagged as added automatically', () => {
    const basket = addModule(catalog, none, [], 'vitest');

    expect(sorted(basket)).toEqual(['init', 'typescript', 'vitest']);
    expect(basket.find(({ slug }) => slug === 'vitest')).toEqual(entry('vitest'));
    expect(
      basket
        .filter(({ auto }) => auto)
        .map(({ slug }) => slug)
        .sort(),
    ).toEqual(['init', 'typescript']);
  });

  it('adds nothing for a prerequisite the project already has', () => {
    const basket = addModule(catalog, new Set(['init']), [], 'vitest');

    expect(sorted(basket)).toEqual(['typescript', 'vitest']);
  });

  it('adds a prerequisite that two paths lead to once', () => {
    const basket = addModule(catalog, none, [], 'auth');

    expect(sorted(basket)).toEqual(['init', 'typescript', 'vitest', 'fastify-server', 'auth']);
    expect(slugs(basket).filter((slug) => slug === 'typescript')).toHaveLength(1);
  });

  it('keeps a chosen module chosen when another module that needs it is added', () => {
    const chosen = addModule(catalog, none, [], 'typescript');

    const basket = addModule(catalog, none, chosen, 'vitest');

    expect(basket.find(({ slug }) => slug === 'typescript')).toEqual(entry('typescript', false));
  });

  it('does not add again a module that is in the basket', () => {
    const basket = addModule(catalog, none, [], 'vitest');

    expect(addModule(catalog, none, basket, 'vitest')).toEqual(basket);
  });

  it('turns a module added automatically into a chosen one when it is chosen', () => {
    const basket = addModule(catalog, none, [], 'vitest');

    const chosen = addModule(catalog, none, basket, 'typescript');

    expect(chosen.find(({ slug }) => slug === 'typescript')).toEqual(entry('typescript', false));
    expect(chosen).toHaveLength(basket.length);
  });

  it('does not add a module the project already has, nor one the catalog does not know', () => {
    expect(addModule(catalog, new Set(['init']), [], 'init')).toEqual([]);
    expect(addModule(catalog, none, [], 'nope')).toEqual([]);
  });

  it('does not change the basket it is given', () => {
    const basket: Basket = [entry('init')];

    addModule(catalog, none, basket, 'vitest');

    expect(basket).toEqual([entry('init')]);
  });
});

describe('removing a module from the basket', () => {
  it('removes a module, and what was added only for it', () => {
    const basket = addModule(catalog, none, [], 'vitest');

    expect(removeModule(catalog, basket, 'vitest')).toEqual([]);
  });

  it('keeps what was added automatically while another module of the basket needs it, and drops the rest', () => {
    const basket = addModule(catalog, none, addModule(catalog, none, [], 'vitest'), 'prettier');

    const after = removeModule(catalog, basket, 'vitest');

    expect(sorted(after)).toEqual(['init', 'prettier']);
    expect(after.find(({ slug }) => slug === 'init')).toEqual(entry('init', true));
  });

  it('keeps a module that was chosen, even when nothing needs it', () => {
    const basket = addModule(catalog, none, addModule(catalog, none, [], 'vitest'), 'typescript');

    const after = removeModule(catalog, basket, 'vitest');

    expect(after).toEqual(expect.arrayContaining([entry('typescript', false)]));
    expect(after.some(({ slug }) => slug === 'vitest')).toBe(false);
  });

  it('removes only what is asked when it is a module added automatically: the module that needs it stays, and is missing it', () => {
    const basket = addModule(catalog, none, [], 'vitest');

    const after = removeModule(catalog, basket, 'typescript');

    expect(sorted(after)).toEqual(['init', 'vitest']);
    expect(missingPrerequisites(catalog, none, after, 'vitest')).toEqual(['typescript']);
  });

  it('does not bring back what was removed by hand', () => {
    const basket = removeModule(catalog, addModule(catalog, none, [], 'vitest'), 'typescript');

    expect(slugs(removeModule(catalog, basket, 'init'))).toEqual(['vitest']);
  });

  it('does nothing for a module that is not in the basket', () => {
    const basket: Basket = [entry('init')];

    expect(removeModule(catalog, basket, 'vitest')).toEqual(basket);
  });
});

describe('order of the basket', () => {
  it('follows the catalog, whatever the order modules were chosen in', () => {
    const basket: Basket = [entry('auth'), entry('init'), entry('vitest'), entry('typescript')];

    expect(slugs(inCatalogOrder(catalog, basket))).toEqual(['init', 'typescript', 'vitest', 'auth']);
  });
});

describe('prerequisites that are missing', () => {
  it('are those that are neither applied nor in the basket', () => {
    const basket: Basket = [entry('fastify-server'), entry('typescript')];

    expect(missingPrerequisites(catalog, none, basket, 'fastify-server')).toEqual(['vitest']);
    expect(missingPrerequisites(catalog, new Set(['vitest']), basket, 'fastify-server')).toEqual([]);
  });

  it('are none for a module without prerequisites, or one that is not in the catalog', () => {
    expect(missingPrerequisites(catalog, none, [], 'init')).toEqual([]);
    expect(missingPrerequisites(catalog, none, [], 'nope')).toEqual([]);
  });
});

/**
 * Two modules bring a front (`vue-app` and `react-app`), one module brings the only database (`sqlite`); `fetch-client`
 * needs a front and `vitest`, `repository` needs a database, `pinia` needs `vue-app` itself.
 */
const withCapabilities: Catalog = {
  modules: [
    mod('init'),
    mod('typescript', ['init']),
    mod('vitest', ['typescript']),
    mod('sqlite', ['typescript'], [], { provides: ['database'] }),
    mod('vue-app', ['typescript'], [], { provides: ['front'] }),
    mod('react-app', ['typescript'], [], { provides: ['front'] }),
    mod('pinia', ['vue-app']),
    mod('fetch-client', ['vitest'], [], { requires: ['front'] }),
    mod('repository', ['vitest'], [], { requires: ['database'] }),
  ],
};
const capabilitySlugs = (basket: Basket) => basket.map(({ slug }) => slug);

describe('a module that requires a capability', () => {
  it('brings the module that provides it when only one does, flagged as added automatically', () => {
    const basket = addModule(withCapabilities, none, [], 'repository');

    expect(basket).toEqual([
      entry('repository'),
      entry('vitest', true),
      entry('typescript', true),
      entry('init', true),
      entry('sqlite', true),
    ]);
  });

  it('leaves the choice to the person when several modules provide it: it adds the rest, not a front', () => {
    const basket = addModule(withCapabilities, none, [], 'fetch-client');

    expect(capabilitySlugs(basket)).toEqual(['fetch-client', 'vitest', 'typescript', 'init']);
  });

  it('adds nothing for a capability that the project already has, whichever module brings it', () => {
    const basket = addModule(
      withCapabilities,
      new Set(['init', 'typescript', 'vitest', 'react-app']),
      [],
      'fetch-client',
    );

    expect(basket).toEqual([entry('fetch-client')]);
  });

  it('adds nothing for a capability that the basket already has', () => {
    const start: Basket = [entry('vue-app'), entry('typescript', true), entry('init', true)];

    const basket = addModule(withCapabilities, none, start, 'fetch-client');

    expect(capabilitySlugs(basket)).toEqual(['vue-app', 'typescript', 'init', 'fetch-client', 'vitest']);
    expect(basket).not.toContainEqual(entry('react-app', true));
  });

  it('brings, with the module that provides the capability, what that module needs', () => {
    const basket = addModule(withCapabilities, new Set(['init']), [], 'repository');

    expect(capabilitySlugs(basket)).toEqual(['repository', 'vitest', 'typescript', 'sqlite']);
  });
});

describe('a module that provides a capability another module of the basket or the project provides', () => {
  const provider = (applied: string[], basket: Basket, slug: string) =>
    exclusionOf(withCapabilities, new Set(applied), basket, slug);

  it('is excluded by that module, with the capability', () => {
    expect(provider(['vue-app'], [], 'react-app')).toEqual({ capability: 'front', by: 'vue-app' });
    expect(provider([], [entry('react-app')], 'vue-app')).toEqual({ capability: 'front', by: 'react-app' });
  });

  it('is not excluded by itself, nor when nothing provides the capability', () => {
    expect(provider(['vue-app'], [], 'vue-app')).toBeUndefined();
    expect(provider([], [entry('vue-app', true)], 'vue-app')).toBeUndefined();
    expect(provider([], [], 'react-app')).toBeUndefined();
  });

  it('is not excluded when it provides nothing, or is not in the catalog', () => {
    expect(provider(['vue-app'], [], 'pinia')).toBeUndefined();
    expect(provider(['vue-app'], [], 'nope')).toBeUndefined();
  });

  it('is not added to the basket', () => {
    const start: Basket = [entry('vue-app')];

    expect(addModule(withCapabilities, none, start, 'react-app')).toBe(start);
    expect(addModule(withCapabilities, new Set(['react-app']), [], 'vue-app')).toEqual([]);
  });

  it('can be chosen when it is already in the basket, brought by a module that needs it', () => {
    const start: Basket = [entry('vue-app', true), entry('pinia'), entry('typescript', true), entry('init', true)];

    expect(addModule(withCapabilities, none, start, 'vue-app')).toEqual([
      entry('vue-app'),
      entry('pinia'),
      entry('typescript', true),
      entry('init', true),
    ]);
  });
});

describe('removing the module that required a capability', () => {
  it('removes the module that was brought for it, and keeps the one that was chosen', () => {
    const brought = addModule(withCapabilities, none, [], 'repository');
    expect(capabilitySlugs(removeModule(withCapabilities, brought, 'repository'))).toEqual([]);

    const chosen: Basket = [
      entry('sqlite'),
      entry('repository'),
      entry('vitest', true),
      entry('typescript', true),
      entry('init', true),
    ];
    expect(capabilitySlugs(removeModule(withCapabilities, chosen, 'repository'))).toEqual([
      'sqlite',
      'typescript',
      'init',
    ]);
  });

  it('keeps the module that provides it while another module of the basket needs the capability', () => {
    const start: Basket = [
      entry('fetch-client'),
      entry('vue-app', true),
      entry('pinia'),
      entry('vitest', true),
      entry('typescript', true),
      entry('init', true),
    ];

    const rest = removeModule(withCapabilities, start, 'fetch-client');

    expect(capabilitySlugs(rest)).toEqual(['vue-app', 'pinia', 'typescript', 'init']);
  });

  it('keeps the module that provides a capability while a module of the basket that requires it stays', () => {
    const start: Basket = [
      entry('fetch-client'),
      entry('vue-app', true),
      entry('pinia'),
      entry('vitest', true),
      entry('typescript', true),
      entry('init', true),
    ];

    expect(capabilitySlugs(removeModule(withCapabilities, start, 'pinia'))).toEqual([
      'fetch-client',
      'vue-app',
      'vitest',
      'typescript',
      'init',
    ]);
  });

  it('keeps, with the module that provides the capability, what that module needs', () => {
    const start: Basket = [
      entry('fetch-client'),
      entry('react-app', true),
      entry('typescript', true),
      entry('init', true),
      entry('vitest', true),
    ];

    expect(capabilitySlugs(removeModule(withCapabilities, start, 'react-app'))).toEqual([
      'fetch-client',
      'typescript',
      'init',
      'vitest',
    ]);
  });
});

describe('what a module needs', () => {
  const needs = (slug: string, applied: string[], inBasket: string[]) =>
    listNeeds(
      withCapabilities,
      new Set(applied),
      new Set(inBasket),
      withCapabilities.modules.find((module) => module.slug === slug)!,
    );

  it('lists the modules it depends on, each as applied, in the basket or missing', () => {
    expect(needs('pinia', ['vue-app'], [])).toEqual([{ name: 'vue-app', status: 'applied' }]);
    expect(needs('pinia', [], ['vue-app'])).toEqual([{ name: 'vue-app', status: 'in-basket' }]);
    expect(needs('pinia', [], [])).toEqual([{ name: 'vue-app', status: 'missing' }]);
  });

  it('lists a capability with the module that provides it, as applied or in the basket', () => {
    expect(needs('fetch-client', ['vitest', 'react-app'], [])).toEqual([
      { name: 'vitest', status: 'applied' },
      { name: 'front: react-app', status: 'applied' },
    ]);
    expect(needs('fetch-client', [], ['vue-app'])[1]).toEqual({ name: 'front: vue-app', status: 'in-basket' });
  });

  it('lists a capability that nothing provides yet with every module that could, as missing', () => {
    expect(needs('fetch-client', [], [])[1]).toEqual({ name: 'front: vue-app or react-app', status: 'missing' });
    expect(needs('repository', [], [])[1]).toEqual({ name: 'database: sqlite', status: 'missing' });
  });

  it('prefers the module the project has to the one the basket holds', () => {
    expect(needs('fetch-client', ['vue-app'], ['react-app'])[1]).toEqual({ name: 'front: vue-app', status: 'applied' });
  });

  it('is nothing for a module that needs nothing', () => {
    expect(needs('init', [], [])).toEqual([]);
  });

  it('counts, among the prerequisites that are missing, the capabilities nobody brings', () => {
    const basket: Basket = [entry('fetch-client'), entry('vitest', true)];

    expect(missingPrerequisites(withCapabilities, none, basket, 'fetch-client')).toEqual([
      'front: vue-app or react-app',
    ]);
    expect(missingPrerequisites(withCapabilities, new Set(['react-app']), basket, 'fetch-client')).toEqual([]);
    expect(missingPrerequisites(withCapabilities, none, [entry('fetch-client')], 'fetch-client')).toEqual([
      'vitest',
      'front: vue-app or react-app',
    ]);
  });
});

describe('properties shared by the modules of the basket', () => {
  it('are asked once, whatever the number of modules that read them', () => {
    const wide: Catalog = { modules: [...catalog.modules, mod('vue-app', ['typescript'], [name, port])] };
    const basket: Basket = [entry('init'), entry('fastify-server'), entry('vue-app')];

    expect(sharedProperties(wide, basket)).toEqual([
      { ...name, usedBy: ['init', 'vue-app'] },
      { ...port, usedBy: ['fastify-server', 'vue-app'] },
    ]);
  });

  it('are those of the modules that are in the basket, no others', () => {
    expect(sharedProperties(catalog, [entry('typescript')])).toEqual([]);
    expect(sharedProperties(catalog, [entry('init')]).map(({ key }) => key)).toEqual(['projectName']);
  });

  it('are required as soon as one module requires them', () => {
    const owner: PropertyInfo = { key: 'owner', type: 'string', mandatory: true, description: 'Owner' };
    const loose: PropertyInfo = { ...owner, mandatory: false };
    const strict: Catalog = { modules: [mod('a', [], [loose]), mod('b', [], [owner])] };

    expect(sharedProperties(strict, [entry('a'), entry('b')])[0]?.mandatory).toBe(true);
    expect(sharedProperties(strict, [entry('a')])[0]?.mandatory).toBe(false);
  });
});

describe('values proposed for the shared properties', () => {
  const presets = {
    init: { projectName: 'shop' },
    typescript: {},
    'fastify-server': { serverPort: 4100 },
  };

  it('come from what the project proposes for the modules of the basket', () => {
    const basket: Basket = [entry('init'), entry('fastify-server')];

    expect(presetValues(catalog, basket, presets)).toEqual({ projectName: 'shop', serverPort: 4100 });
  });

  it('leave out the properties of modules that are not in the basket, and modules the project proposes nothing for', () => {
    expect(presetValues(catalog, [entry('typescript')], presets)).toEqual({});
    expect(presetValues(catalog, [entry('init')], {})).toEqual({});
  });

  it('take the first value of the catalog when two modules propose different ones', () => {
    const wide: Catalog = { modules: [mod('a', [], [port]), mod('b', [], [port])] };

    expect(presetValues(wide, [entry('b'), entry('a')], { a: { serverPort: 1 }, b: { serverPort: 2 } })).toEqual({
      serverPort: 1,
    });
  });
});

describe('request to preview the basket', () => {
  const basket: Basket = [entry('fastify-server'), entry('init'), entry('typescript', true), entry('vitest', true)];

  it('lists the modules in the order of the catalog, with the policy and the folder', () => {
    expect(toRequest(catalog, basket, {}, 'skip', '/work/shop')).toEqual({
      projectFolder: '/work/shop',
      modules: ['init', 'typescript', 'vitest', 'fastify-server'],
      onConflict: 'skip',
    });
  });

  it('leaves the folder out when there is none, so that the server uses its own', () => {
    expect(toRequest(catalog, basket, {}, 'fail', undefined)).not.toHaveProperty('projectFolder');
    expect(toRequest(catalog, basket, {}, 'fail', '')).not.toHaveProperty('projectFolder');
  });

  it('gives the values of the properties the basket reads, as they are typed', () => {
    const request = toRequest(catalog, basket, { projectName: 'shop', serverPort: 4100 }, 'fail', undefined);

    expect(request.properties).toEqual({ projectName: 'shop', serverPort: 4100 });
  });

  it('leaves out a value that is empty, so that the module uses its default, and a value nobody reads', () => {
    const request = toRequest(
      catalog,
      basket,
      { projectName: '', serverPort: undefined, other: 'x' },
      'fail',
      undefined,
    );

    expect(request).not.toHaveProperty('properties');
  });

  it('keeps a value that is false or zero', () => {
    const flag: PropertyInfo = { key: 'verbose', type: 'boolean', mandatory: false, description: 'Verbose' };
    const wide: Catalog = { modules: [mod('a', [], [flag, port])] };

    const request = toRequest(wide, [entry('a')], { verbose: false, serverPort: 0 }, 'fail', undefined);

    expect(request.properties).toEqual({ verbose: false, serverPort: 0 });
  });
});

/** Freezes the value and everything inside it: a function that modifies its input then throws a TypeError. */
const deepFrozen = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFrozen);
    Object.freeze(value);
  }
  return value;
};

describe('the inputs of the functions of the basket', () => {
  const frozenCatalog = deepFrozen(structuredClone(catalog));
  const frozenBasket: Basket = deepFrozen([entry('fastify-server'), entry('init'), entry('typescript', true)]);
  const frozenApplied: ReadonlySet<string> = new Set(['init']);

  it('are not modified by any function, whatever it returns', () => {
    expect(() => {
      addModule(frozenCatalog, frozenApplied, frozenBasket, 'auth');
      removeModule(frozenCatalog, frozenBasket, 'typescript');
      inCatalogOrder(frozenCatalog, frozenBasket);
      missingPrerequisites(frozenCatalog, frozenApplied, frozenBasket, 'auth');
      exclusionOf(frozenCatalog, frozenApplied, frozenBasket, 'auth');
      listNeeds(frozenCatalog, frozenApplied, new Set(['init']), frozenCatalog.modules[1]!);
      sharedProperties(frozenCatalog, frozenBasket);
      presetValues(frozenCatalog, frozenBasket, deepFrozen({ init: { projectName: 'shop' } }));
      toRequest(frozenCatalog, frozenBasket, deepFrozen({ projectName: 'shop' }), 'fail', '/work');
    }).not.toThrow();
  });
});
