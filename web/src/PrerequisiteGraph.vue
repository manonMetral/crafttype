<script setup lang="ts">
import { computed } from 'vue';
import { availableModules, layoutGraph, relationsOf, type GraphEdge } from './graph';
import type { ModuleInfo } from './types';
import styles from './PrerequisiteGraph.module.css';

const props = defineProps<{
  /** In the order of the catalog. */
  modules: readonly ModuleInfo[];
  /** The modules the project already has. */
  applied: ReadonlySet<string>;
  inBasket: ReadonlySet<string>;
  selected: string | undefined;
}>();
const emit = defineEmits<{
  select: [slug: string];
  /** The module is neither in the project nor in the basket: pressing it puts it in the basket. */
  add: [slug: string];
}>();

const ARROW = 'prerequisite-arrow';
const ARROW_ON = 'prerequisite-arrow-on';

/** What the project has and what the basket holds, and what only needs that: the other modules wait. */
const visible = computed(() => availableModules(props.modules, new Set([...props.applied, ...props.inBasket])));
const layout = computed(() => layoutGraph(props.modules, visible.value));
const waiting = computed(() => props.modules.length - visible.value.size);
const relations = computed(() => relationsOf(props.modules, props.selected ?? ''));

const stateOf = (slug: string) =>
  props.applied.has(slug) ? 'applied' : props.inBasket.has(slug) ? 'in-basket' : 'available';
const STATE_LABEL = { applied: 'Applied', 'in-basket': 'In basket', available: '' } as const;

/** What the module is to the one that is chosen. `none`: no module is chosen. */
const relationOf = (slug: string) => {
  if (props.selected === undefined) {
    return 'none';
  }
  if (slug === props.selected) {
    return 'selected';
  }
  return relations.value.prerequisites.has(slug)
    ? 'prerequisite'
    : relations.value.dependents.has(slug)
      ? 'dependent'
      : 'unrelated';
};
const RELATION_LABEL = { prerequisite: 'prerequisite', dependent: 'needs it' } as const;
const relationLabel = (slug: string): string => RELATION_LABEL[relationOf(slug) as keyof typeof RELATION_LABEL] ?? '';

/** A link is on the chain of the chosen module when it leads to it (or to what it needs), or leaves it (or what needs it). */
const chainOf = ({ from, to }: GraphEdge): 'prerequisites' | 'dependents' | 'unrelated' | 'none' => {
  const { prerequisites, dependents } = relations.value;
  if (props.selected === undefined) {
    return 'none';
  }
  if (to === props.selected || prerequisites.has(to)) {
    return 'prerequisites';
  }
  return from === props.selected || dependents.has(from) ? 'dependents' : 'unrelated';
};

const onChain = (edge: GraphEdge): boolean => ['prerequisites', 'dependents'].includes(chainOf(edge));

const addable = (slug: string): boolean => !props.applied.has(slug) && !props.inBasket.has(slug);

/** Pressing a module chooses it, and puts it in the basket unless the project has it or the basket holds it. */
const press = (slug: string): void => {
  emit('select', slug);
  if (addable(slug)) {
    emit('add', slug);
  }
};

const info = (slug: string) => props.modules.find((module) => module.slug === slug);
const list = (slugs: readonly string[]): string => (slugs.length === 0 ? 'nothing' : slugs.join(', '));
const providersOf = (capability: string): string[] =>
  props.modules.filter(({ provides }) => provides.includes(capability)).map((module) => module.slug);
/** For a screen reader: the links are drawn, and the lists say the same. */
const links = (slug: string): string => {
  const module = info(slug);
  const needs = [
    ...(module?.dependsOn ?? []),
    ...(module?.requires ?? []).map((capability) => `${capability} (${providersOf(capability).join(' or ')})`),
  ];
  const provided = module?.provides ?? [];
  const neededBy = props.modules
    .filter(
      ({ dependsOn, requires }) =>
        dependsOn.includes(slug) || requires.some((capability) => provided.includes(capability)),
    )
    .map((other) => other.slug);
  return `Needs ${list(needs)}. Needed by ${list(neededBy)}.${addable(slug) ? ' Pressing it adds it to the basket.' : ''}`;
};
const linksId = (slug: string): string => `graph-links-${slug}`;
</script>

<template>
  <div :class="styles.graph" role="group" aria-label="Prerequisites of the modules">
    <p v-if="waiting > 0" role="status" :class="styles.waiting">
      {{ waiting }} more {{ waiting === 1 ? 'module appears' : 'modules appear' }} once what
      {{ waiting === 1 ? 'it needs is' : 'they need is' }} applied or in the basket.
    </p>
    <div :class="styles.scroll">
      <div :class="styles.canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
        <svg :class="styles.edges" :width="layout.width" :height="layout.height" aria-hidden="true" focusable="false">
          <defs>
            <marker
              :id="ARROW"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" :class="styles.arrow" />
            </marker>
            <marker
              :id="ARROW_ON"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" :class="[styles.arrow, styles.arrowOn]" />
            </marker>
          </defs>
          <path
            v-for="edge in layout.edges"
            :key="`${edge.from}>${edge.to}`"
            :d="edge.path"
            :class="styles.edge"
            :data-from="edge.from"
            :data-to="edge.to"
            :data-chain="chainOf(edge)"
            :marker-end="`url(#${onChain(edge) ? ARROW_ON : ARROW})`"
          />
        </svg>
        <button
          v-for="node in layout.nodes"
          :key="node.slug"
          type="button"
          :class="styles.node"
          :style="{ left: `${node.x}px`, top: `${node.y}px` }"
          :data-slug="node.slug"
          :data-level="node.level"
          :data-state="stateOf(node.slug)"
          :data-relation="relationOf(node.slug)"
          :aria-current="selected === node.slug ? 'true' : undefined"
          :aria-describedby="linksId(node.slug)"
          @click="press(node.slug)"
        >
          <span :class="styles.name">{{ node.slug }}</span>
          <span v-if="STATE_LABEL[stateOf(node.slug)]" :class="styles.state">{{
            STATE_LABEL[stateOf(node.slug)]
          }}</span>
          <!-- Not drawn: the arrows and the borders show the chain; this is for a screen reader. -->
          <span v-if="relationLabel(node.slug)" :class="styles.relation">{{ relationLabel(node.slug) }}</span>
        </button>
        <span v-for="node in layout.nodes" :id="linksId(node.slug)" :key="node.slug" :class="styles.hidden">
          {{ links(node.slug) }}
        </span>
      </div>
    </div>
    <p :class="styles.note">
      Arrows go from a module to the modules that need it. Only direct prerequisites are drawn: a module also needs what
      its prerequisites need. Click a module to add it to the basket and see its chain.
    </p>
  </div>
</template>
