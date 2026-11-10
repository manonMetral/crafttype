<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { ModuleInfo } from './types';
import styles from './ModuleTree.module.css';

interface Group {
  readonly name: string;
  readonly modules: readonly ModuleInfo[];
}

const props = defineProps<{
  groups: readonly Group[];
  /** The modules the project already has. */
  applied: ReadonlySet<string>;
  inBasket: ReadonlySet<string>;
  selected: string | undefined;
}>();
const emit = defineEmits<{ select: [slug: string]; toggle: [slug: string] }>();

const STATUS_LABEL = { applied: 'applied', 'in-basket': 'in basket', missing: 'missing' } as const;

const collapsed = ref(new Set<string>());
const focusKey = ref('');
const tree = ref<HTMLElement>();

const groupKey = (name: string): string => `group:${name}`;
const moduleKey = (slug: string): string => `module:${slug}`;

/** What can be reached with the arrows: the groups, and the modules of the groups that are open. */
const visible = computed(() =>
  props.groups.flatMap(({ name, modules }) => [
    groupKey(name),
    ...(collapsed.value.has(name) ? [] : modules.map(({ slug }) => moduleKey(slug))),
  ]),
);
/** The one stop for the Tab key: where the focus last was, or the first node if that is no longer visible. */
const stop = computed(() => (visible.value.includes(focusKey.value) ? focusKey.value : visible.value[0]));

const groupOf = (key: string): string | undefined =>
  props.groups.find(({ modules }) => modules.some(({ slug }) => moduleKey(slug) === key))?.name;

const needs = (module: ModuleInfo) =>
  module.dependsOn.map((slug) => {
    const status = props.applied.has(slug) ? 'applied' : props.inBasket.has(slug) ? 'in-basket' : 'missing';
    return { slug, status, label: STATUS_LABEL[status] };
  });

const toggleGroup = (name: string): void => {
  const next = new Set(collapsed.value);
  if (!next.delete(name)) {
    next.add(name);
  }
  collapsed.value = next;
};

const focusOn = async (key: string): Promise<void> => {
  focusKey.value = key;
  await nextTick();
  tree.value?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
};

const choose = (slug: string): void => {
  focusKey.value = moduleKey(slug);
  emit('select', slug);
};

/** The keys of the ARIA tree pattern. Returns whether the key was one of them. */
const handleKey = (key: string, from: string): boolean => {
  const all = visible.value;
  const index = all.indexOf(from);
  const group = from.startsWith('group:') ? from.slice('group:'.length) : undefined;
  const slug = group === undefined ? from.slice('module:'.length) : undefined;

  switch (key) {
    case 'ArrowDown':
      void focusOn(all[Math.min(index + 1, all.length - 1)] as string);
      return true;
    case 'ArrowUp':
      void focusOn(all[Math.max(index - 1, 0)] as string);
      return true;
    case 'Home':
      void focusOn(all[0] as string);
      return true;
    case 'End':
      void focusOn(all[all.length - 1] as string);
      return true;
    case 'ArrowRight':
      if (group !== undefined && collapsed.value.has(group)) {
        toggleGroup(group);
      } else if (group !== undefined) {
        void focusOn(all[index + 1] as string);
      }
      return true;
    case 'ArrowLeft':
      if (group !== undefined && !collapsed.value.has(group)) {
        toggleGroup(group);
      } else if (slug !== undefined) {
        void focusOn(groupKey(groupOf(from) as string));
      }
      return true;
    case 'Enter':
      return group !== undefined ? (toggleGroup(group), true) : (emit('select', slug as string), true);
    case ' ':
      if (group !== undefined) {
        toggleGroup(group);
      } else if (!props.applied.has(slug as string)) {
        emit('toggle', slug as string);
      }
      return true;
    default:
      return false;
  }
};

const onKey = (event: KeyboardEvent, from: string): void => {
  if (handleKey(event.key, from)) {
    event.preventDefault();
  }
};
</script>

<template>
  <ul ref="tree" role="tree" aria-label="Modules" :class="styles.tree">
    <li
      v-for="group in groups"
      :key="group.name"
      role="treeitem"
      aria-level="1"
      :aria-expanded="!collapsed.has(group.name)"
      :tabindex="stop === groupKey(group.name) ? 0 : -1"
      :data-key="groupKey(group.name)"
      :class="styles.group"
      @keydown.self="onKey($event, groupKey(group.name))"
    >
      <span :class="styles.groupName" @click="toggleGroup(group.name)">{{ group.name }}</span>
      <ul v-if="!collapsed.has(group.name)" role="group">
        <li
          v-for="module in group.modules"
          :key="module.slug"
          role="treeitem"
          aria-level="2"
          :aria-selected="selected === module.slug"
          :tabindex="stop === moduleKey(module.slug) ? 0 : -1"
          :data-key="moduleKey(module.slug)"
          :class="[styles.module, selected === module.slug && styles.selected]"
          @click.stop="choose(module.slug)"
          @keydown.stop="onKey($event, moduleKey(module.slug))"
        >
          <span :class="styles.moduleName">{{ module.slug }}</span>
          <span v-if="applied.has(module.slug)" :class="[styles.state, styles.stateApplied]">Applied</span>
          <span v-else-if="inBasket.has(module.slug)" :class="[styles.state, styles.stateBasket]">In basket</span>
          <span :class="styles.moduleDescription">{{ module.description }}</span>
          <span v-if="module.dependsOn.length > 0" :class="styles.needs">
            Needs:
            <span v-for="need in needs(module)" :key="need.slug" :class="styles.need" :data-status="need.status">
              {{ need.slug }} ({{ need.label }})
            </span>
          </span>
        </li>
      </ul>
    </li>
  </ul>
</template>
