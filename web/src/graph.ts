/** What the graph needs to know about a module: its name, and the modules it needs. */
export interface GraphModule {
  readonly slug: string;
  readonly dependsOn: readonly string[];
}

/** In pixels: the nodes are placed from these, so that the links can be drawn without measuring the page. */
export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 60;
export const COLUMN_GAP = 28;
export const ROW_GAP = 16;
export const PADDING = 8;

export interface GraphNode {
  readonly slug: string;
  /** The column: 0 for a module that needs nothing. */
  readonly level: number;
  /** The place in the column, from the top. */
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdge {
  /** The module that is needed. */
  readonly from: string;
  /** The module that needs it. */
  readonly to: string;
  /** SVG path, from the right of `from` to the left of `to`. */
  readonly path: string;
}

export interface GraphLayout {
  /** In the order of the levels, then of the rows: the order to read and to reach with the keyboard. */
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly width: number;
  readonly height: number;
  readonly levels: number;
}

type Needs = (slug: string) => readonly string[];

/** What each module needs among the modules of the catalog: no duplicate, nothing the catalog does not have. */
const needsOf = (modules: readonly GraphModule[]): Needs => {
  const known = new Set(modules.map(({ slug }) => slug));
  const needs = new Map(
    modules.map(({ slug, dependsOn }) => [slug, [...new Set(dependsOn)].filter((need) => known.has(need))]),
  );
  // Called for the modules of the catalog only: each one has its entry.
  return (slug) => needs.get(slug) as readonly string[];
};

/** The modules reached from `start` by following `next`, without `start` itself. Safe on modules that need each other. */
const reachedFrom = (start: string, next: (slug: string) => readonly string[]): Set<string> => {
  const reached = new Set<string>([start]);
  const pending = [start];
  for (let slug = pending.pop(); slug !== undefined; slug = pending.pop()) {
    for (const following of next(slug)) {
      if (!reached.has(following)) {
        reached.add(following);
        pending.push(following);
      }
    }
  }
  reached.delete(start);
  return reached;
};

/** The column of each module: after the longest chain of modules it needs. A link that closes a loop is ignored. */
export const levelsOf = (modules: readonly GraphModule[]): ReadonlyMap<string, number> => {
  const needs = needsOf(modules);
  const levels = new Map<string, number>();
  const inProgress = new Set<string>();

  const levelOf = (slug: string): number => {
    const known = levels.get(slug);
    if (known !== undefined) {
      return known;
    }
    inProgress.add(slug);
    const before = needs(slug)
      .filter((need) => !inProgress.has(need))
      .map(levelOf);
    inProgress.delete(slug);
    const level = before.length === 0 ? 0 : Math.max(...before) + 1;
    levels.set(slug, level);
    return level;
  };

  modules.forEach(({ slug }) => levelOf(slug));
  return levels;
};

/**
 * What each module needs that its other prerequisites do not already need: `docker` needs `fastify-server` and
 * `config`, and `config` needs `fastify-server`, so only `config` is kept. The module still needs both, which the
 * chain shows.
 */
export const directPrerequisites = (modules: readonly GraphModule[]): ReadonlyMap<string, readonly string[]> => {
  const needs = needsOf(modules);
  const ancestors = new Map(modules.map(({ slug }) => [slug, reachedFrom(slug, needs)]));

  return new Map(
    modules.map(({ slug }) => {
      const all = needs(slug);
      const direct = all.filter(
        (need) => !all.some((other) => other !== need && (ancestors.get(other) as Set<string>).has(need)),
      );
      return [slug, direct];
    }),
  );
};

/**
 * The modules that can be used now: the ones the project or the basket already has (`active`), and the ones whose
 * prerequisites all are. The others wait: nothing can apply them until what they need is there.
 */
export const availableModules = (modules: readonly GraphModule[], active: ReadonlySet<string>): ReadonlySet<string> => {
  const needs = needsOf(modules);
  return new Set(
    modules
      .filter(({ slug }) => active.has(slug) || needs(slug).every((need) => active.has(need)))
      .map(({ slug }) => slug),
  );
};

export interface Relations {
  /** Everything the module needs, through the chain. */
  readonly prerequisites: ReadonlySet<string>;
  /** Every module that needs it, through the chain. */
  readonly dependents: ReadonlySet<string>;
}

export const relationsOf = (modules: readonly GraphModule[], slug: string): Relations => {
  if (!modules.some((module) => module.slug === slug)) {
    return { prerequisites: new Set(), dependents: new Set() };
  }
  const needs = needsOf(modules);
  const neededBy = (from: string) =>
    modules.filter(({ slug: other }) => needs(other).includes(from)).map((other) => other.slug);
  return {
    prerequisites: reachedFrom(slug, needs),
    dependents: reachedFrom(slug, neededBy),
  };
};

/**
 * Columns by level, from the modules that need nothing to the ones that need the most. In a column, a module goes
 * near what it needs (the mean row of its prerequisites), to cross the links less; a tie keeps the order of the
 * catalog. The columns are centered on the tallest one.
 */
const widthOf = (levelCount: number): number =>
  2 * PADDING + levelCount * NODE_WIDTH + Math.max(0, levelCount - 1) * COLUMN_GAP;

const layoutAll = (modules: readonly GraphModule[]): GraphLayout => {
  const levels = levelsOf(modules);
  const direct = directPrerequisites(modules);
  // Every module of the catalog has its entry.
  const directOf = (slug: string) => direct.get(slug) as readonly string[];
  const order = new Map(modules.map(({ slug }, index) => [slug, index]));
  const levelCount = modules.length === 0 ? 0 : Math.max(...levels.values()) + 1;

  const rows = new Map<string, number>();
  const columns: string[][] = [];
  for (let level = 0; level < levelCount; level += 1) {
    const key = (slug: string): number => {
      const needed = directOf(slug).map((need) => rows.get(need) as number);
      return needed.length === 0 ? 0 : needed.reduce((sum, row) => sum + row, 0) / needed.length;
    };
    const column = modules
      .map(({ slug }) => slug)
      .filter((slug) => levels.get(slug) === level)
      .sort((a, b) => key(a) - key(b) || (order.get(a) as number) - (order.get(b) as number));
    column.forEach((slug, row) => rows.set(slug, row));
    columns.push(column);
  }

  const tallest = Math.max(0, ...columns.map((column) => column.length));
  const step = NODE_HEIGHT + ROW_GAP;
  const nodes: GraphNode[] = columns.flatMap((column, level) =>
    column.map((slug, row) => ({
      slug,
      level,
      row,
      x: PADDING + level * (NODE_WIDTH + COLUMN_GAP),
      y: PADDING + ((tallest - column.length) * step) / 2 + row * step,
    })),
  );
  const at = new Map(nodes.map((node) => [node.slug, node]));

  const edges: GraphEdge[] = modules.flatMap(({ slug }) =>
    directOf(slug).map((need) => {
      const start = at.get(need) as GraphNode;
      const end = at.get(slug) as GraphNode;
      const x1 = start.x + NODE_WIDTH;
      const y1 = start.y + NODE_HEIGHT / 2;
      const x2 = end.x;
      const y2 = end.y + NODE_HEIGHT / 2;
      const dx = (x2 - x1) / 2;
      return { from: need, to: slug, path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` };
    }),
  );

  return {
    nodes,
    edges,
    width: widthOf(levelCount),
    height: 2 * PADDING + tallest * NODE_HEIGHT + Math.max(0, tallest - 1) * ROW_GAP,
    levels: levelCount,
  };
};

/**
 * The layout of the whole catalog, from which only the `visible` modules are kept (all of them when no choice is
 * made): a module is where the whole graph puts it, so nothing moves when another one appears. The width is that of
 * the last level that is shown, the height that of the whole graph.
 */
export const layoutGraph = (modules: readonly GraphModule[], visible?: ReadonlySet<string>): GraphLayout => {
  const all = layoutAll(modules);
  if (visible === undefined) {
    return all;
  }
  const nodes = all.nodes.filter(({ slug }) => visible.has(slug));
  const levels = Math.max(-1, ...nodes.map((node) => node.level)) + 1;
  return {
    ...all,
    nodes,
    edges: all.edges.filter(({ from, to }) => visible.has(from) && visible.has(to)),
    width: widthOf(levels),
    levels,
  };
};
