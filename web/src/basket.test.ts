import { describe, expect, it } from 'vitest';
import {
  addModule,
  inCatalogOrder,
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

const mod = (slug: string, dependsOn: string[] = [], properties: PropertyInfo[] = []): ModuleInfo => ({
  slug,
  group: 'G',
  description: slug,
  dependsOn,
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
