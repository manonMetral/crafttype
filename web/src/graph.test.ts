import { describe, expect, it } from 'vitest';
import {
  COLUMN_GAP,
  availableModules,
  NODE_HEIGHT,
  NODE_WIDTH,
  PADDING,
  ROW_GAP,
  directPrerequisites,
  layoutGraph,
  levelsOf,
  relationsOf,
  type GraphModule,
} from './graph';

const mod = (slug: string, ...dependsOn: string[]): GraphModule => ({ slug, dependsOn, requires: [], provides: [] });
const modWith = (
  slug: string,
  dependsOn: string[],
  { requires = [], provides = [] }: { requires?: string[]; provides?: string[] },
): GraphModule => ({ slug, dependsOn, requires, provides });

/** The shape of the catalog: a module needs some of the modules before it, and some of those need each other. */
const catalog: readonly GraphModule[] = [
  mod('init'),
  mod('typescript', 'init'),
  mod('prettier', 'init'),
  mod('vitest', 'typescript'),
  mod('vue-app', 'typescript'),
  mod('fastify-server', 'typescript', 'vitest'),
  mod('config', 'fastify-server'),
  mod('docker', 'fastify-server', 'config'),
  mod('auth', 'fastify-server', 'vitest'),
];

const levels = (modules: readonly GraphModule[]) => Object.fromEntries(levelsOf(modules));
const edgesOf = (modules: readonly GraphModule[]) =>
  [...directPrerequisites(modules)].flatMap(([slug, needs]) => needs.map((need) => `${need}>${slug}`));

describe('levels', () => {
  it('puts a module that needs nothing at the first level, and the others after the longest chain they need', () => {
    expect(levels(catalog)).toEqual({
      init: 0,
      typescript: 1,
      prettier: 1,
      vitest: 2,
      'vue-app': 2,
      'fastify-server': 3,
      config: 4,
      docker: 5,
      auth: 4,
    });
  });

  it('does not depend on the order of the modules', () => {
    expect(levels([...catalog].reverse())).toEqual(levels(catalog));
  });

  it('ignores a prerequisite the catalog does not have', () => {
    expect(levels([mod('a', 'ghost'), mod('b', 'a', 'ghost')])).toEqual({ a: 0, b: 1 });
  });

  it('does not loop on modules that need each other: the link that closes the loop is ignored', () => {
    const result = levels([mod('a', 'b'), mod('b', 'a')]);

    expect(Object.keys(result).sort()).toEqual(['a', 'b']);
    expect(Math.abs((result['a'] ?? 0) - (result['b'] ?? 0))).toBe(1);
  });
});

describe('direct prerequisites', () => {
  it('keeps what a module needs that its other prerequisites do not already need', () => {
    expect(edgesOf(catalog).sort()).toEqual(
      [
        'init>typescript',
        'init>prettier',
        'typescript>vitest',
        'typescript>vue-app',
        'vitest>fastify-server',
        'fastify-server>config',
        'config>docker',
        'fastify-server>auth',
      ].sort(),
    );
  });

  it('keeps every prerequisite when none of them needs another', () => {
    expect(edgesOf([mod('a'), mod('b'), mod('c', 'a', 'b')]).sort()).toEqual(['a>c', 'b>c']);
  });

  it('lists a prerequisite once, and not a prerequisite the catalog does not have', () => {
    expect(edgesOf([mod('a'), mod('b', 'a', 'a', 'ghost')])).toEqual(['a>b']);
  });

  it('has an entry for a module that needs nothing', () => {
    expect(directPrerequisites([mod('a')]).get('a')).toEqual([]);
  });
});

describe('relations of a module', () => {
  it('gives everything it needs and everything that needs it, through the chain', () => {
    const { prerequisites, dependents } = relationsOf(catalog, 'fastify-server');

    expect([...prerequisites].sort()).toEqual(['init', 'typescript', 'vitest']);
    expect([...dependents].sort()).toEqual(['auth', 'config', 'docker']);
  });

  it('does not include the module itself', () => {
    const { prerequisites, dependents } = relationsOf(catalog, 'config');

    expect(prerequisites.has('config')).toBe(false);
    expect(dependents.has('config')).toBe(false);
  });

  it('has nothing for a module that is alone, or that the catalog does not have', () => {
    expect(relationsOf([mod('a')], 'a')).toEqual({ prerequisites: new Set(), dependents: new Set() });
    expect(relationsOf(catalog, 'ghost')).toEqual({ prerequisites: new Set(), dependents: new Set() });
  });

  it('does not loop on modules that need each other', () => {
    const { prerequisites, dependents } = relationsOf([mod('a', 'b'), mod('b', 'a')], 'a');

    expect([...prerequisites]).toEqual(['b']);
    expect([...dependents]).toEqual(['b']);
  });
});

describe('layout', () => {
  const layout = layoutGraph(catalog);
  const node = (slug: string) => layout.nodes.find((candidate) => candidate.slug === slug)!;

  it('has one node per module, in the order of the levels, then of the rows', () => {
    expect(layout.nodes.map(({ slug }) => slug)).toEqual([
      'init',
      'typescript',
      'prettier',
      'vitest',
      'vue-app',
      'fastify-server',
      'config',
      'auth',
      'docker',
    ]);
  });

  it('puts each level in its column, at a distance that leaves room for the links', () => {
    for (const { slug, level, x } of layout.nodes) {
      expect(x, slug).toBe(PADDING + level * (NODE_WIDTH + COLUMN_GAP));
    }
    expect(layout.levels).toBe(6);
  });

  it('puts the nodes of a column one under the other, without overlap', () => {
    const column = layout.nodes.filter(({ level }) => level === 4);

    expect(column.map(({ slug }) => slug).sort()).toEqual(['auth', 'config']);
    const [first, second] = [...column].sort((a, b) => a.y - b.y);
    expect(second!.y - first!.y).toBe(NODE_HEIGHT + ROW_GAP);
  });

  it('centers the columns on the tallest one', () => {
    const tallest = Math.max(...layout.nodes.map(({ row }) => row)) + 1;
    const inColumn = (level: number) => layout.nodes.filter((candidate) => candidate.level === level).length;

    expect(tallest).toBe(2);
    expect(node('init').y).toBe(PADDING + (NODE_HEIGHT + ROW_GAP) / 2);
    expect(inColumn(0)).toBe(1);
    expect(node('typescript').y).toBe(PADDING);
  });

  it('orders a column after the rows of what its modules need, to cross the links less', () => {
    const crossing = layoutGraph([mod('a'), mod('b'), mod('c', 'b'), mod('d', 'a')]);
    const row = (slug: string) => crossing.nodes.find((candidate) => candidate.slug === slug)!.row;

    expect(row('d')).toBe(row('a'));
    expect(row('c')).toBe(row('b'));
  });

  it('draws one link per direct prerequisite, from the right of the module it needs to the left of the module', () => {
    expect(layout.edges.map(({ from, to }) => `${from}>${to}`).sort()).toEqual(edgesOf(catalog).sort());

    const edge = layout.edges.find(({ from, to }) => from === 'typescript' && to === 'vitest')!;
    const start = node('typescript');
    const end = node('vitest');
    const x1 = start.x + NODE_WIDTH;
    const y1 = start.y + NODE_HEIGHT / 2;
    const x2 = end.x;
    const y2 = end.y + NODE_HEIGHT / 2;
    const dx = (x2 - x1) / 2;
    expect(edge.path).toBe(`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
  });

  it('is as large as its nodes and the room around them', () => {
    expect(layout.width).toBe(2 * PADDING + 6 * NODE_WIDTH + 5 * COLUMN_GAP);
    expect(layout.height).toBe(2 * PADDING + 2 * NODE_HEIGHT + ROW_GAP);
  });

  it('is empty for an empty catalog', () => {
    expect(layoutGraph([])).toEqual({ nodes: [], edges: [], width: 2 * PADDING, height: 2 * PADDING, levels: 0 });
  });

  it('does not depend on what it is given being modified later', () => {
    const modules = [mod('a'), mod('b', 'a')];
    const before = layoutGraph(modules);
    const frozen = Object.freeze(
      modules.map((module) => Object.freeze({ ...module, dependsOn: Object.freeze([...module.dependsOn]) })),
    );

    expect(layoutGraph(frozen)).toEqual(before);
  });
});

describe('available modules', () => {
  const available = (active: string[]) => [...availableModules(catalog, new Set(active))].sort();

  it('are the modules that need nothing, when nothing is active', () => {
    expect(available([])).toEqual(['init']);
  });

  it('gain the modules whose prerequisites are all active', () => {
    expect(available(['init'])).toEqual(['init', 'prettier', 'typescript']);
    expect(available(['init', 'typescript'])).toEqual(['init', 'prettier', 'typescript', 'vitest', 'vue-app']);
  });

  it('wait for every prerequisite, not for one of them', () => {
    expect(available(['init', 'typescript'])).not.toContain('fastify-server');
    expect(available(['init', 'typescript', 'vitest'])).toContain('fastify-server');
  });

  it('keep a module that is active although what it needs is not', () => {
    expect(available(['docker'])).toEqual(['docker', 'init']);
  });

  it('count a prerequisite the catalog does not have as satisfied: nothing can activate it', () => {
    expect([...availableModules([mod('a', 'ghost')], new Set())]).toEqual(['a']);
  });
});

describe('layout of the available modules only', () => {
  const full = layoutGraph(catalog);
  const some = new Set(['init', 'typescript', 'prettier', 'vitest']);
  const layout = layoutGraph(catalog, some);

  it('keeps the nodes it shows where the whole graph puts them: nothing moves when another module appears', () => {
    expect(layout.nodes).toEqual(full.nodes.filter(({ slug }) => some.has(slug)));
  });

  it('draws the links between the modules it shows, and no other', () => {
    expect(layout.edges.map(({ from, to }) => `${from}>${to}`).sort()).toEqual([
      'init>prettier',
      'init>typescript',
      'typescript>vitest',
    ]);
    expect(layout.edges).toEqual(full.edges.filter(({ from, to }) => some.has(from) && some.has(to)));
  });

  it('is as wide as the last level that is shown, and as high as the whole graph', () => {
    expect(layout.levels).toBe(3);
    expect(layout.width).toBe(2 * PADDING + 3 * NODE_WIDTH + 2 * COLUMN_GAP);
    expect(layout.height).toBe(full.height);
  });

  it('is the whole graph when every module is shown, or when no choice is made', () => {
    expect(layoutGraph(catalog, new Set(catalog.map(({ slug }) => slug)))).toEqual(full);
    expect(layoutGraph(catalog, undefined)).toEqual(full);
  });

  it('has nothing to show when no module is', () => {
    expect(layoutGraph(catalog, new Set())).toEqual({
      nodes: [],
      edges: [],
      width: 2 * PADDING,
      height: full.height,
      levels: 0,
    });
  });
});

describe('capabilities', () => {
  /** Two modules bring a front; `fetch-client` needs one (and `vitest`), `pinia` needs `vue-app` itself. */
  const fronts: readonly GraphModule[] = [
    mod('init'),
    mod('typescript', 'init'),
    mod('vitest', 'typescript'),
    modWith('vue-app', ['typescript'], { provides: ['front'] }),
    modWith('react-app', ['typescript'], { provides: ['front'] }),
    mod('pinia', 'vue-app'),
    modWith('fetch-client', ['vitest'], { requires: ['front'] }),
  ];

  it('puts a module that requires a capability after every module that could provide it', () => {
    expect(levels(fronts)).toMatchObject({ 'vue-app': 2, 'react-app': 2, vitest: 2, 'fetch-client': 3 });
  });

  it('links a module that requires a capability to each module that provides it, besides the modules it needs', () => {
    const needs = directPrerequisites(fronts).get('fetch-client');

    expect([...(needs ?? [])].sort()).toEqual(['react-app', 'vitest', 'vue-app']);
  });

  it('has no link for a capability that no module provides, nor from a module to itself', () => {
    expect(edgesOf([modWith('a', [], { requires: ['nothing'] })])).toEqual([]);
    expect(edgesOf([modWith('a', [], { requires: ['x'], provides: ['x'] })])).toEqual([]);
  });

  it('gives, as the prerequisites of a module, the modules that could provide a capability it requires', () => {
    const { prerequisites } = relationsOf(fronts, 'fetch-client');

    expect([...prerequisites].sort()).toEqual(['init', 'react-app', 'typescript', 'vitest', 'vue-app']);
  });

  it('gives, as the dependents of a module that provides a capability, the modules that require it', () => {
    const { dependents } = relationsOf(fronts, 'vue-app');

    expect([...dependents].sort()).toEqual(['fetch-client', 'pinia']);
  });

  describe('available modules', () => {
    const available = (active: string[]) => [...availableModules(fronts, new Set(active))].sort();

    it('offer every provider of a capability once what they need is there', () => {
      expect(available(['init', 'typescript'])).toEqual(['init', 'react-app', 'typescript', 'vitest', 'vue-app']);
    });

    it('wait for a module that provides a capability they require, and for the modules they need', () => {
      expect(available(['init', 'typescript', 'vitest'])).not.toContain('fetch-client');
      expect(available(['init', 'typescript', 'vue-app'])).not.toContain('fetch-client');
      expect(available(['init', 'typescript', 'vitest', 'react-app'])).toContain('fetch-client');
    });

    it('leave out the other providers of a capability once one is active: there is one per project', () => {
      expect(available(['init', 'typescript', 'vue-app'])).not.toContain('react-app');
      expect(available(['init', 'typescript', 'react-app'])).not.toContain('vue-app');
    });

    it('keep a provider that is active, even when another is too', () => {
      expect(available(['init', 'typescript', 'vue-app', 'react-app'])).toEqual(
        expect.arrayContaining(['vue-app', 'react-app']),
      );
    });

    it('do not wait for a capability that no module provides', () => {
      expect([...availableModules([modWith('a', [], { requires: ['nothing'] })], new Set())]).toEqual(['a']);
    });
  });
});
